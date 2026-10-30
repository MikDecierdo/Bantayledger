<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Suppliers. Ported from server/src/services/catalogService.ts
 * (supplierService) — including loadSupplierDerived's price-trend/average
 * calculation, computed here server-side same as the Node port.
 */
class SupplierController extends Controller
{
    public function index(string $business)
    {
        $rows = DB::table('suppliers')->where('business_id', $business)->orderBy('name')->get();
        if ($rows->isEmpty()) {
            return [];
        }

        $derived = $this->loadDerived($business);

        return $rows->map(function ($row) use ($derived) {
            $d = $derived[$row->supplier_id] ?? null;

            return [
                'id' => $row->supplier_id,
                'name' => $row->name,
                'contactPerson' => $row->contact_person ?? '',
                'phone' => $row->phone ?? '',
                'email' => $row->email ?? '',
                'address' => $row->address ?? '',
                'latitude' => $row->latitude !== null ? (float) $row->latitude : null,
                'longitude' => $row->longitude !== null ? (float) $row->longitude : null,
                'productIds' => $d['productIds'] ?? [],
                'averageUnitPrice' => $d['averageUnitPrice'] ?? 0,
                'priceTrend' => $d['priceTrend'] ?? 'flat',
                'priceChangePct' => $d['priceChangePct'] ?? 0,
                'reliabilityScore' => 0,
                'status' => $row->status,
                'lastOrderedAt' => $d['lastOrderedAt'] ?? substr((string) $row->created_at, 0, 10),
            ];
        })->values();
    }

    private function loadDerived(string $business): array
    {
        $rows = DB::table('purchases as p')
            ->join('purchase_items as pi', 'pi.purchase_id', '=', 'p.purchase_id')
            ->where('p.business_id', $business)
            ->whereNotNull('p.supplier_id')
            ->orderByDesc('p.purchase_date')
            ->limit(300)
            ->select('p.supplier_id', 'p.purchase_date', 'pi.product_id', 'pi.unit_cost')
            ->get();

        $bySupplier = [];
        foreach ($rows as $row) {
            $date = substr((string) $row->purchase_date, 0, 10);
            $sid = $row->supplier_id;
            $bySupplier[$sid] ??= ['products' => [], 'prices' => [], 'lastOrdered' => $date];
            if ($date > $bySupplier[$sid]['lastOrdered']) {
                $bySupplier[$sid]['lastOrdered'] = $date;
            }
            $bySupplier[$sid]['products'][$row->product_id] = true;
            $bySupplier[$sid]['prices'][] = ['date' => $date, 'unitCost' => (float) $row->unit_cost];
        }

        $result = [];
        foreach ($bySupplier as $sid => $entry) {
            $prices = $entry['prices'];
            $average = count($prices) ? array_sum(array_column($prices, 'unitCost')) / count($prices) : 0;

            $changePct = 0;
            if (count($prices) >= 4) {
                usort($prices, fn ($a, $b) => $a['date'] <=> $b['date']);
                $mid = intdiv(count($prices), 2);
                $older = array_slice($prices, 0, $mid);
                $newer = array_slice($prices, $mid);
                $olderAvg = array_sum(array_column($older, 'unitCost')) / max(count($older), 1);
                $newerAvg = array_sum(array_column($newer, 'unitCost')) / max(count($newer), 1);
                if ($olderAvg > 0) {
                    $changePct = (($newerAvg - $olderAvg) / $olderAvg) * 100;
                }
            }

            $result[$sid] = [
                'productIds' => array_keys($entry['products']),
                'averageUnitPrice' => round($average, 2),
                'priceChangePct' => round($changePct, 1),
                'priceTrend' => $changePct > 0.5 ? 'up' : ($changePct < -0.5 ? 'down' : 'flat'),
                'lastOrderedAt' => $entry['lastOrdered'],
            ];
        }

        return $result;
    }

    public function store(Request $request, string $business)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'contactPerson' => 'nullable|string',
            'phone' => 'nullable|string',
            'email' => 'nullable|string',
            'address' => 'nullable|string',
            'latitude' => 'nullable|numeric|between:-90,90|required_with:longitude',
            'longitude' => 'nullable|numeric|between:-180,180|required_with:latitude',
            'status' => 'nullable|in:active,review,inactive',
        ]);

        $id = (string) Str::uuid();
        DB::table('suppliers')->insert([
            'supplier_id' => $id,
            'business_id' => $business,
            'name' => trim($data['name']),
            'contact_person' => isset($data['contactPerson']) ? trim($data['contactPerson']) : null,
            'phone' => isset($data['phone']) ? trim($data['phone']) : null,
            'email' => isset($data['email']) ? trim($data['email']) : null,
            'address' => isset($data['address']) ? trim($data['address']) : null,
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json(DB::table('suppliers')->where('supplier_id', $id)->first(['suppliers.*', 'supplier_id as id']), 201);
    }

    public function update(Request $request, string $business, string $id)
    {
        $data = $request->validate([
            'name' => 'sometimes|string',
            'contactPerson' => 'sometimes|nullable|string',
            'phone' => 'sometimes|nullable|string',
            'email' => 'sometimes|nullable|string',
            'address' => 'sometimes|nullable|string',
            'latitude' => 'sometimes|nullable|numeric|between:-90,90|required_with:longitude',
            'longitude' => 'sometimes|nullable|numeric|between:-180,180|required_with:latitude',
            'status' => 'sometimes|in:active,review,inactive',
        ]);

        $patch = [];
        if (array_key_exists('name', $data)) {
            $patch['name'] = trim($data['name']);
        }
        if (array_key_exists('contactPerson', $data)) {
            $patch['contact_person'] = $data['contactPerson'] ?: null;
        }
        if (array_key_exists('phone', $data)) {
            $patch['phone'] = $data['phone'] ?: null;
        }
        if (array_key_exists('email', $data)) {
            $patch['email'] = $data['email'] ?: null;
        }
        if (array_key_exists('address', $data)) {
            $patch['address'] = $data['address'] ?: null;
        }
        if (array_key_exists('latitude', $data)) {
            $patch['latitude'] = $data['latitude'];
            $patch['longitude'] = $data['longitude'] ?? null;
        }
        if (array_key_exists('status', $data)) {
            $patch['status'] = $data['status'];
        }

        $updated = DB::table('suppliers')->where('business_id', $business)->where('supplier_id', $id)->update($patch);
        if (! $updated) {
            throw ApiException::notFound('That supplier could not be found.');
        }

        return DB::table('suppliers')->where('supplier_id', $id)->first(['suppliers.*', 'supplier_id as id']);
    }

    public function destroy(string $business, string $id)
    {
        DB::table('suppliers')->where('business_id', $business)->where('supplier_id', $id)->delete();

        return response()->noContent();
    }
}
