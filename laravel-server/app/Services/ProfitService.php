<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * One source of truth for profit, shared by the sales and expenses screens.
 *   capital = quantity x the buying price locked in on the sale line
 *   profit  = sales - capital
 *   available profit (to spend) = this month's profit - this month's expenses
 */
class ProfitService
{
    /** @return array{sales: float, capital: float, profit: float} for sale dates in [$from, $to]. */
    public static function range(string $business, string $from, string $to): array
    {
        $row = DB::table('sale_items as si')
            ->join('sales as s', 's.sale_id', '=', 'si.sale_id')
            ->where('s.business_id', $business)
            ->whereBetween('s.sale_date', [$from, $to])
            ->selectRaw('COALESCE(SUM(si.quantity * si.unit_price), 0) as sales, COALESCE(SUM(si.quantity * si.unit_cost), 0) as capital')
            ->first();

        $sales = round((float) $row->sales, 2);
        $capital = round((float) $row->capital, 2);

        return ['sales' => $sales, 'capital' => $capital, 'profit' => round($sales - $capital, 2)];
    }

    /** Profit still free to spend in the month of $date (Y-m-d), never below zero. */
    public static function availableForMonth(string $business, string $date): array
    {
        $start = substr($date, 0, 7).'-01';
        $end = date('Y-m-t', strtotime($start));

        $profit = self::range($business, $start, $end)['profit'];
        $spent = round((float) DB::table('expenses')->where('business_id', $business)
            ->whereBetween('expense_date', [$start, $end])->sum('amount'), 2);

        return ['profit' => $profit, 'spent' => $spent, 'available' => max(0, round($profit - $spent, 2))];
    }
}
