<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Everything the Reports page shows, for one date range and (optionally) one
 * product category. Unlike the per-page overview endpoints, which are fixed
 * to "this month" / "last 6 months", every figure here follows the filters.
 */
class ReportController extends Controller
{
    private const MAX_SPAN_DAYS = 731;

    public function show(Request $request, string $business)
    {
        $data = $request->validate([
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d',
            'categoryId' => 'nullable|string',
        ]);

        $to = isset($data['to']) ? Carbon::parse($data['to'])->startOfDay() : now()->startOfDay();
        $from = isset($data['from'])
            ? Carbon::parse($data['from'])->startOfDay()
            : $to->copy()->subMonthsNoOverflow(6)->addDay();

        if ($from->gt($to)) {
            throw ValidationException::withMessages(['from' => __('The start date must be on or before the end date.')]);
        }
        $days = (int) $from->diffInDays($to) + 1;
        if ($days > self::MAX_SPAN_DAYS) {
            throw ValidationException::withMessages(['from' => __('Reports can cover at most two years at a time.')]);
        }

        $categoryId = $data['categoryId'] ?? null;
        $categoryName = null;
        if ($categoryId) {
            $categoryName = DB::table('categories')
                ->where('business_id', $business)->where('category_id', $categoryId)->value('name');
            if ($categoryName === null) {
                throw ApiException::notFound('That category could not be found.');
            }
        }

        $granularity = $days <= 31 ? 'day' : ($days <= 124 ? 'week' : 'month');
        [$buckets, $bucketOf] = $this->buckets($from, $to, $granularity);
        $range = [$from->format('Y-m-d'), $to->format('Y-m-d')];

        // ---- Sales (per product line, so the category filter applies) ----
        $sales = DB::table('sale_items as si')
            ->join('sales as s', 's.sale_id', '=', 'si.sale_id')
            ->join('products as p', 'p.product_id', '=', 'si.product_id')
            ->leftJoin('categories as c', 'c.category_id', '=', 'p.category_id')
            ->where('s.business_id', $business)
            ->whereBetween('s.sale_date', $range)
            ->when($categoryId, fn ($q) => $q->where('p.category_id', $categoryId))
            ->get(['s.sale_id as sale_id', 's.sale_date as date', 'si.subtotal as amount', 'c.name as category']);

        // ---- Purchases: received only — pending/cancelled isn't money spent ----
        $purchases = DB::table('purchase_items as pi')
            ->join('purchases as pu', 'pu.purchase_id', '=', 'pi.purchase_id')
            ->join('products as p', 'p.product_id', '=', 'pi.product_id')
            ->where('pu.business_id', $business)
            ->where('pu.status', 'received')
            ->whereBetween('pu.purchase_date', $range)
            ->when($categoryId, fn ($q) => $q->where('p.category_id', $categoryId))
            ->get(['pu.purchase_date as date', 'pi.subtotal as amount']);

        // ---- Expenses: their own categories, so the product filter doesn't apply ----
        $expenses = DB::table('expenses')
            ->where('business_id', $business)
            ->whereBetween('expense_date', $range)
            ->get(['expense_date as date', 'amount', 'category']);

        // ---- Inventory: a current snapshot, not period-based ----
        $inventory = DB::table('products as p')
            ->leftJoin('categories as c', 'c.category_id', '=', 'p.category_id')
            ->where('p.business_id', $business)
            ->when($categoryId, fn ($q) => $q->where('p.category_id', $categoryId))
            ->orderBy('p.name')
            ->get(['p.product_id', 'p.name', 'p.unit', 'p.current_stock', 'p.minimum_stock', 'p.cost_price', 'p.status', 'c.name as category'])
            ->map(fn ($p) => [
                'id' => $p->product_id,
                'name' => $p->name,
                'category' => $p->category ?? 'Uncategorised',
                'unit' => $p->unit,
                'currentStock' => (float) $p->current_stock,
                'minimumStock' => (float) $p->minimum_stock,
                'costPrice' => (float) $p->cost_price,
                'stockValue' => round((float) $p->current_stock * (float) $p->cost_price, 2),
                'status' => $p->status,
            ])
            ->values();

        $revenue = round($sales->sum(fn ($r) => (float) $r->amount), 2);
        $purchased = round($purchases->sum(fn ($r) => (float) $r->amount), 2);
        $spent = round($expenses->sum(fn ($r) => (float) $r->amount), 2);

        return [
            'range' => [
                'from' => $range[0],
                'to' => $range[1],
                'granularity' => $granularity,
                'categoryId' => $categoryId,
                'categoryName' => $categoryName,
            ],
            'summary' => [
                'revenue' => $revenue,
                'purchases' => $purchased,
                'expenses' => $spent,
                'netPosition' => round($revenue - $purchased - $spent, 2),
                'transactions' => $sales->pluck('sale_id')->unique()->count(),
            ],
            'sales' => [
                'series' => $this->series($sales, $buckets, $bucketOf),
                'byCategory' => $this->byLabel($sales, fn ($r) => $r->category ?? 'Uncategorised'),
            ],
            'purchases' => [
                'series' => $this->series($purchases, $buckets, $bucketOf),
            ],
            'expenses' => [
                'series' => $this->series($expenses, $buckets, $bucketOf),
                'byCategory' => $this->byLabel($expenses, fn ($r) => $r->category),
            ],
            'inventory' => [
                'products' => $inventory,
                'totalValue' => round($inventory->sum('stockValue'), 2),
            ],
        ];
    }

