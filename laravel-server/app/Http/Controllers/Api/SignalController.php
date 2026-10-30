<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Services\ForecastService;
use App\Services\InsightExplainer;
use App\Support\Msg;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Alerts, insights and forecasts. Written by ForecastService; read here. */
class SignalController extends Controller
{
    private const SEVERITY_LEVEL = ['critical' => 'HIGH', 'warning' => 'MEDIUM', 'info' => 'WATCH'];

    public function alerts(Request $request, string $business)
    {
        $limit = (int) $request->query('limit', 100);
        $rows = DB::table('alerts')->where('business_id', $business)->orderByDesc('created_at')->limit($limit)->get();

        $locale = app()->getLocale();

        return $rows->map(fn ($row) => [
            'id' => $row->alert_id,
            'severity' => $row->severity,
            'level' => self::SEVERITY_LEVEL[$row->severity],
            'title' => $this->text($row, 'title', $row->title, $locale),
            'detail' => $this->text($row, 'message', $row->message, $locale),
            'productId' => $row->product_id,
            'category' => $row->type,
            'createdAt' => $row->created_at,
            'read' => (bool) $row->is_read,
        ])->values();
    }

    public function alertCounts(string $business)
    {
        $rows = DB::table('alerts')->where('business_id', $business)->get(['severity', 'is_read']);

        return [
            'total' => $rows->count(),
            'unread' => $rows->where('is_read', 0)->count(),
            'critical' => $rows->where('severity', 'critical')->count(),
            'warning' => $rows->where('severity', 'warning')->count(),
            'info' => $rows->where('severity', 'info')->count(),
        ];
    }

    public function markAlertRead(string $business, string $id)
    {
        $updated = DB::table('alerts')->where('business_id', $business)->where('alert_id', $id)->update(['is_read' => true]);
        if (! $updated) {
            throw ApiException::notFound('That alert could not be found.');
        }

        return response()->noContent();
    }

    public function markAllAlertsRead(string $business)
    {
        DB::table('alerts')->where('business_id', $business)->where('is_read', false)->update(['is_read' => true]);

        return response()->noContent();
    }

    public function removeAlert(string $business, string $id)
    {
        DB::table('alerts')->where('business_id', $business)->where('alert_id', $id)->delete();

        return response()->noContent();
    }

    public function insights(Request $request, string $business)
    {
        $limit = (int) $request->query('limit', 50);
        $impact = ['high' => 'high', 'medium' => 'medium', 'low' => 'low'];

        $rows = DB::table('recommendations')->where('business_id', $business)->orderByDesc('created_at')->limit($limit)->get();
        $locale = app()->getLocale();

        return $rows->map(fn ($row) => [
            'id' => $row->recommendation_id,
            'title' => $this->text($row, 'title', $row->title, $locale),
            'summary' => $this->text($row, 'message', $row->message, $locale),
            'whyItMatters' => $this->text($row, 'reason', $row->reason ?? '', $locale),
            'recommendedAction' => $this->text($row, 'action', $row->action ?? '', $locale),
            'impact' => $impact[$row->severity],
            'category' => $row->type,
            'topic' => $row->topic,
            'productId' => $row->product_id,
            'supportingData' => $this->supporting($row->supporting, $locale),
            'confidence' => (float) ($row->confidence ?? 0),
            'generatedAt' => $row->created_at,
            'aiEnabled' => $row->topic === 'trending' && InsightExplainer::enabled(),
        ])->values();
    }

    /**
     * A sentence in the reader's language: rendered from the stored template +
     * parameters when the row has them, else the English text saved with it.
     */
    private function text(object $row, string $field, string $fallback, string $locale): string
    {
        $specs = isset($row->i18n) && $row->i18n ? json_decode($row->i18n, true) : null;
        $spec = is_array($specs) ? ($specs[$field] ?? null) : null;

        return is_array($spec) && isset($spec['k']) ? Msg::render($spec, $locale) : $fallback;
    }

    /** Supporting figures: labels and values may be stored as templates. */
    private function supporting(?string $json, string $locale): array
    {
        $items = $json ? (json_decode($json, true) ?: []) : [];

        return array_map(fn ($item) => [
            'label' => Msg::resolve($item['label'] ?? '', $locale),
            'value' => Msg::resolve($item['value'] ?? '', $locale),
        ], $items);
    }

    /** Optional AI write-up for a trending insight; see InsightExplainer for what is sent and the limits. */
    public function explainInsight(string $business, string $id)
    {
        return InsightExplainer::explain($business, $id);
    }

