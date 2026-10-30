<?php

namespace App\Services;

use App\Support\Msg;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Generates demand/price/cost forecasts, alerts and recommendations from a
 * business's own sales and purchase history — plain statistics, no external
 * model. Forecasts and recommendations are replaced wholesale on each run (a
 * snapshot); alerts are reconciled so read state survives a re-run.
 */
class ForecastService
{
    public const MODEL_VERSION = 'stats-v1';

    private const HISTORY_DAYS = 28;
    private const HORIZON_DAYS = 7;
    private const STALE_AFTER_HOURS = 24;
    /** A run this recent is never redone on page open, so hopping between pages doesn't re-run it each time. */
    private const MIN_SECONDS_BETWEEN_RUNS = 60;

    // Price-vs-demand scenarios. `trend` is the last-7-day average over the
    // 28-day average, so 1.25 means sales are running 25% above normal.
    private const DEMAND_RISING = 1.25;
    private const DEMAND_SLOWING = 0.75;
    private const PRICE_GAP = 1.05;

    /** Latest received unit cost per product, loaded on first use. */
    private ?array $latestCost = null;

    public static function latestRun(string $business): ?object
    {
        return DB::table('forecast_runs')
            ->where('business_id', $business)
            ->where('status', 'succeeded')
            ->orderByDesc('completed_at')
            ->first();
    }

    /**
     * A run stays fresh while the records it read are unchanged (and it is under
     * a day old, because some figures depend on today's date). Anything recorded,
     * edited or deleted since then makes it stale, so pages that refresh "if
     * stale" on open pick up new data without a manual Refresh.
     */
    public static function isFresh(string $business): bool
    {
        $run = self::latestRun($business);
        if (! $run || ! $run->completed_at) {
            return false;
        }

        $completed = Carbon::parse($run->completed_at);
        if ($completed->lte(now()->subHours(self::STALE_AFTER_HOURS))) {
            return false;
        }
        if ($completed->gt(now()->subSeconds(self::MIN_SECONDS_BETWEEN_RUNS))) {
            return true;
        }

        return $run->fingerprint !== null && hash_equals($run->fingerprint, self::fingerprint($business));
    }

    /**
     * Hash of everything a run reads: row counts catch deletions, latest
     * timestamps catch edits, and purchase statuses catch pending -> received.
     */
    public static function fingerprint(string $business): string
    {
        $count = fn (string $table) => DB::table($table)->where('business_id', $business)->count();

        $parts = [
            'sales' => $count('sales'),
            'salesAt' => (string) DB::table('sales')->where('business_id', $business)->max('created_at'),
            'saleItems' => DB::table('sale_items as si')->join('sales as s', 's.sale_id', '=', 'si.sale_id')->where('s.business_id', $business)->count(),
            'purchases' => DB::table('purchases')->where('business_id', $business)->selectRaw("status, COUNT(*) as n")->groupBy('status')->orderBy('status')->pluck('n', 'status')->all(),
            'purchasesAt' => (string) DB::table('purchases')->where('business_id', $business)->max('created_at'),
            'purchaseItems' => DB::table('purchase_items as pi')->join('purchases as pu', 'pu.purchase_id', '=', 'pi.purchase_id')->where('pu.business_id', $business)->count(),
            'waste' => $count('waste_records'),
            'wasteAt' => (string) DB::table('waste_records')->where('business_id', $business)->max('created_at'),
            'moves' => $count('inventory_movements'),
            'movesAt' => (string) DB::table('inventory_movements')->where('business_id', $business)->max('created_at'),
            'products' => $count('products'),
            'productsAt' => (string) DB::table('products')->where('business_id', $business)->max('updated_at'),
            'suppliers' => $count('suppliers'),
            'suppliersAt' => (string) DB::table('suppliers')->where('business_id', $business)->max('updated_at'),
        ];

        return sha1(json_encode($parts));
    }

