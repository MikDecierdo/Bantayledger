<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Ported from server/src/services/purchaseService.ts. */
class PurchaseController extends Controller
{
    public function index(Request $request, string $business)
    {
        $limit = (int) $request->query('limit', 100);

        $headerIds = DB::table('purchases')->where('business_id', $business)
            ->orderByDesc('purchase_date')->limit($limit)->pluck('purchase_id');

        if ($headerIds->isEmpty()) {
            return [];
        }

        $rows = DB::table('purchases as p')
            ->leftJoin('suppliers as s', 's.supplier_id', '=', 'p.supplier_id')
            ->join('purchase_items as pi', 'pi.purchase_id', '=', 'p.purchase_id')
            ->join('products as prod', 'prod.product_id', '=', 'pi.product_id')
            ->whereIn('p.purchase_id', $headerIds)
            ->orderByDesc('p.purchase_date')
            ->select(
                'pi.purchase_item_id as id', 'p.purchase_id as purchase_id', 'p.reference', 'p.purchase_date',
                'p.supplier_id', 's.name as supplier_name', 'p.status',
                'pi.product_id', 'prod.name as product_name', 'prod.unit',
                'pi.quantity', 'pi.unit_cost', 'pi.subtotal',
            )
            ->get();

        return $rows->map(fn ($row) => [
            'id' => $row->id,
            'purchaseId' => $row->purchase_id,
            'reference' => $row->reference ?? strtoupper(substr($row->purchase_id, 0, 8)),
            'date' => substr((string) $row->purchase_date, 0, 10),
            'supplierId' => $row->supplier_id ?? '',
            'supplierName' => $row->supplier_name ?? 'Unassigned',
            'productId' => $row->product_id,
            'productName' => $row->product_name,
            'quantity' => (float) $row->quantity,
            'unit' => $row->unit,
            'unitCost' => (float) $row->unit_cost,
            'totalCost' => (float) $row->subtotal,
            'status' => $row->status,
        ])->values();
    }

