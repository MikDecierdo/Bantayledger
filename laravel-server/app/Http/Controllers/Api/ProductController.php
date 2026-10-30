<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** Ported from server/src/services/productService.ts. */
class ProductController extends Controller
{
    private function toProduct(object $row, array $derived = []): array
    {
        return [
            'id' => $row->product_id,
            'variantGroupId' => $row->variant_group_product_id,
            'isActive' => (bool) $row->is_active,
            'name' => $row->name,
            'sku' => $row->sku ?? '',
            'category' => $row->category_name ?? 'Uncategorised',
            'unit' => $row->unit,
            'currentStock' => (float) $row->current_stock,
            'minimumStock' => (float) $row->minimum_stock,
            'reorderQuantity' => (float) $row->reorder_quantity,
            'supplierId' => $row->supplier_id ?? '',
            'costPrice' => (float) $row->cost_price,
            'sellingPrice' => (float) $row->selling_price,
            'status' => $row->status,
            'imageUrl' => $row->image_path ? Storage::disk('public')->url($row->image_path) : null,
            'averageDailyDemand' => $derived['averageDailyDemand'] ?? 0,
            'lastRestockedAt' => $derived['lastRestockedAt'] ?? substr((string) $row->created_at, 0, 10),
            'updatedAt' => substr((string) $row->updated_at, 0, 10),
        ];
    }

    private function joinedQuery(string $business)
    {
        return DB::table('products')
            ->leftJoin('categories', 'categories.category_id', '=', 'products.category_id')
            ->where('products.business_id', $business)
            ->select('products.*', 'categories.name as category_name');
    }

    private function loadDerived(string $business, ?string $productId = null, int $windowDays = 30): array
    {
        $since = now()->subDays($windowDays);

        $query = DB::table('inventory_movements')
            ->where('business_id', $business)
            ->where('created_at', '>=', $since)
            ->select('product_id', 'quantity', 'movement_type', 'created_at');

        if ($productId) {
            $query->where('product_id', $productId);
        }

        $sold = [];
        $lastRestock = [];
        foreach ($query->get() as $row) {
            $qty = abs((float) $row->quantity);
            $at = substr((string) $row->created_at, 0, 10);

            if ($row->movement_type === 'SALE') {
                $sold[$row->product_id] = ($sold[$row->product_id] ?? 0) + $qty;
            }
            if ($row->movement_type === 'PURCHASE') {
                if (! isset($lastRestock[$row->product_id]) || $at > $lastRestock[$row->product_id]) {
                    $lastRestock[$row->product_id] = $at;
                }
            }
        }

        $result = [];
        foreach (array_unique(array_merge(array_keys($sold), array_keys($lastRestock))) as $id) {
            $result[$id] = [
                'averageDailyDemand' => round(($sold[$id] ?? 0) / $windowDays, 1),
                'lastRestockedAt' => $lastRestock[$id] ?? '',
            ];
        }

        return $result;
    }

    public function index(string $business)
    {
        $rows = $this->joinedQuery($business)->orderBy('products.name')->get();
        if ($rows->isEmpty()) {
            return [];
        }

        $derived = $this->loadDerived($business);

        return $rows->map(fn ($row) => $this->toProduct($row, $derived[$row->product_id] ?? []))->values();
    }

    public function show(string $business, string $id)
    {
        $row = $this->joinedQuery($business)->where('products.product_id', $id)->first();
        if (! $row) {
            throw ApiException::notFound('That product could not be found.');
        }

        $derived = $this->loadDerived($business, $id);

        return $this->toProduct($row, $derived[$id] ?? []);
    }

