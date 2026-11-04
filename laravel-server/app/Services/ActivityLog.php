<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Adds one entry to the activity log. Call it inside the same transaction as the
 * change it describes: if the entry can't be saved the change doesn't happen, so
 * nothing goes unlogged, and a change that's rolled back leaves no entry.
 *
 * It stores codes rather than sentences, so the app can show them in any language.
 */
class ActivityLog
{
    public const PRICE = 'price';

    public const STOCK = 'stock';

    public const EXPENSE = 'expense';

    /**
     * @param  array{subjectId?: ?string, subject: string, old?: ?float, new?: ?float, unit?: ?string, notes?: ?string, recordDate?: ?string}  $entry
     */
    public static function record(string $businessId, string $category, string $action, array $entry): void
    {
        $user = request()->user();
        $notes = $entry['notes'] ?? null;

        DB::table('activity_logs')->insert([
            'business_id' => $businessId,
            'user_id' => $user?->user_id,
            'actor_name' => $user?->name,
            'category' => $category,
            'action' => $action,
            'subject_id' => $entry['subjectId'] ?? null,
            'subject_name' => Str::limit($entry['subject'], 297),
            'old_value' => $entry['old'] ?? null,
            'new_value' => $entry['new'] ?? null,
            'unit' => $entry['unit'] ?? null,
            'notes' => $notes === null ? null : Str::limit($notes, 497),
            'record_date' => $entry['recordDate'] ?? null,
            'created_at' => now(),
        ]);
    }

    /** True when two prices differ once rounded to the centavo. */
    public static function priceChanged(float $old, float $new): bool
    {
        return round($old, 2) !== round($new, 2);
    }
}
