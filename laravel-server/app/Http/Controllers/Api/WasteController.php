<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Ported from server/src/services/wasteService.ts. */
class WasteController extends Controller
{
    public function index(Request $request, string $business)
    {
        $limit = (int) $request->query('limit', 200);

        $rows = DB::table('waste_records as w')
            ->join('products as p', 'p.product_id', '=', 'w.product_id')
            ->leftJoin('users', 'users.user_id', '=', 'w.user_id')
            ->where('w.business_id', $business)
            ->orderByDesc('w.waste_date')
            ->limit($limit)
            ->select('w.*', 'p.name as product_name', 'p.unit as product_unit', 'users.name as recorded_by_name')
            ->get();

        return $rows->map(fn ($row) => [
            'id' => $row->waste_record_id,
            'date' => substr((string) $row->waste_date, 0, 10),
            'productId' => $row->product_id,
            'productName' => $row->product_name,
            'quantity' => (float) $row->quantity,
            'unit' => $row->product_unit,
            'reason' => $row->reason,
            'estimatedCost' => (float) $row->estimated_cost,
            'recordedBy' => $row->recorded_by_name ?? '—',
        ])->values();
    }

    public function store(Request $request, string $business)
    {
        $data = $request->validate([
            'productId' => 'required|string',
            'quantity' => 'required|numeric|gt:0',
            'reason' => 'required|in:Expired,Damaged,Spoiled,Spillage,Customer Return',
            'estimatedCost' => 'nullable|numeric',
            'wasteDate' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $id = (string) Str::uuid();
        $userId = $request->user()->user_id;

        DB::transaction(function () use ($data, $id, $userId, $business) {
            $estimatedCost = $data['estimatedCost'] ?? null;
            if ($estimatedCost === null) {
                $product = DB::table('products')->where('product_id', $data['productId'])->first('cost_price');
                $estimatedCost = (float) ($product->cost_price ?? 0) * $data['quantity'];
            }

            DB::table('waste_records')->insert([
                'waste_record_id' => $id,
                'business_id' => $business,
                'product_id' => $data['productId'],
                'user_id' => $userId,
                'quantity' => $data['quantity'],
                'reason' => $data['reason'],
                'estimated_cost' => round($estimatedCost, 2),
                'waste_date' => $data['wasteDate'] ?? now()->format('Y-m-d'),
                'notes' => $data['notes'] ?? null,
            ]);

            // Ported from handle_waste_record: removes stock, refused
            // (rolling back the whole insert) if that would take the
            // product below zero.
            InventoryService::recordMovement($business, $data['productId'], 'WASTE', -$data['quantity'], 'waste', $id, $data['reason'], $userId);
        });

        return response()->noContent(201);
    }

    public function destroy(string $business, string $id)
    {
        DB::transaction(function () use ($business, $id) {
            $exists = DB::table('waste_records')->where('business_id', $business)->where('waste_record_id', $id)->exists();
            if (! $exists) {
                throw ApiException::notFound('That spoiled/damaged record could not be found.');
            }

            InventoryService::removeMovementsByReference($business, 'waste', $id, 'WASTE');

            DB::table('waste_records')->where('business_id', $business)->where('waste_record_id', $id)->delete();
        });

        return response()->noContent();
    }

    public function overview(string $business)
    {
        $rows = DB::table('waste_records')->where('business_id', $business)
            ->where('waste_date', '>=', now()->subDays(400)->format('Y-m-d'))
            ->get(['quantity', 'estimated_cost', 'reason', 'waste_date']);

        $normalized = $rows->map(fn ($r) => [
            'quantity' => (float) $r->quantity,
            'estimated_cost' => (float) $r->estimated_cost,
            'reason' => $r->reason,
            'waste_date' => substr((string) $r->waste_date, 0, 10),
        ]);

        $monthStart = substr(now()->format('Y-m-d'), 0, 7).'-01';
        $prevMonthPrefix = now()->subMonthNoOverflow()->format('Y-m');
        $pct = fn ($current, $previous) => $previous == 0 ? ($current > 0 ? 100 : 0) : round((($current - $previous) / $previous) * 1000) / 10;

        $thisMonth = $normalized->filter(fn ($r) => $r['waste_date'] >= $monthStart);
        $monthToDate = $thisMonth->sum('estimated_cost');
        $prevMonthTotal = $normalized->filter(fn ($r) => str_starts_with($r['waste_date'], $prevMonthPrefix))->sum('estimated_cost');

        $byReason = [];
        foreach ($thisMonth as $r) {
            $byReason[$r['reason']] = ($byReason[$r['reason']] ?? 0) + $r['estimated_cost'];
        }
        arsort($byReason);
        $byReasonList = collect($byReason)->map(fn ($v, $k) => ['label' => $k, 'value' => $v])->values();

        $byMonth = [];
        foreach ($normalized as $r) {
            $key = substr($r['waste_date'], 0, 7);
            $byMonth[$key] = ($byMonth[$key] ?? 0) + $r['estimated_cost'];
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
                'itemsLost' => $thisMonth->sum('quantity'),
                'topReason' => $byReasonList[0]['label'] ?? 'Expired',
                'wasteRatePct' => 0,
            ],
            'byReason' => $byReasonList,
            'last6Months' => $last6Months,
        ];
    }
}