    public function store(Request $request, string $business)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'sku' => 'nullable|string',
            'categoryId' => 'nullable|string',
            'supplierId' => 'nullable|string',
            'unit' => 'nullable|string',
            'minimumStock' => 'required|numeric',
            'maximumStock' => 'nullable|numeric',
            'reorderQuantity' => 'required|numeric',
            'costPrice' => 'required|numeric',
            'sellingPrice' => 'required|numeric',
            'openingStock' => 'nullable|numeric',
            'variantGroupId' => 'nullable|string',
        ]);

        if (! empty($data['variantGroupId'])) {
            $anchorExists = DB::table('products')
                ->where('business_id', $business)->where('product_id', $data['variantGroupId'])->exists();
            if (! $anchorExists) {
                throw ApiException::notFound('The product this size belongs to could not be found.');
            }
        }

        $id = (string) Str::uuid();
        $name = trim($data['name']);

        try {
            DB::table('products')->insert([
                'product_id' => $id,
                'variant_group_product_id' => $data['variantGroupId'] ?? null,
                'business_id' => $business,
                'name' => $name,
                'sku' => isset($data['sku']) ? trim($data['sku']) : null,
                'category_id' => $data['categoryId'] ?? null,
                'supplier_id' => $data['supplierId'] ?? null,
                'unit' => isset($data['unit']) ? trim($data['unit']) : 'pcs',
                'minimum_stock' => $data['minimumStock'],
                'maximum_stock' => $data['maximumStock'] ?? null,
                'reorder_quantity' => $data['reorderQuantity'],
                'cost_price' => $data['costPrice'],
                'selling_price' => $data['sellingPrice'],
                // Stock starts at 0 (the column default) prior to any opening
                // stock movement below, so compute status the same way any
                // other stock change does.
                'status' => InventoryService::computeStatus(0, (float) $data['minimumStock']),
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            if ($this->isDuplicateNameViolation($e)) {
                throw ApiException::conflict('A product named ":name" already exists.', ['name' => $name]);
            }
            throw $e;
        }

        if (! empty($data['openingStock']) && $data['openingStock'] > 0) {
            InventoryService::adjustStock($business, $id, (float) $data['openingStock'], $request->user()->user_id, 'Opening stock');
        }

        return response()->json($this->show($business, $id), 201);
    }

    public function update(Request $request, string $business, string $id)
    {
        $data = $request->validate([
            'name' => 'sometimes|string',
            'sku' => 'sometimes|nullable|string',
            'categoryId' => 'sometimes|nullable|string',
            'supplierId' => 'sometimes|nullable|string',
            'unit' => 'sometimes|string',
            'minimumStock' => 'sometimes|numeric',
            'maximumStock' => 'sometimes|nullable|numeric',
            'reorderQuantity' => 'sometimes|numeric',
            'costPrice' => 'sometimes|numeric',
            'sellingPrice' => 'sometimes|numeric',
            'variantGroupId' => 'sometimes|nullable|string',
            'isActive' => 'sometimes|boolean',
        ]);

        $patch = [];
        if (array_key_exists('isActive', $data)) {
            $patch['is_active'] = $data['isActive'];
        }
        if (array_key_exists('variantGroupId', $data)) {
            $patch['variant_group_product_id'] = $data['variantGroupId'] ?: null;
        }
        if (array_key_exists('name', $data)) {
            $patch['name'] = trim($data['name']);
        }
        if (array_key_exists('sku', $data)) {
            $patch['sku'] = $data['sku'] ? trim($data['sku']) : null;
        }
        if (array_key_exists('categoryId', $data)) {
            $patch['category_id'] = $data['categoryId'] ?: null;
        }
        if (array_key_exists('supplierId', $data)) {
            $patch['supplier_id'] = $data['supplierId'] ?: null;
        }
        if (array_key_exists('unit', $data)) {
            $patch['unit'] = trim($data['unit']);
        }
        if (array_key_exists('maximumStock', $data)) {
            $patch['maximum_stock'] = $data['maximumStock'];
        }
        if (array_key_exists('reorderQuantity', $data)) {
            $patch['reorder_quantity'] = $data['reorderQuantity'];
        }
        if (array_key_exists('costPrice', $data)) {
            $patch['cost_price'] = $data['costPrice'];
        }
        if (array_key_exists('sellingPrice', $data)) {
            $patch['selling_price'] = $data['sellingPrice'];
        }

        try {
            DB::transaction(function () use ($data, $patch, $business, $id) {
                if (array_key_exists('minimumStock', $data)) {
                    $current = DB::table('products')->where('product_id', $id)->where('business_id', $business)
                        ->lockForUpdate()->first('current_stock');
                    if (! $current) {
                        throw ApiException::notFound('That product could not be found.');
                    }
                    $patch['minimum_stock'] = $data['minimumStock'];
                    $patch['status'] = InventoryService::computeStatus((float) $current->current_stock, (float) $data['minimumStock']);
                }

                $updated = DB::table('products')->where('business_id', $business)->where('product_id', $id)->update($patch);
                if (! $updated && ! DB::table('products')->where('business_id', $business)->where('product_id', $id)->exists()) {
                    throw ApiException::notFound('That product could not be found.');
                }
            });
        } catch (\Illuminate\Database\QueryException $e) {
            if ($this->isDuplicateNameViolation($e)) {
                $name = isset($patch['name']) ? $patch['name'] : 'that name';
                throw ApiException::conflict('A product named ":name" already exists.', ['name' => $name]);
            }
            throw $e;
        }

        return $this->show($business, $id);
    }

    /** True for the `products_business_id_name_key` unique-constraint violation. */
    private function isDuplicateNameViolation(\Illuminate\Database\QueryException $e): bool
    {
        return $e->getCode() === '23000' && str_contains($e->getMessage(), 'products_business_id_name_key');
    }

    public function destroy(string $business, string $id)
    {
        $product = DB::table('products')->where('business_id', $business)->where('product_id', $id)->first('image_path');

        try {
            DB::table('products')->where('business_id', $business)->where('product_id', $id)->delete();
        } catch (\Illuminate\Database\QueryException $e) {
            throw ApiException::badRequest('This product cannot be deleted because it appears in recorded sales or purchases.');
        }

        if ($product && $product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }

        return response()->noContent();
    }

    public function uploadImage(Request $request, string $business, string $id)
    {
        $data = $request->validate([
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        $existing = DB::table('products')->where('business_id', $business)->where('product_id', $id)->first('image_path');
        if (! $existing) {
            throw ApiException::notFound('That product could not be found.');
        }

        $path = $data['image']->store('products', 'public');

        if ($existing->image_path) {
            Storage::disk('public')->delete($existing->image_path);
        }

        DB::table('products')->where('business_id', $business)->where('product_id', $id)->update(['image_path' => $path]);

        return $this->show($business, $id);
    }

    public function removeImage(string $business, string $id)
    {
        $existing = DB::table('products')->where('business_id', $business)->where('product_id', $id)->first('image_path');
        if (! $existing) {
            throw ApiException::notFound('That product could not be found.');
        }

        if ($existing->image_path) {
            Storage::disk('public')->delete($existing->image_path);
        }

        DB::table('products')->where('business_id', $business)->where('product_id', $id)->update(['image_path' => null]);

        return response()->noContent();
    }

    public function adjustStock(Request $request, string $business, string $id)
    {
        $data = $request->validate(['quantity' => 'required|numeric', 'notes' => 'nullable|string']);

        InventoryService::adjustStock($business, $id, (float) $data['quantity'], $request->user()->user_id, $data['notes'] ?? null);

        return response()->noContent();
    }

    public function stockMovement(Request $request, string $business, string $id)
    {
        $days = (int) $request->query('days', 14);

        $product = DB::table('products')->where('business_id', $business)->where('product_id', $id)->first('current_stock');
        if (! $product) {
            throw ApiException::notFound('That product could not be found.');
        }

        $since = now()->subDays($days);
        $movements = DB::table('inventory_movements')
            ->where('business_id', $business)->where('product_id', $id)
            ->where('created_at', '>=', $since)
            ->orderBy('created_at')
            ->get(['quantity', 'created_at']);

        $byDay = [];
        foreach ($movements as $m) {
            $day = substr((string) $m->created_at, 0, 10);
            $byDay[$day] ??= ['in' => 0, 'out' => 0];
            $q = (float) $m->quantity;
            if ($q >= 0) {
                $byDay[$day]['in'] += $q;
            } else {
                $byDay[$day]['out'] += abs($q);
            }
        }

        $labels = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $labels[] = now()->subDays($i)->format('Y-m-d');
        }

        $running = (float) $product->current_stock;
        $result = [];
        for ($i = count($labels) - 1; $i >= 0; $i--) {
            $day = $labels[$i];
            $bucket = $byDay[$day] ?? ['in' => 0, 'out' => 0];

            array_unshift($result, [
                'date' => date('M d', strtotime($day)),
                'stock' => max(0, round($running, 3)),
                'in' => $bucket['in'],
                'out' => $bucket['out'],
            ]);

            $running -= $bucket['in'] - $bucket['out'];
        }

        return $result;
    }

    public function unitSales(Request $request, string $business, string $id)
    {
        $days = (int) $request->query('days', 7);
        $since = now()->subDays($days);

        $rows = DB::table('inventory_movements')
            ->where('business_id', $business)->where('product_id', $id)->where('movement_type', 'SALE')
            ->where('created_at', '>=', $since)
            ->get(['quantity', 'created_at']);

        $byDay = [];
        foreach ($rows as $row) {
            $day = substr((string) $row->created_at, 0, 10);
            $byDay[$day] = ($byDay[$day] ?? 0) + abs((float) $row->quantity);
        }

        $result = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $d = now()->subDays($i);
            $key = $d->format('Y-m-d');
            $result[] = ['label' => $d->format('M d'), 'value' => $byDay[$key] ?? 0];
        }

        return $result;
    }
}