    /**
     * Ordered empty buckets covering the range, plus a function mapping a
     * Y-m-d date to its bucket key.
     *
     * @return array{0: array<string, string>, 1: callable(string): string}
     */
    private function buckets(Carbon $from, Carbon $to, string $granularity): array
    {
        $buckets = [];

        if ($granularity === 'day') {
            for ($d = $from->copy(); $d->lte($to); $d->addDay()) {
                $buckets[$d->format('Y-m-d')] = $d->format('M j');
            }

            return [$buckets, fn (string $date) => $date];
        }

        if ($granularity === 'week') {
            for ($d = $from->copy(), $i = 0; $d->lte($to); $d->addDays(7), $i++) {
                $buckets["w{$i}"] = $d->format('M j');
            }

            return [$buckets, fn (string $date) => 'w' . intdiv((int) $from->diffInDays(Carbon::parse($date)), 7)];
        }

        $crossesYear = $from->year !== $to->year;
        for ($d = $from->copy()->startOfMonth(); $d->lte($to); $d->addMonthNoOverflow()) {
            $buckets[$d->format('Y-m')] = $d->format($crossesYear ? "M 'y" : 'M');
        }

        return [$buckets, fn (string $date) => substr($date, 0, 7)];
    }

    private function series(Collection $rows, array $buckets, callable $bucketOf): array
    {
        $totals = array_fill_keys(array_keys($buckets), 0.0);
        foreach ($rows as $r) {
            $key = $bucketOf(substr((string) $r->date, 0, 10));
            if (array_key_exists($key, $totals)) {
                $totals[$key] += (float) $r->amount;
            }
        }

        $series = [];
        foreach ($buckets as $key => $label) {
            $series[] = ['label' => $label, 'value' => round($totals[$key], 2)];
        }

        return $series;
    }

    private function byLabel(Collection $rows, callable $labelOf): array
    {
        $totals = [];
        foreach ($rows as $r) {
            $label = $labelOf($r);
            $totals[$label] = ($totals[$label] ?? 0) + (float) $r->amount;
        }
        arsort($totals);

        return collect($totals)
            ->map(fn ($v, $k) => ['label' => (string) $k, 'value' => round($v, 2)])
            ->values()
            ->all();
    }
}
