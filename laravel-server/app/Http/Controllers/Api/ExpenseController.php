<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Services\ProfitService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Ported from server/src/services/expenseService.ts. */
class ExpenseController extends Controller
{
    public function index(Request $request, string $business)
    {
        $limit = (int) $request->query('limit', 200);

        $rows = DB::table('expenses')
            ->leftJoin('users', 'users.user_id', '=', 'expenses.user_id')
            ->where('expenses.business_id', $business)
            ->orderByDesc('expenses.expense_date')
            ->limit($limit)
            ->select('expenses.*', 'users.name as paid_by_name')
            ->get();

        return $rows->map(fn ($row) => [
            'id' => $row->expense_id,
            'date' => substr((string) $row->expense_date, 0, 10),
            'category' => $row->category,
            'description' => $row->description,
            'amount' => (float) $row->amount,
            'paidBy' => $row->paid_by_name ?? '—',
        ])->values();
    }

    public function store(Request $request, string $business)
    {
        $data = $request->validate([
            'category' => 'required|in:Utilities,Rent,Salaries,Transport,Supplies,Permits,Maintenance',
            'description' => 'required|string',
            'amount' => 'required|numeric|gte:0',
            'expenseDate' => 'nullable|date',
        ]);

        // An expense can only be paid out of the profit still available that month.
        $expenseDate = $data['expenseDate'] ?? now()->format('Y-m-d');
        $available = ProfitService::availableForMonth($business, $expenseDate)['available'];
        if ((float) $data['amount'] > $available) {
            throw ApiException::unprocessable(
                'This is more than your available profit of :amount. Record more sales first, or enter a smaller amount.',
                ['amount' => '₱'.number_format($available, 2)]
            );
        }

        DB::table('expenses')->insert([
            'expense_id' => (string) Str::uuid(),
            'business_id' => $business,
            'user_id' => $request->user()->user_id,
            'category' => $data['category'],
            'description' => trim($data['description']),
            'amount' => $data['amount'],
            'expense_date' => $expenseDate,
        ]);

        return response()->noContent(201);
    }

    public function destroy(string $business, string $id)
    {
        $deleted = DB::table('expenses')->where('business_id', $business)->where('expense_id', $id)->delete();
        if (! $deleted) {
            throw ApiException::notFound('That expense could not be found.');
        }

        return response()->noContent();
    }

    public function overview(string $business)
    {
        $rows = DB::table('expenses')->where('business_id', $business)
            ->where('expense_date', '>=', now()->subDays(400)->format('Y-m-d'))
            ->get(['amount', 'expense_date', 'category']);

        $normalized = $rows->map(fn ($r) => [
            'amount' => (float) $r->amount,
            'expense_date' => substr((string) $r->expense_date, 0, 10),
            'category' => $r->category,
        ]);

        $today = now()->format('Y-m-d');
        $yesterday = now()->subDay()->format('Y-m-d');
        $monthStart = substr($today, 0, 7).'-01';
        $prevMonthPrefix = now()->subMonthNoOverflow()->format('Y-m');

        $sum = fn (callable $pred) => $normalized->filter(fn ($r) => $pred($r['expense_date']))->sum('amount');
        $pct = fn ($current, $previous) => $previous == 0 ? ($current > 0 ? 100 : 0) : round((($current - $previous) / $previous) * 1000) / 10;

        $todayTotal = $sum(fn ($d) => $d === $today);
        $yesterdayTotal = $sum(fn ($d) => $d === $yesterday);
        $monthToDate = $sum(fn ($d) => $d >= $monthStart);
        $prevMonth = $sum(fn ($d) => str_starts_with($d, $prevMonthPrefix));

        $byCategory = [];
        foreach ($normalized->filter(fn ($r) => $r['expense_date'] >= $monthStart) as $r) {
            $byCategory[$r['category']] = ($byCategory[$r['category']] ?? 0) + $r['amount'];
        }
        arsort($byCategory);
        $byCategoryList = collect($byCategory)->map(fn ($v, $k) => ['label' => $k, 'value' => $v])->values();

        $byMonth = [];
        foreach ($normalized as $r) {
            $key = substr($r['expense_date'], 0, 7);
            $byMonth[$key] = ($byMonth[$key] ?? 0) + $r['amount'];
        }
        $last6Months = [];
        for ($i = 5; $i >= 0; $i--) {
            $d = now()->subMonthsNoOverflow($i);
            $last6Months[] = ['label' => $d->format('M'), 'value' => $byMonth[$d->format('Y-m')] ?? 0];
        }

        $month = ProfitService::availableForMonth($business, $today);

        return [
            'summary' => [
                'today' => $todayTotal,
                'todayChangePct' => $pct($todayTotal, $yesterdayTotal),
                'monthToDate' => $monthToDate,
                'monthChangePct' => $pct($monthToDate, $prevMonth),
                'largestCategory' => $byCategoryList[0]['label'] ?? 'Utilities',
                'largestCategoryAmount' => $byCategoryList[0]['value'] ?? 0,
                'profitMonth' => $month['profit'],
                'availableProfit' => $month['available'],
            ],
            'byCategory' => $byCategoryList,
            'last6Months' => $last6Months,
        ];
    }
}