    /**
     * Returns null when $onlyIfStale is set and a recent run already exists.
     * The business row is locked first so two pages auto-refreshing at once
     * run one after the other, and the second sees the first's fresh result.
     */
    public static function run(string $business, bool $onlyIfStale = false): ?array
    {
        try {
            return DB::transaction(function () use ($business, $onlyIfStale) {
                DB::table('businesses')->where('business_id', $business)->lockForUpdate()->first();

                if ($onlyIfStale && self::isFresh($business)) {
                    return null;
                }

                // Taken before reading anything, so a change made while this run is
                // in progress still makes the next open regenerate.
                $fingerprint = self::fingerprint($business);

                $runId = (string) Str::uuid();
                DB::table('forecast_runs')->insert([
                    'forecast_run_id' => $runId,
                    'business_id' => $business,
                    'model_version' => self::MODEL_VERSION,
                    'status' => 'running',
                ]);

                $counts = (new self($business, $runId))->generate();

                $completedAt = now();
                DB::table('forecast_runs')->where('forecast_run_id', $runId)->update([
                    'status' => 'succeeded',
                    'fingerprint' => $fingerprint,
                    'completed_at' => $completedAt,
                ]);

                return [
                    'runId' => $runId,
                    'generatedAt' => $completedAt->format('Y-m-d H:i:s.v'),
                    'counts' => $counts,
                ];
            });
        } catch (Throwable $e) {
            DB::table('forecast_runs')->insert([
                'forecast_run_id' => (string) Str::uuid(),
                'business_id' => $business,
                'model_version' => self::MODEL_VERSION,
                'status' => 'failed',
                'completed_at' => now(),
                'error_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);
            throw $e;
        }
    }

    // ---------------------------------------------------------------------

    private Carbon $today;

    /** @var array<string, array{avg: float, total: float, confidence: float}> */
    private array $demand = [];

    /** @var array<string, array{first: float, changePct: float, confidence: float}> */
    private array $price = [];

    private function __construct(private string $business, private string $runId)
    {
        $this->today = now()->startOfDay();
    }

    private function generate(): array
    {
        foreach (['demand_forecasts', 'price_forecasts', 'cost_forecasts', 'recommendations'] as $table) {
            DB::table($table)->where('business_id', $this->business)->delete();
        }

        $products = DB::table('products as p')
            ->leftJoin('suppliers as s', 's.supplier_id', '=', 'p.supplier_id')
            ->where('p.business_id', $this->business)
            ->where('p.is_active', true)
            ->select('p.*', 's.name as supplier_name')
            ->get();

        $this->forecastDemand($products);
        $this->forecastPrices($products);
        $costCount = $this->forecastCosts($products);
        $alertCount = $this->reconcileAlerts($products);
        $recommendationCount = $this->writeRecommendations($products);

        return [
            'demand' => count($this->demand),
            'price' => count($this->price),
            'cost' => $costCount,
            'alerts' => $alertCount,
            'recommendations' => $recommendationCount,
        ];
    }

    // ---- Demand ------------------------------------------------------------

    private function forecastDemand(Collection $products): void
    {
        $since = $this->today->copy()->subDays(self::HISTORY_DAYS - 1);

        // Bucketed by the sale's own date, not when it was keyed in — a sale
        // entered today for yesterday belongs to yesterday.
        $sold = [];
        DB::table('sale_items as si')
            ->join('sales as s', 's.sale_id', '=', 'si.sale_id')
            ->where('s.business_id', $this->business)
            ->where('s.sale_date', '>=', $since->format('Y-m-d'))
            ->where('s.sale_date', '<=', $this->today->format('Y-m-d'))
            ->get(['si.product_id', 'si.quantity', 's.sale_date'])
            ->each(function ($r) use (&$sold) {
                $day = substr((string) $r->sale_date, 0, 10);
                $sold[$r->product_id][$day] = ($sold[$r->product_id][$day] ?? 0) + (float) $r->quantity;
            });

        $rows = [];
        foreach ($products as $p) {
            if (empty($sold[$p->product_id])) {
                continue;
            }

            // Days the product has existed within the window — a week-old
            // product's average shouldn't be diluted by 3 weeks of zeroes. A
            // sale can be dated before the product row's created_at (back-
            // dated entry), so start from whichever came first.
            $created = Carbon::parse($p->created_at)->startOfDay();
            $firstSale = Carbon::parse(min(array_keys($sold[$p->product_id])));
            $earliest = $created->lt($firstSale) ? $created : $firstSale;
            $start = $earliest->gt($since) ? $earliest : $since->copy();
            $days = [];
            for ($d = $start->copy(); $d->lte($this->today); $d->addDay()) {
                $days[] = $sold[$p->product_id][$d->format('Y-m-d')] ?? 0;
            }
            if (array_sum($days) <= 0) {
                continue;
            }

            $avg28 = array_sum($days) / count($days);
            $last7 = array_slice($days, -7);
            $avg7 = array_sum($last7) / count($last7);
            $avg = 0.6 * $avg7 + 0.4 * $avg28;
            $std = $this->stdDev($days);

            $saleDays = count(array_filter($days, fn ($q) => $q > 0));
            $confidence = min(90, 25 + $saleDays * 8 + min(count($days), self::HISTORY_DAYS));

            for ($i = 0; $i < self::HORIZON_DAYS; $i++) {
                $rows[] = [
                    'demand_forecast_id' => (string) Str::uuid(),
                    'business_id' => $this->business,
                    'product_id' => $p->product_id,
                    'forecast_run_id' => $this->runId,
                    'forecast_date' => $this->today->copy()->addDays($i)->format('Y-m-d'),
                    'predicted_quantity' => round($avg, 3),
                    'lower_bound' => round(max(0, $avg - $std), 3),
                    'upper_bound' => round($avg + $std, 3),
                    'confidence' => $confidence,
                    'model_version' => self::MODEL_VERSION,
                ];
            }

            $this->demand[$p->product_id] = [
                'avg' => $avg,
                'total' => $avg * self::HORIZON_DAYS,
                'confidence' => $confidence,
                'trend' => $avg28 > 0 ? $avg7 / $avg28 : null,
            ];
        }

        if ($rows) {
            DB::table('demand_forecasts')->insert($rows);
        }
    }

    // ---- Supplier price ----------------------------------------------------

    private function forecastPrices(Collection $products): void
    {
        $history = [];
        DB::table('purchase_items as pi')
            ->join('purchases as pu', 'pu.purchase_id', '=', 'pi.purchase_id')
            ->where('pu.business_id', $this->business)
            ->where('pu.status', 'received')
            ->get(['pi.product_id', 'pi.unit_cost', 'pu.purchase_date'])
            ->each(function ($r) use (&$history) {
                $day = substr((string) $r->purchase_date, 0, 10);
                $history[$r->product_id][$day][] = (float) $r->unit_cost;
            });

        $rows = [];
        foreach ($products as $p) {
            // A trend needs at least two distinct purchase dates.
            if (count($history[$p->product_id] ?? []) < 2) {
                continue;
            }

            ksort($history[$p->product_id]);
            $first = Carbon::parse(array_key_first($history[$p->product_id]));
            $xs = [];
            $ys = [];
            foreach ($history[$p->product_id] as $day => $costs) {
                $xs[] = (float) $first->diffInDays(Carbon::parse($day));
                $ys[] = array_sum($costs) / count($costs);
            }

            [$slope, $intercept] = $this->linearFit($xs, $ys);
            $residuals = array_map(fn ($x, $y) => $y - ($intercept + $slope * $x), $xs, $ys);
            $spread = $this->stdDev($residuals);
            $confidence = min(85, 30 + count($xs) * 10);

            // A straight line through a few purchases weeks apart says little
            // about three months out, so: start from the latest actual price,
            // apply half the fitted trend per month, and cap that drift at 5%
            // of the latest price per month.
            $latest = end($ys);
            $monthlyDrift = max(-0.05 * $latest, min(0.05 * $latest, $slope * 30 * 0.5));

            $predictions = [];
            foreach ([1, 2, 3] as $month) {
                $date = $this->today->copy()->addDays(30 * $month);
                $predicted = max(0, $latest + $monthlyDrift * $month);
                $band = max($spread, $predicted * 0.02) * (1 + 0.25 * ($month - 1));
                $predictions[] = $predicted;

                $rows[] = [
                    'price_forecast_id' => (string) Str::uuid(),
                    'business_id' => $this->business,
                    'product_id' => $p->product_id,
                    'forecast_run_id' => $this->runId,
                    'forecast_date' => $date->format('Y-m-d'),
                    'predicted_price' => round($predicted, 2),
                    'lower_bound' => round(max(0, $predicted - $band), 2),
                    'upper_bound' => round($predicted + $band, 2),
                    'confidence' => $confidence,
                    'model_version' => self::MODEL_VERSION,
                ];
            }

            // Same comparison SignalController makes (against cost_price), so
            // alert/recommendation wording matches what the page shows.
            $current = (float) $p->cost_price;
            $average = array_sum($predictions) / count($predictions);
            $this->price[$p->product_id] = [
                'first' => $predictions[0],
                'changePct' => $current > 0 ? (($average - $current) / $current) * 100 : 0,
                'confidence' => $confidence,
            ];
        }

        if ($rows) {
            DB::table('price_forecasts')->insert($rows);
        }
    }

    // ---- Purchasing cost ---------------------------------------------------

    private function forecastCosts(Collection $products): int
    {
        $rows = [];
        foreach ($products as $p) {
            if (! isset($this->demand[$p->product_id])) {
                continue;
            }

            $quantity = round($this->demand[$p->product_id]['total'], 3);
            $unitPrice = round($this->price[$p->product_id]['first'] ?? (float) $p->cost_price, 2);

            $rows[] = [
                'cost_forecast_id' => (string) Str::uuid(),
                'business_id' => $this->business,
                'product_id' => $p->product_id,
                'forecast_run_id' => $this->runId,
                'forecast_date' => $this->today->format('Y-m-d'),
                'forecasted_quantity' => $quantity,
                'forecasted_unit_price' => $unitPrice,
                'forecasted_total_cost' => round($quantity * $unitPrice, 2),
                'confidence' => $this->demand[$p->product_id]['confidence'],
                'model_version' => self::MODEL_VERSION,
            ];
        }

        if ($rows) {
            DB::table('cost_forecasts')->insert($rows);
        }

        return count($rows);
    }

    // ---- Alerts ------------------------------------------------------------

    /**
     * Titles are deliberately free of changing numbers (those go in the
     * message) — alerts are matched across runs on product + type + English
     * title, so a stable title is what keeps a read alert read. Sentences are
     * Msg templates: the English text is stored in the plain columns and the
     * template + parameters in `i18n`, so each reader sees their own language.
     */
    private function reconcileAlerts(Collection $products): int
    {
        $desired = [];
        $add = function (?string $productId, string $type, string $severity, Msg $title, Msg $message) use (&$desired) {
            $desired[($productId ?? '') . '|' . $type . '|' . $title] = compact('productId', 'type', 'severity', 'title', 'message');
        };

        foreach ($products as $p) {
            $stock = (float) $p->current_stock;
            $minimum = (float) $p->minimum_stock;
            $unit = $p->unit;
            $status = InventoryService::computeStatus($stock, $minimum);

            if ($status === 'out') {
                $add($p->product_id, 'Inventory', 'critical', Msg::of(':name is out of stock', ['name' => $p->name]),
                    Msg::of('You have no :unit of :name left. Restock soon to avoid missed sales.', ['unit' => $unit, 'name' => $p->name]));
            } elseif ($status === 'critical') {
                $add($p->product_id, 'Inventory', 'critical', Msg::of(':name is critically low', ['name' => $p->name]),
                    Msg::of('Only :qty :unit left — at or below half your minimum of :min.', ['qty' => $this->qty($stock), 'unit' => $unit, 'min' => $this->qty($minimum)]));
            } elseif ($status === 'low') {
                $add($p->product_id, 'Inventory', 'warning', Msg::of(':name is running low', ['name' => $p->name]),
                    Msg::of(':qty :unit left, below your minimum of :min.', ['qty' => $this->qty($stock), 'unit' => $unit, 'min' => $this->qty($minimum)]));
            }

            $avg = $this->demand[$p->product_id]['avg'] ?? 0;
            if ($status !== 'out' && $avg > 0 && $stock / $avg < 3) {
                $days = max(1, (int) floor($stock / $avg));
                $add($p->product_id, 'Inventory', 'warning', Msg::of(':name may run out within 3 days', ['name' => $p->name]),
                    $days === 1
                        ? Msg::of('At about :avg :unit sold per day, your :qty :unit will last roughly 1 day.', ['avg' => $this->qty($avg), 'unit' => $unit, 'qty' => $this->qty($stock)])
                        : Msg::of('At about :avg :unit sold per day, your :qty :unit will last roughly :days days.', ['avg' => $this->qty($avg), 'unit' => $unit, 'qty' => $this->qty($stock), 'days' => $days]));
            }

            $change = $this->price[$p->product_id]['changePct'] ?? 0;
            if ($change > 5) {
                $add($p->product_id, 'Pricing', 'warning', Msg::of(':name supplier price is rising', ['name' => $p->name]),
                    Msg::of('Your purchase history points to a supplier price about :pct% above your current cost over the next quarter.', ['pct' => round($change, 1)]));
            }

            if ($this->squeezedByReplacement($p)) {
                $add($p->product_id, 'Pricing', 'warning', Msg::of('Restocking :name will cost more than your selling price covers', ['name' => $p->name]),
                    Msg::of('You sell at :sell but restocking is heading to about :replacement.', ['sell' => $this->peso((float) $p->selling_price), 'replacement' => $this->peso((float) $this->replacementCost($p))]));
            }
        }

        DB::table('purchases')
            ->where('business_id', $this->business)
            ->where('status', 'pending')
            ->where('purchase_date', '<', $this->today->copy()->subDays(7)->format('Y-m-d'))
            ->get(['purchase_id', 'reference', 'purchase_date'])
            ->each(function ($pu) use ($add) {
                $ref = $pu->reference ?: strtoupper(substr($pu->purchase_id, 0, 8));
                $add(null, 'Supplier', 'info', Msg::of('Purchase :ref is still pending', ['ref' => $ref]),
                    Msg::of('Ordered on :date and not yet marked received. Follow up with the supplier or mark it received.', ['date' => ['date' => substr((string) $pu->purchase_date, 0, 10)]]));
            });

        $existing = DB::table('alerts')->where('business_id', $this->business)
            ->get(['alert_id', 'product_id', 'type', 'title', 'severity', 'message']);
        $existingKeys = [];
        foreach ($existing as $a) {
            $key = ($a->product_id ?? '') . '|' . $a->type . '|' . $a->title;
            if (! isset($desired[$key])) {
                DB::table('alerts')->where('alert_id', $a->alert_id)->delete();
                continue;
            }
            $existingKeys[$key] = true;
            // Same alert, possibly with fresher numbers — update the wording
            // but leave is_read alone.
            $want = $desired[$key];
            DB::table('alerts')->where('alert_id', $a->alert_id)->update([
                'message' => (string) $want['message'],
                'severity' => $want['severity'],
                'i18n' => $this->specs(['title' => $want['title'], 'message' => $want['message']]),
            ]);
        }

        foreach ($desired as $key => $a) {
            if (isset($existingKeys[$key])) {
                continue;
            }
            DB::table('alerts')->insert([
                'alert_id' => (string) Str::uuid(),
                'business_id' => $this->business,
                'product_id' => $a['productId'],
                'type' => $a['type'],
                'severity' => $a['severity'],
                'title' => (string) $a['title'],
                'message' => (string) $a['message'],
                'i18n' => $this->specs(['title' => $a['title'], 'message' => $a['message']]),
            ]);
        }

        return count($desired);
    }

    /** JSON of the translatable sentences, for the `i18n` columns. */
    private function specs(array $messages): string
    {
        return json_encode(array_map(fn ($m) => $m instanceof Msg ? $m->toArray() : $m, $messages), JSON_UNESCAPED_UNICODE);
    }

    /** A recommendation row: English text in the plain columns, templates in `i18n`. */
    private function rec(string $productId, string $type, string $severity, Msg $title, Msg $message, Msg $reason, Msg $action, float|int $confidence, array $extra = []): array
    {
        return [
            'product_id' => $productId,
            'type' => $type,
            'severity' => $severity,
            'title' => (string) $title,
            'message' => (string) $message,
            'reason' => (string) $reason,
            'action' => (string) $action,
            'confidence' => $confidence,
            'i18n' => $this->specs(['title' => $title, 'message' => $message, 'reason' => $reason, 'action' => $action]),
        ] + $extra;
    }

    // ---- Recommendations ---------------------------------------------------

    private function writeRecommendations(Collection $products): int
    {
        $recs = [];

        $lastSale = DB::table('sale_items as si')
            ->join('sales as s', 's.sale_id', '=', 'si.sale_id')
            ->where('s.business_id', $this->business)
            ->groupBy('si.product_id')
            ->selectRaw('si.product_id, MAX(s.sale_date) as last_sale')
            ->pluck('last_sale', 'product_id');

        $waste = DB::table('waste_records')
            ->where('business_id', $this->business)
            ->where('waste_date', '>=', $this->today->copy()->subDays(30)->format('Y-m-d'))
            ->groupBy('product_id')
            ->selectRaw('product_id, SUM(quantity) as qty, SUM(estimated_cost) as cost')
            ->get()
            ->keyBy('product_id');

        foreach ($products as $p) {
            $stock = (float) $p->current_stock;
            $minimum = (float) $p->minimum_stock;
            $cost = (float) $p->cost_price;
            $sell = (float) $p->selling_price;
            $unit = $p->unit;
            $name = $p->name;
            $status = InventoryService::computeStatus($stock, $minimum);
            $demand = $this->demand[$p->product_id] ?? null;
            $avg = $demand['avg'] ?? 0;
            $daysCover = $avg > 0 ? $stock / $avg : null;
            $supplier = $p->supplier_name;

            // Reorder
            $lowStock = in_array($status, ['out', 'critical', 'low'], true);
            if ($lowStock || ($daysCover !== null && $daysCover < 7)) {
                $quantity = max((float) $p->reorder_quantity, ceil($avg * 14 - $stock), 1);
                $reason = $daysCover !== null
                    ? Msg::of('At your current pace of about :avg :unit a day, your :qty :unit will last roughly :days days. Running out means missed sales.', ['avg' => $this->qty($avg), 'unit' => $unit, 'qty' => $this->qty($stock), 'days' => round($daysCover, 1)])
                    : Msg::of('Stock is :qty :unit against your minimum of :min. Running out means missed sales.', ['qty' => $this->qty($stock), 'unit' => $unit, 'min' => $this->qty($minimum)]);

                $recs[] = $this->rec($p->product_id, 'Purchasing', in_array($status, ['out', 'critical'], true) ? 'high' : 'medium',
                    Msg::of('Time to restock :name', ['name' => $name]),
                    Msg::of('Order about :qty :unit of :name to cover the next two weeks.', ['qty' => $this->qty($quantity), 'unit' => $unit, 'name' => $name]),
                    $reason,
                    $supplier
                        ? Msg::of('Place a purchase order for :qty :unit from :supplier.', ['qty' => $this->qty($quantity), 'unit' => $unit, 'supplier' => $supplier])
                        : Msg::of('Place a purchase order for :qty :unit.', ['qty' => $this->qty($quantity), 'unit' => $unit]),
                    $demand['confidence'] ?? 80);
            }

            // Buy ahead of a rising supplier price
            $change = $this->price[$p->product_id]['changePct'] ?? 0;
            if ($change > 5) {
                $recs[] = $this->rec($p->product_id, 'Purchasing', 'medium',
                    Msg::of('Buy :name before the price rises', ['name' => $name]),
                    Msg::of('Supplier cost for :name is trending up.', ['name' => $name]),
                    Msg::of('Your purchase history points to about :pct% higher cost over the next quarter.', ['pct' => round($change, 1)]),
                    Msg::of('Consider stocking up on your next order while the cost is still :cost.', ['cost' => $this->peso($cost)]),
                    $this->price[$p->product_id]['confidence']);
            }

            // Slow mover — skip products too new to judge
            $last = $lastSale[$p->product_id] ?? null;
            $old = Carbon::parse($p->created_at)->lt($this->today->copy()->subDays(14));
            if ($stock > 0 && $old && (! $last || Carbon::parse($last)->lt($this->today->copy()->subDays(30)))) {
                $recs[] = $this->rec($p->product_id, 'Sales', 'low',
                    Msg::of(":name hasn't sold in 30 days", ['name' => $name]),
                    Msg::of(':qty :unit of :name is sitting on the shelf.', ['qty' => $this->qty($stock), 'unit' => $unit, 'name' => $name]),
                    Msg::of("That's about :value of stock (at cost) not turning into sales.", ['value' => $this->peso($stock * $cost)]),
                    Msg::of('Try a promo, bundle, or better shelf placement, and wait before restocking for now.'),
                    70);
            }

            // Spoiled or damaged
            if (isset($waste[$p->product_id]) && (float) $waste[$p->product_id]->qty > 0) {
                $w = $waste[$p->product_id];
                $recs[] = $this->rec($p->product_id, 'Waste', 'medium',
                    Msg::of('Fewer spoiled or damaged :name', ['name' => $name]),
                    Msg::of(':qty :unit of :name spoiled or got damaged in the last 30 days.', ['qty' => $this->qty((float) $w->qty), 'unit' => $unit, 'name' => $name]),
                    Msg::of("That's :cost lost.", ['cost' => $this->peso((float) $w->cost)]),
                    Msg::of('Order smaller batches more often, and check storage and expiry dates.'),
                    75);
            }

            // Price vs demand: cheap stock on hand while demand and prices are up,
            // or costly stock on hand while demand is falling.
            $trend = $demand['trend'] ?? null;
            $replacement = $this->replacementCost($p);
            $demandPct = $trend !== null ? (int) round(abs($trend - 1) * 100) : 0;
            // Running short is a real need to buy, so it outranks "hold off".
            $needsReorder = $lowStock || ($daysCover !== null && $daysCover < 7);
            $explainedMargin = false;

            if ($trend !== null && $replacement !== null && $cost > 0) {
                if ($trend >= self::DEMAND_RISING && $replacement > $cost * self::PRICE_GAP) {
                    $recs[] = $this->rec($p->product_id, 'Purchasing', ($daysCover !== null && $daysCover < 7) ? 'high' : 'medium',
                        Msg::of('Stock up on :name while your cost is low', ['name' => $name]),
                        Msg::of('Sales of :name are up :pct% on your 4-week average, and restocking is heading to about :replacement.', ['name' => $name, 'pct' => $demandPct, 'replacement' => $this->peso($replacement)]),
                        Msg::of('Your current cost is :cost, so stock bought now is cheaper than stock bought later.', ['cost' => $this->peso($cost)]),
                        $supplier
                            ? Msg::of('Order ahead from :supplier while the price is still near :cost.', ['supplier' => $supplier, 'cost' => $this->peso($cost)])
                            : Msg::of('Order ahead while the price is still near :cost.', ['cost' => $this->peso($cost)]),
                        $demand['confidence'] ?? 70);

                    if ($sell < $replacement * 1.25) {
                        $explainedMargin = true;
                        $recs[] = $this->rec($p->product_id, 'Pricing', 'medium',
                            Msg::of('Your profit on :name relies on cheaper old stock', ['name' => $name]),
                            Msg::of('You sell at :sell, but the next batch is likely to cost about :replacement.', ['sell' => $this->peso($sell), 'replacement' => $this->peso($replacement)]),
                            Msg::of('Demand is strong, so a small price rise is less likely to cost you sales.'),
                            Msg::of('About :price keeps a 20% profit once you restock.', ['price' => $this->peso(ceil($replacement * 1.25))]),
                            $demand['confidence'] ?? 70);
                    }
                }

                $priceRising = ($this->price[$p->product_id]['changePct'] ?? 0) > 5;
                if ($trend <= self::DEMAND_SLOWING && $stock > 0 && ! $needsReorder && ($cost > $replacement * self::PRICE_GAP || $priceRising)) {
                    $recs[] = $this->rec($p->product_id, 'Purchasing', 'medium',
                        Msg::of('Wait before restocking :name', ['name' => $name]),
                        Msg::of('Sales of :name are down :pct% on your 4-week average.', ['name' => $name, 'pct' => $demandPct]),
                        Msg::of('You already hold about :value of it at cost, and buying more now ties up cash.', ['value' => $this->peso($stock * $cost)]),
                        Msg::of('Wait until sales pick up before placing the next order.'),
                        $demand['confidence'] ?? 70);

                    if ($cost > $replacement * self::PRICE_GAP) {
                        $recs[] = $this->rec($p->product_id, 'Sales', 'low',
                            Msg::of('Clear costly stock of :name', ['name' => $name]),
                            Msg::of('You paid about :cost each, but it now costs about :replacement to restock.', ['cost' => $this->peso($cost), 'replacement' => $this->peso($replacement)]),
                            Msg::of('Demand is slowing while newer stock would be cheaper, so the older units are the ones losing value.'),
                            Msg::of('Try a promo or bundle to sell the older stock, then restock at the lower price.'),
                            $demand['confidence'] ?? 70);
                    }
                }
            }

            // Profit against what restocking will cost (the cost-based rule below covers today's cost)
            if (! $explainedMargin && $this->squeezedByReplacement($p)) {
                $below = $sell < (float) $replacement;
                $recs[] = $this->rec($p->product_id, 'Pricing', $below ? 'high' : 'medium',
                    Msg::of('Restocking :name will cost more than your selling price covers', ['name' => $name]),
                    Msg::of('You sell at :sell but restocking is heading to about :replacement.', ['sell' => $this->peso($sell), 'replacement' => $this->peso((float) $replacement)]),
                    $below ? Msg::of('Every unit from the next order would sell at a loss.') : Msg::of('Your profit on the next order will be very small.'),
                    Msg::of('Raise the selling price to about :price for a 20% profit on the next batch.', ['price' => $this->peso(ceil((float) $replacement * 1.25))]),
                    $this->price[$p->product_id]['confidence'] ?? 70);
            }

            // Profit today
            if ($cost > 0 && $sell < $cost * 1.10) {
                $below = $sell < $cost;
                $margin = $sell > 0 ? round((($sell - $cost) / $sell) * 100, 1) : -100;
                $recs[] = $this->rec($p->product_id, 'Pricing', $below ? 'high' : 'medium',
                    $below ? Msg::of(':name sells below cost', ['name' => $name]) : Msg::of('Profit on :name is very small', ['name' => $name]),
                    Msg::of('You sell at :sell but it costs :cost.', ['sell' => $this->peso($sell), 'cost' => $this->peso($cost)]),
                    Msg::of("That's a profit of :margin% on every sale.", ['margin' => $margin]),
                    Msg::of('Review the selling price — about :price gives a 20% profit.', ['price' => $this->peso(ceil($cost * 1.25))]),
                    90);
            }
        }

        foreach ($this->trendingInsights($products) as $rec) {
            $recs[] = $rec;
        }

        // Newest-first is how insights are listed, so give the most
        // important ones the latest timestamps.
        $rank = ['high' => 0, 'medium' => 1, 'low' => 2];
        usort($recs, fn ($a, $b) => $rank[$a['severity']] <=> $rank[$b['severity']]);

        $base = now();
        foreach ($recs as $i => $r) {
            DB::table('recommendations')->insert($r + [
                'recommendation_id' => (string) Str::uuid(),
                'business_id' => $this->business,
                'forecast_run_id' => $this->runId,
                'created_at' => $base->copy()->subMilliseconds($i)->format('Y-m-d H:i:s.v'),
            ]);
        }

        return count($recs);
    }

    // ---- Top sellers and why -----------------------------------------------

    private const TREND_GROWTH = 0.30;
    private const TREND_MIN_UNITS = 5;
    private const TOP_SELLERS = 3;

    /**
     * Insights for the week's best sellers: how much they sold, whether that is
     * a jump on the week before, and a plain-language reason (the shop's own
     * history for this time of year, else a general seasonal guide).
     */
    private function trendingInsights(Collection $products): array
    {
        $weekStart = $this->today->copy()->subDays(6)->format('Y-m-d');
        $prevStart = $this->today->copy()->subDays(13)->format('Y-m-d');
        $today = $this->today->format('Y-m-d');

        $rows = DB::table('sale_items as si')
            ->join('sales as s', 's.sale_id', '=', 'si.sale_id')
            ->where('s.business_id', $this->business)
            ->where('s.sale_date', '>=', $prevStart)
            ->where('s.sale_date', '<=', $today)
            ->get(['si.product_id', 'si.quantity', 'si.unit_price', 's.sale_date']);

        $stats = [];
        $totalRevenue = 0.0;
        foreach ($rows as $r) {
            $current = substr((string) $r->sale_date, 0, 10) >= $weekStart;
            $key = $current ? 'now' : 'prev';
            $stats[$r->product_id][$key . 'Units'] = ($stats[$r->product_id][$key . 'Units'] ?? 0) + (float) $r->quantity;
            if ($current) {
                $revenue = (float) $r->quantity * (float) $r->unit_price;
                $stats[$r->product_id]['revenue'] = ($stats[$r->product_id]['revenue'] ?? 0) + $revenue;
                $totalRevenue += $revenue;
            }
        }
        if (! $stats) {
            return [];
        }

        $byId = $products->keyBy('product_id');
        $categories = DB::table('categories')->where('business_id', $this->business)->pluck('name', 'category_id');

        // Top sellers by revenue, plus anything surging, each with enough sales to mean something.
        $candidates = [];
        foreach ($stats as $id => $st) {
            $now = $st['nowUnits'] ?? 0;
            $prev = $st['prevUnits'] ?? 0;
            if (! isset($byId[$id]) || $now < self::TREND_MIN_UNITS) {
                continue;
            }
            $growth = $prev > 0 ? ($now - $prev) / $prev : null;
            $candidates[$id] = $st + ['growth' => $growth, 'trending' => $growth === null || $growth >= self::TREND_GROWTH];
        }
        uasort($candidates, fn ($a, $b) => ($b['revenue'] ?? 0) <=> ($a['revenue'] ?? 0));
        $chosen = array_slice(array_keys($candidates), 0, self::TOP_SELLERS);

        $recs = [];
        foreach ($chosen as $id) {
            $p = $byId[$id];
            $c = $candidates[$id];
            $now = $c['nowUnits'];
            $prev = $c['prevUnits'] ?? 0;
            $growthPct = $c['growth'] !== null ? (int) round($c['growth'] * 100) : null;
            $trending = $c['trending'];
            $share = $totalRevenue > 0 ? round(($c['revenue'] / $totalRevenue) * 100) : 0;
            $unit = $p->unit;

            $avg = $this->demand[$id]['avg'] ?? 0;
            $stock = (float) $p->current_stock;
            $daysLeft = $avg > 0 ? round($stock / $avg, 1) : null;

            $explain = SeasonKnowledge::explain($p->name, $categories[$p->category_id] ?? null, $this->today, $this->sameMonthHistory($id));

            if ($trending && $growthPct !== null) {
                $title = Msg::of(':name is trending: up :pct% this week', ['name' => $p->name, 'pct' => $growthPct]);
            } elseif ($trending) {
                $title = Msg::of(':name is a new best seller this week', ['name' => $p->name]);
            } else {
                $title = Msg::of(':name is one of your top sellers this week', ['name' => $p->name]);
            }

            $source = $explain['source'] === 'your records'
                ? Msg::of('(From your own sales history.)')
                : Msg::of('(General knowledge, not verified for your area.)');
            $reason = $explain['benefit']
                ? Msg::of(':why :benefit :source', ['why' => $explain['why'], 'benefit' => $explain['benefit'], 'source' => $source])
                : Msg::of(':why :source', ['why' => $explain['why'], 'source' => $source]);

            $action = $daysLeft !== null && $daysLeft < 10
                ? Msg::of("Check your stock — about :days days left at this pace. Restock soon so you don't miss sales.", ['days' => $daysLeft])
                : ($trending
                    ? Msg::of('Keep it well stocked and visible while demand is up; check the supplier price before a big order.')
                    : Msg::of('Keep it well stocked and near the counter; it is carrying a large part of your sales.'));

            $message = $prev > 0
                ? Msg::of("You sold :now :unit of :name in the last 7 days versus :prev the week before, about :share% of this week's sales.", ['now' => $this->qty($now), 'unit' => $unit, 'name' => $p->name, 'prev' => $this->qty($prev), 'share' => $share])
                : Msg::of("You sold :now :unit of :name in the last 7 days, about :share% of this week's sales.", ['now' => $this->qty($now), 'unit' => $unit, 'name' => $p->name, 'share' => $share]);

            $seasonalWord = ['yes' => 'Yes', 'maybe' => 'Maybe', 'no' => 'No'][$explain['seasonal']] ?? 'No';
            $supporting = [
                ['label' => Msg::of('Sold this week'), 'value' => Msg::of(':qty :unit', ['qty' => $this->qty($now), 'unit' => $unit])],
                ['label' => Msg::of('Week before'), 'value' => Msg::of(':qty :unit', ['qty' => $this->qty($prev), 'unit' => $unit])],
                ['label' => Msg::of('Change'), 'value' => $growthPct === null ? Msg::of('New') : (($growthPct > 0 ? '+' : '') . $growthPct . '%')],
                ['label' => Msg::of('Share of sales'), 'value' => $share . '%'],
                ['label' => Msg::of('Seasonal?'), 'value' => Msg::of($seasonalWord)],
            ];
            if ($daysLeft !== null) {
                $supporting[] = ['label' => Msg::of('Stock lasts'), 'value' => Msg::of(':days days', ['days' => $daysLeft])];
            }
            $supportingStored = array_map(fn ($row) => [
                'label' => $row['label']->toArray(),
                'value' => $row['value'] instanceof Msg ? $row['value']->toArray() : $row['value'],
            ], $supporting);

            $recs[] = $this->rec($id, 'Sales', $trending ? 'medium' : 'low', $title, $message, $reason, $action,
                $explain['source'] === 'your records' ? 85 : 65,
                ['topic' => 'trending', 'supporting' => json_encode($supportingStored, JSON_UNESCAPED_UNICODE)]);
        }

        return $recs;
    }

    /** Months (other than the current one's recent weeks) in which this product sold well before. */
    private function sameMonthHistory(string $productId): ?array
    {
        $rows = DB::table('sale_items as si')
            ->join('sales as s', 's.sale_id', '=', 'si.sale_id')
            ->where('s.business_id', $this->business)
            ->where('si.product_id', $productId)
            ->where('s.sale_date', '<', $this->today->copy()->startOfMonth()->format('Y-m-d'))
            ->selectRaw("DATE_FORMAT(s.sale_date, '%Y-%m') as ym, SUM(si.quantity) as units")
            ->groupBy('ym')
            ->get();

        if ($rows->count() < 2) {
            return null; // not enough history to call anything a pattern
        }

        $avg = $rows->avg('units');
        $strong = $rows->filter(fn ($r) => (float) $r->units >= $avg * 1.25)
            ->map(fn ($r) => Carbon::createFromFormat('Y-m', $r->ym)->format('F'))
            ->unique()->values()->all();

        return $strong ? ['months' => $strong] : null;
    }

    // ---- Price vs demand ---------------------------------------------------

    /** What restocking is likely to cost: next month's forecast, else the last price paid. */
    private function replacementCost(object $p): ?float
    {
        if (isset($this->price[$p->product_id]['first'])) {
            return (float) $this->price[$p->product_id]['first'];
        }

        if ($this->latestCost === null) {
            $this->latestCost = [];
            DB::table('purchase_items as pi')
                ->join('purchases as pu', 'pu.purchase_id', '=', 'pi.purchase_id')
                ->where('pu.business_id', $this->business)
                ->where('pu.status', 'received')
                ->orderBy('pu.purchase_date')
                ->orderBy('pu.created_at')
                ->get(['pi.product_id', 'pi.unit_cost'])
                ->each(function ($r) {
                    $this->latestCost[$r->product_id] = (float) $r->unit_cost;
                });
        }

        return $this->latestCost[$p->product_id] ?? null;
    }

    /** True when what you charge no longer covers what it costs to restock (and the cost-based margin rule isn't already warning). */
    private function squeezedByReplacement(object $p): bool
    {
        $replacement = $this->replacementCost($p);
        $sell = (float) $p->selling_price;
        $cost = (float) $p->cost_price;

        if ($replacement === null || $replacement <= 0 || $sell >= $replacement * 1.10) {
            return false;
        }

        return ! ($cost > 0 && $sell < $cost * 1.10);
    }

    // ---- Helpers -----------------------------------------------------------

    private function stdDev(array $values): float
    {
        $n = count($values);
        if ($n < 2) {
            return 0.0;
        }
        $mean = array_sum($values) / $n;
        $sq = array_sum(array_map(fn ($v) => ($v - $mean) ** 2, $values));

        return sqrt($sq / $n);
    }

    /** Least-squares line through (x, y); returns [slope, intercept]. */
    private function linearFit(array $xs, array $ys): array
    {
        $n = count($xs);
        $mx = array_sum($xs) / $n;
        $my = array_sum($ys) / $n;
        $num = 0.0;
        $den = 0.0;
        foreach ($xs as $i => $x) {
            $num += ($x - $mx) * ($ys[$i] - $my);
            $den += ($x - $mx) ** 2;
        }
        $slope = $den > 0 ? $num / $den : 0.0;

        return [$slope, $my - $slope * $mx];
    }

    private function qty(float $v): string
    {
        return floor($v) == $v ? number_format($v) : number_format($v, 1);
    }

    private function peso(float $v): string
    {
        return '₱' . number_format($v, 2);
    }
}
