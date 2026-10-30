<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Services\InventoryService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Ported from server/src/services/salesService.ts. Header+items+ledger+total all in one DB transaction. */
class SaleController extends Controller
{
    private function toSale(string $saleId): array
    {
        $header = DB::table('sales')
            ->leftJoin('users', 'users.user_id', '=', 'sales.user_id')
            ->where('sales.sale_id', $saleId)
            ->select('sales.*', 'users.name as cashier_name')
            ->first();

        $items = DB::table('sale_items')
            ->join('products', 'products.product_id', '=', 'sale_items.product_id')
            ->where('sale_items.sale_id', $saleId)
            ->select('sale_items.product_id', 'sale_items.quantity', 'sale_items.unit_price', 'products.name as product_name')
            ->get();

        return [
            'id' => $header->sale_id,
            'reference' => $header->reference ?? strtoupper(substr($header->sale_id, 0, 8)),
            'date' => substr((string) $header->sale_date, 0, 10),
            'time' => date('g:i A', strtotime((string) $header->created_at)),
            'items' => $items->map(fn ($i) => [
                'productId' => $i->product_id,
                'productName' => $i->product_name,
                'quantity' => (float) $i->quantity,
                'unitPrice' => (float) $i->unit_price,
            ])->values(),
            'total' => (float) $header->total_amount,
            'paymentMethod' => $header->payment_method === 'Other' ? 'Cash' : $header->payment_method,
            'paymentReference' => $header->payment_reference,
            'cashier' => $header->cashier_name ?? '—',
        ];
    }

    public function index(Request $request, string $business)
    {
        $limit = (int) $request->query('limit', 100);
        $ids = DB::table('sales')->where('business_id', $business)
            ->orderByDesc('sale_date')->orderByDesc('created_at')
            ->limit($limit)->pluck('sale_id');

        return $ids->map(fn ($id) => $this->toSale($id))->values();
    }

    public function overview(string $business)
    {
        $rows = DB::table('sales')->where('business_id', $business)
            ->where('sale_date', '>=', now()->subDays(400)->format('Y-m-d'))
            ->get(['total_amount', 'sale_date', 'payment_method']);

        $normalized = $rows->map(fn ($r) => [
            'total_amount' => (float) $r->total_amount,
            'sale_date' => substr((string) $r->sale_date, 0, 10),
            'payment_method' => $r->payment_method,
        ]);

        $today = now()->format('Y-m-d');
        $yesterday = now()->subDay()->format('Y-m-d');
        $sum = fn (callable $pred) => $normalized->filter(fn ($r) => $pred($r['sale_date']))->sum('total_amount');

        $todayTotal = $sum(fn ($d) => $d === $today);
        $yesterdayTotal = $sum(fn ($d) => $d === $yesterday);
        $weekTotal = $sum(fn ($d) => $d >= now()->subDays(6)->format('Y-m-d'));
        $prevWeekTotal = $sum(fn ($d) => $d >= now()->subDays(13)->format('Y-m-d') && $d < now()->subDays(6)->format('Y-m-d'));
        $monthStart = substr($today, 0, 7).'-01';
        $monthTotal = $sum(fn ($d) => $d >= $monthStart);
        $prevMonthPrefix = now()->subMonthNoOverflow()->format('Y-m');
        $prevMonthTotal = $sum(fn ($d) => str_starts_with($d, $prevMonthPrefix));

        $transactionsToday = $normalized->filter(fn ($r) => $r['sale_date'] === $today)->count();
        $todayByMethod = fn (string $method) => $normalized
            ->filter(fn ($r) => $r['sale_date'] === $today && $r['payment_method'] === $method)
            ->sum('total_amount');
        $todayCash = $todayByMethod('Cash');
        $todayGCash = $todayByMethod('GCash');

        $pct = fn ($current, $previous) => $previous == 0 ? ($current > 0 ? 100 : 0) : round((($current - $previous) / $previous) * 1000) / 10;

        return [
            'summary' => [
                'today' => $todayTotal,
                'todayChangePct' => $pct($todayTotal, $yesterdayTotal),
                'yesterday' => $yesterdayTotal,
                'week' => $weekTotal,
                'weekChangePct' => $pct($weekTotal, $prevWeekTotal),
                'month' => $monthTotal,
                'monthChangePct' => $pct($monthTotal, $prevMonthTotal),
                'transactionsToday' => $transactionsToday,
                'averageBasket' => $transactionsToday > 0 ? round($todayTotal / $transactionsToday) : 0,
                'todayCash' => $todayCash,
                'todayGCash' => $todayGCash,
            ],
            'last7Days' => $this->dailySeries($normalized, 7),
            'last6Months' => $this->monthlySeries($normalized, 6),
            'byCategory' => $this->byCategory($business),
        ];
    }

    private function dailySeries($rows, int $days): array
    {
        $byDay = [];
        foreach ($rows as $r) {
            $byDay[$r['sale_date']] = ($byDay[$r['sale_date']] ?? 0) + $r['total_amount'];
        }
        $result = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $d = now()->subDays($i);
            $result[] = ['label' => $d->format('D'), 'value' => $byDay[$d->format('Y-m-d')] ?? 0];
        }