    public function markInsightRead(string $business, string $id)
    {
        $updated = DB::table('recommendations')->where('business_id', $business)->where('recommendation_id', $id)->update(['read_at' => now()]);
        if (! $updated) {
            throw ApiException::notFound('That recommendation could not be found.');
        }

        return response()->noContent();
    }

    /**
     * Regenerates forecasts, alerts and insights. With `?ifStale=1` it's a
     * no-op when the last run is under a day old — that's what pages call on
     * open, so the staleness rule lives here rather than in every client.
     */
    public function refreshForecasts(Request $request, string $business)
    {
        $result = ForecastService::run($business, $request->boolean('ifStale'));

        if ($result === null) {
            return ['refreshed' => false, 'generatedAt' => ForecastService::latestRun($business)?->completed_at];
        }

        return ['refreshed' => true] + $result;
    }

    public function forecasts(string $business)
    {
        $run = ForecastService::latestRun($business);
        if (! $run) {
            return ['demand' => [], 'price' => [], 'cost' => [], 'generatedAt' => null];
        }

        return [
            'demand' => $this->demandForecasts($business, $run->forecast_run_id),
            'price' => $this->priceForecasts($business, $run->forecast_run_id),
            'cost' => $this->costForecasts($business, $run->forecast_run_id),
            'generatedAt' => $run->completed_at,
        ];
    }

    private function demandForecasts(string $business, string $runId): array
    {
        $rows = DB::table('demand_forecasts as f')
            ->join('products as p', 'p.product_id', '=', 'f.product_id')
            ->where('f.business_id', $business)
            ->where('f.forecast_run_id', $runId)
            ->where('f.forecast_date', '>=', now()->format('Y-m-d'))
            ->orderBy('f.forecast_date')
            ->select('f.product_id', 'f.forecast_date', 'f.predicted_quantity', 'f.lower_bound', 'f.upper_bound', 'f.confidence', 'p.name as product_name', 'p.unit as product_unit', 'p.current_stock')
            ->get()
            ->groupBy('product_id');

        // The 7 recorded days before today, so the chart shows what actually
        // sold leading into the forecast.
        $historyStart = now()->startOfDay()->subDays(7);
        $actual = [];
        DB::table('sale_items as si')
            ->join('sales as s', 's.sale_id', '=', 'si.sale_id')
            ->where('s.business_id', $business)
            ->where('s.sale_date', '>=', $historyStart->format('Y-m-d'))
            ->where('s.sale_date', '<', now()->format('Y-m-d'))
            ->get(['si.product_id', 'si.quantity', 's.sale_date'])
            ->each(function ($r) use (&$actual) {
                $day = substr((string) $r->sale_date, 0, 10);
                $actual[$r->product_id][$day] = ($actual[$r->product_id][$day] ?? 0) + (float) $r->quantity;
            });

        $result = $rows->map(function ($group, $productId) use ($actual, $historyStart) {
            $horizon = $group->take(7);
            $total = $horizon->sum(fn ($r) => (float) $r->predicted_quantity);
            $low = $horizon->sum(fn ($r) => (float) ($r->lower_bound ?? $r->predicted_quantity));
            $high = $horizon->sum(fn ($r) => (float) ($r->upper_bound ?? $r->predicted_quantity));
            $currentStock = (float) ($group->first()->current_stock ?? 0);
            $dailyAverage = $horizon->count() > 0 ? $total / $horizon->count() : 0;

            $series = [];
            for ($i = 0; $i < 7; $i++) {
                $d = $historyStart->copy()->addDays($i);
                $series[] = ['label' => $d->format('M d'), 'actual' => (float) ($actual[$productId][$d->format('Y-m-d')] ?? 0)];
            }
            // Joins the recorded and forecast lines on the chart.
            $series[6]['forecast'] = $series[6]['actual'];

            foreach ($horizon as $r) {
                $series[] = [
                    'label' => date('M d', strtotime($r->forecast_date)),
                    'forecast' => (float) $r->predicted_quantity,
                    'low' => $r->lower_bound === null ? null : (float) $r->lower_bound,
                    'high' => $r->upper_bound === null ? null : (float) $r->upper_bound,
                ];
            }

            return [
                'productId' => $productId,
                'productName' => $group->first()->product_name ?? 'Unknown product',
                'unit' => $group->first()->product_unit ?? 'pcs',
                'horizonDays' => $horizon->count(),
                'currentStock' => $currentStock,
                'averageDailyDemand' => round($dailyAverage, 1),
                'forecastQuantity' => round($total),
                'rangeLow' => round($low),
                'rangeHigh' => round($high),
                'confidence' => round((float) ($group->first()->confidence ?? 0)),
                'daysOfCover' => $dailyAverage > 0 ? round($currentStock / $dailyAverage, 1) : 0,
                'series' => $series,
            ];
        })->values();

        // Most urgent first — the Dashboard features the first entry. No
        // demand means nothing to run out of, so those sort last, not first.
        return $result
            ->sortBy(fn ($d) => $d['averageDailyDemand'] > 0 ? $d['daysOfCover'] : PHP_FLOAT_MAX)
            ->values()->all();
    }