    public function store(Request $request, string $business)
    {
        $data = $request->validate([
            'supplierId' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.productId' => 'required|string',
            'items.*.quantity' => 'required|numeric|gt:0',
            'items.*.unitCost' => 'required|numeric',
            'status' => 'nullable|in:received,pending,cancelled',
            'purchaseDate' => 'nullable|date',
            'notes' => 'nullable|string',
            'reference' => 'nullable|string',
        ]);

        $purchaseId = (string) Str::uuid();
        $status = $data['status'] ?? 'received';
        $userId = $request->user()->user_id;

        DB::transaction(function () use ($data, $purchaseId, $status, $userId, $business) {
            DB::table('purchases')->insert([
                'purchase_id' => $purchaseId,
                'business_id' => $business,
                'supplier_id' => $data['supplierId'] ?? null,
                'user_id' => $userId,
                'status' => $status,
                'purchase_date' => $data['purchaseDate'] ?? now()->format('Y-m-d'),
                'notes' => $data['notes'] ?? null,
                'reference' => $data['reference'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                DB::table('purchase_items')->insert([
                    'purchase_item_id' => (string) Str::uuid(),
                    'purchase_id' => $purchaseId,
                    'product_id' => $item['productId'],
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unitCost'],
                ]);

                // Ported from handle_purchase_item: only a received purchase
                // moves stock. A pending order is a commitment, not
                // inventory on the shelf.
                if ($status === 'received') {
                    InventoryService::applyPurchaseCost($business, $item['productId'], (float) $item['quantity'], (float) $item['unitCost']);
                    InventoryService::recordMovement($business, $item['productId'], 'PURCHASE', $item['quantity'], 'purchase', $purchaseId, null, $userId);
                }
            }

            $total = DB::table('purchase_items')->where('purchase_id', $purchaseId)->sum('subtotal');
            DB::table('purchases')->where('purchase_id', $purchaseId)->update(['total_amount' => $total]);
        });

        return response()->noContent(201);
    }

    /** Flipping to `received` releases the items into stock; flipping away takes them back out. */
    public function setStatus(Request $request, string $business, string $id)
    {
        $data = $request->validate(['status' => 'required|in:received,pending,cancelled']);
        $userId = $request->user()->user_id;

        DB::transaction(function () use ($data, $business, $id, $userId) {
            $purchase = DB::table('purchases')->where('business_id', $business)->where('purchase_id', $id)->first();
            if (! $purchase) {
                throw ApiException::notFound('That purchase could not be found.');
            }
            if ($purchase->status === $data['status']) {
                return;
            }

            if ($data['status'] === 'received') {
                $items = DB::table('purchase_items')->where('purchase_id', $id)->get(['product_id', 'quantity', 'unit_cost']);
                foreach ($items as $item) {
                    InventoryService::applyPurchaseCost($business, $item->product_id, (float) $item->quantity, (float) $item->unit_cost);
                    InventoryService::recordMovement($business, $item->product_id, 'PURCHASE', (float) $item->quantity, 'purchase', $id, null, $userId);
                }
            } elseif ($purchase->status === 'received') {
                InventoryService::removeMovementsByReference($business, 'purchase', $id, 'PURCHASE');
            }

            DB::table('purchases')->where('purchase_id', $id)->update(['status' => $data['status']]);
        });

        return response()->noContent();
    }

    public function destroy(string $business, string $id)
    {
        DB::transaction(function () use ($business, $id) {
            $exists = DB::table('purchases')->where('business_id', $business)->where('purchase_id', $id)->exists();
            if (! $exists) {
                throw ApiException::notFound('That purchase could not be found.');
            }

            // No-ops cleanly for a purchase that was never 'received'.
            InventoryService::removeMovementsByReference($business, 'purchase', $id, 'PURCHASE');

            DB::table('purchases')->where('business_id', $business)->where('purchase_id', $id)->delete();
        });

        return response()->noContent();
    }

    public function overview(string $business)
    {
        $rows = DB::table('purchases')->where('business_id', $business)
            ->where('purchase_date', '>=', now()->subDays(400)->format('Y-m-d'))
            ->get(['total_amount', 'purchase_date', 'status', 'supplier_id']);

        $normalized = $rows->map(fn ($r) => [
            'total_amount' => (float) $r->total_amount,
            'purchase_date' => substr((string) $r->purchase_date, 0, 10),
            'status' => $r->status,
            'supplier_id' => $r->supplier_id,
        ]);

        $today = now()->format('Y-m-d');
        $monthStart = substr($today, 0, 7).'-01';
        $prevMonthPrefix = now()->subMonthNoOverflow()->format('Y-m');

        $monthToDate = $normalized->filter(fn ($r) => $r['purchase_date'] >= $monthStart)->sum('total_amount');
        $prevMonthTotal = $normalized->filter(fn ($r) => str_starts_with($r['purchase_date'], $prevMonthPrefix))->sum('total_amount');

        $pending = $normalized->filter(fn ($r) => $r['status'] === 'pending');
        $received = $normalized->filter(fn ($r) => $r['status'] === 'received');

        $pct = fn ($current, $previous) => $previous == 0 ? ($current > 0 ? 100 : 0) : round((($current - $previous) / $previous) * 1000) / 10;

        $byMonth = [];
        foreach ($normalized as $r) {
            $key = substr($r['purchase_date'], 0, 7);
            $byMonth[$key] = ($byMonth[$key] ?? 0) + $r['total_amount'];
        }
        $last6Months = [];
        for ($i = 5; $i >= 0; $i--) {
            $d = now()->subMonthsNoOverflow($i);
            $last6Months[] = ['label' => $d->format('M'), 'value' => $byMonth[$d->format('Y-m')] ?? 0];
        }

        return [
            'summary' => [
                'monthToDate' => $monthToDate,
                'monthChangePct' => $pct($monthToDate, $prevMonthTotal),
                'pendingOrders' => $pending->count(),
                'pendingValue' => $pending->sum('total_amount'),
                'suppliersUsed' => $normalized->pluck('supplier_id')->filter()->unique()->count(),
                'averageOrderValue' => $received->count() > 0 ? round($received->sum('total_amount') / $received->count()) : 0,
            ],
            'last6Months' => $last6Months,
        ];
    }
}