        return $result;
    }

    private function monthlySeries($rows, int $months): array
    {
        $byMonth = [];
        foreach ($rows as $r) {
            $key = substr($r['sale_date'], 0, 7);
            $byMonth[$key] = ($byMonth[$key] ?? 0) + $r['total_amount'];
        }
        $result = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $d = now()->subMonthsNoOverflow($i);
            $result[] = ['label' => $d->format('M'), 'value' => $byMonth[$d->format('Y-m')] ?? 0];
        }

        return $result;
    }

    private function byCategory(string $business): array
    {
        $rows = DB::table('sale_items as si')
            ->join('products as p', 'p.product_id', '=', 'si.product_id')
            ->leftJoin('categories as c', 'c.category_id', '=', 'p.category_id')
            ->where('p.business_id', $business)
            ->groupBy('c.name')
            ->selectRaw("COALESCE(c.name, 'Uncategorised') as label")
            ->selectRaw('SUM(si.subtotal) as value')
            ->orderByDesc('value')
            ->limit(6)
            ->get();

        return $rows->map(fn ($r) => ['label' => $r->label, 'value' => (float) $r->value])->values()->all();
    }

    public function store(Request $request, string $business)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.productId' => 'required|string',
            'items.*.quantity' => 'required|numeric|gt:0',
            'items.*.unitPrice' => 'required|numeric',
            'paymentMethod' => 'required|in:Cash,GCash,Card,Other',
            'paymentReference' => [
                'nullable',
                'string',
                'regex:/^\d{4}$/',
                Rule::requiredIf(fn () => $request->input('paymentMethod') === 'GCash'),
            ],
            'saleDate' => 'nullable|date',
            'notes' => 'nullable|string',
            'reference' => 'nullable|string',
        ], [
            'paymentReference.required' => __('Enter the last 4 digits of the GCash reference number.'),
            'paymentReference.regex' => __('The GCash reference must be exactly 4 digits.'),
        ]);

        $saleId = (string) Str::uuid();
        $userId = $request->user()->user_id;
        $saleDate = $data['saleDate'] ?? now()->format('Y-m-d');
        // Only a GCash payment has a reference to keep.
        $paymentReference = $data['paymentMethod'] === 'GCash' ? ($data['paymentReference'] ?? null) : null;

        DB::transaction(function () use ($data, $saleId, $userId, $business, $saleDate, $paymentReference) {
            if ($paymentReference !== null) {
                // Lock the business first so two staff saving at once run one
                // after the other and the second sees the first's reference.
                DB::table('businesses')->where('business_id', $business)->lockForUpdate()->first();

                $taken = DB::table('sales')
                    ->where('business_id', $business)
                    ->where('payment_method', 'GCash')
                    ->where('sale_date', $saleDate)
                    ->where('payment_reference', $paymentReference)
                    ->exists();

                if ($taken) {
                    throw ApiException::conflict(
                        'GCash reference ending :ref was already used for a sale on :date. Check the number, or the earlier sale.',
                        ['ref' => $paymentReference, 'date' => __(Carbon::parse($saleDate)->format('M')).' '.Carbon::parse($saleDate)->format('j')]
                    );
                }
            }

            DB::table('sales')->insert([
                'sale_id' => $saleId,
                'business_id' => $business,
                'user_id' => $userId,
                'payment_method' => $data['paymentMethod'],
                'payment_reference' => $paymentReference,
                'sale_date' => $saleDate,
                'notes' => $data['notes'] ?? null,
                'reference' => $data['reference'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                DB::table('sale_items')->insert([
                    'sale_item_id' => (string) Str::uuid(),
                    'sale_id' => $saleId,
                    'product_id' => $item['productId'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unitPrice'],
                ]);

                // Ported from handle_sale_item: a sale removes stock;
                // recordMovement throws (rolling back the whole
                // transaction) if that would take the product below zero.
                InventoryService::recordMovement($business, $item['productId'], 'SALE', -$item['quantity'], 'sale', $saleId, null, $userId);
            }

            $total = DB::table('sale_items')->where('sale_id', $saleId)->sum('subtotal');
            DB::table('sales')->where('sale_id', $saleId)->update(['total_amount' => $total]);
        });

        return response()->json($this->toSale($saleId), 201);
    }

    public function destroy(string $business, string $id)
    {
        DB::transaction(function () use ($business, $id) {
            $exists = DB::table('sales')->where('business_id', $business)->where('sale_id', $id)->exists();
            if (! $exists) {
                throw ApiException::notFound('That sale could not be found.');
            }

            InventoryService::removeMovementsByReference($business, 'sale', $id, 'SALE');

            // Cascades to sale_items via fk_sale_items_sale.
            DB::table('sales')->where('business_id', $business)->where('sale_id', $id)->delete();
        });

        return response()->noContent();
    }
}