    private function priceForecasts(string $business, string $runId): array
    {
        $rows = DB::table('price_forecasts as f')
            ->join('products as p', 'p.product_id', '=', 'f.product_id')
            ->leftJoin('suppliers as s', 's.supplier_id', '=', 'p.supplier_id')
            ->where('f.business_id', $business)
            ->where('f.forecast_run_id', $runId)
            ->where('f.forecast_date', '>=', now()->format('Y-m-d'))
            ->orderBy('f.forecast_date')
            ->select('f.product_id', 'f.forecast_date', 'f.predicted_price', 'f.lower_bound', 'f.upper_bound', 'p.name as product_name', 'p.cost_price', 's.name as supplier_name')
            ->get()
            ->groupBy('product_id');

        return $rows->map(function ($group, $productId) {
            $current = (float) ($group->first()->cost_price ?? 0);
            $prices = $group->map(fn ($r) => (float) $r->predicted_price);
            $average = $prices->avg();
            $changePct = $current > 0 ? (($average - $current) / $current) * 100 : 0;

            return [
                'productId' => $productId,
                'productName' => $group->first()->product_name ?? 'Unknown product',
                'currentPrice' => $current,
                'estimatedLow' => $group->min(fn ($r) => (float) ($r->lower_bound ?? $r->predicted_price)),
                'estimatedHigh' => $group->max(fn ($r) => (float) ($r->upper_bound ?? $r->predicted_price)),
                'estimatedAverage' => round($average, 2),
                'trend' => $changePct > 0.5 ? 'up' : ($changePct < -0.5 ? 'down' : 'flat'),
                'changePct' => round($changePct, 1),
                'supplierName' => $group->first()->supplier_name ?? 'Unassigned',
                'series' => $group->map(fn ($r) => [
                    'label' => date('M', strtotime($r->forecast_date)),
                    'forecast' => (float) $r->predicted_price,
                    'low' => $r->lower_bound === null ? null : (float) $r->lower_bound,
                    'high' => $r->upper_bound === null ? null : (float) $r->upper_bound,
                ])->values(),
            ];
        })->values()->all();
    }

    private function costForecasts(string $business, string $runId): array
    {
        $rows = DB::table('cost_forecasts as f')
            ->join('products as p', 'p.product_id', '=', 'f.product_id')
            ->where('f.business_id', $business)
            ->where('f.forecast_run_id', $runId)
            ->where('f.forecast_date', '>=', now()->format('Y-m-d'))
            ->orderBy('f.forecast_date')
            ->select('f.product_id', 'f.forecasted_quantity', 'f.forecasted_unit_price', 'f.forecasted_total_cost', 'p.name as product_name', 'p.unit as product_unit')
            ->get()
            ->groupBy('product_id');

        // What was actually spent on each product over the 7 days before
        // today — the same length as the forecast horizon, so the two compare.
        $previous = DB::table('purchase_items as pi')
            ->join('purchases as pu', 'pu.purchase_id', '=', 'pi.purchase_id')
            ->where('pu.business_id', $business)
            ->where('pu.status', 'received')
            ->where('pu.purchase_date', '>=', now()->subDays(7)->format('Y-m-d'))
            ->where('pu.purchase_date', '<', now()->format('Y-m-d'))
            ->groupBy('pi.product_id')
            ->selectRaw('pi.product_id, SUM(pi.subtotal) as spent')
            ->pluck('spent', 'product_id');

        return $rows->map(function ($group, $productId) use ($previous) {
            $estimated = round($group->sum(fn ($r) => (float) $r->forecasted_total_cost));
            $prior = round((float) ($previous[$productId] ?? 0));
            $difference = $estimated - $prior;

            return [
                'productId' => $productId,
                'productName' => $group->first()->product_name ?? 'Unknown product',
                'unit' => $group->first()->product_unit ?? 'pcs',
                'forecastDemand' => round($group->sum(fn ($r) => (float) $r->forecasted_quantity)),
                'estimatedUnitPrice' => (float) $group->first()->forecasted_unit_price,
                'estimatedCost' => $estimated,
                'previousCost' => $prior,
                'difference' => $difference,
                'differencePct' => $prior > 0 ? round(($difference / $prior) * 100, 1) : 0,
            ];
        })->sortByDesc('estimatedCost')->values()->all();
    }
}
