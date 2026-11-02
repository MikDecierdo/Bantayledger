<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The demo Free/Plus plan shown for the project defense. It is only a label:
 * nothing else in the system reads it, so every store keeps every feature.
 */
class SubscriptionPlan
{
    /** Prices are set here, never by the client. */
    public const TERMS = [
        'weekly' => 39,
        'monthly' => 129,
        'yearly' => 1199,
    ];

    /** The end date of a term starting at $from. */
    public static function endOf(string $term, Carbon $from): Carbon
    {
        return match ($term) {
            'weekly' => $from->copy()->addWeek(),
            'monthly' => $from->copy()->addMonthNoOverflow(),
            'yearly' => $from->copy()->addYearNoOverflow(),
        };
    }

    /** Rows still running: not cancelled and not yet past their end date. */
    public static function active()
    {
        return DB::table('subscription_payments')
            ->whereNull('cancelled_at')
            ->where('expires_at', '>', now());
    }

    /** @param  Collection<int, string>  $businessIds @return array<string, true> businesses now on Plus */
    public static function plusAmong(Collection $businessIds): array
    {
        return self::active()->whereIn('business_id', $businessIds)->distinct()
            ->pluck('business_id')->mapWithKeys(fn ($id) => [$id => true])->all();
    }
}
