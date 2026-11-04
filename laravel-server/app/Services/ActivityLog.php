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

    public const SALE = 'sale';

    public const PURCHASE = 'purchase';

    public const PRODUCT = 'product';

    public const STAFF = 'staff';

    /** Store details, categories, suppliers, events and the plan. */
    public const STORE = 'store';

    /** Signing in and out. */
    public const ACCOUNT = 'account';

    /**
     * `actor` names who did it when the request isn't signed in yet (signing in).
     *
     * @param  array{subjectId?: ?string, subject: string, old?: ?float, new?: ?float, unit?: ?string, notes?: ?string, recordDate?: ?string, actor?: object}  $entry
     */
    public static function record(string $businessId, string $category, string $action, array $entry): void
    {
        $user = $entry['actor'] ?? request()->user();
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

    /**
     * The fields whose value really changed, as codes, e.g. "unit,minimum_stock".
     * `$fields` maps a code to [old value, new value]; numbers compare by value,
     * so 10 and "10.000" count as the same.
     *
     * @param  array<string, array{0: mixed, 1: mixed}>  $fields
     */
    public static function changedFields(array $fields): string
    {
        $changed = [];
        foreach ($fields as $code => [$old, $new]) {
            // A switch arrives as true/false but is stored as 1/0.
            $old = is_bool($old) ? (int) $old : $old;
            $new = is_bool($new) ? (int) $new : $new;
            if (is_numeric($old) && is_numeric($new)) {
                $same = round((float) $old, 3) === round((float) $new, 3);
            } else {
                $same = trim((string) $old) === trim((string) $new);
            }
            if (! $same) {
                $changed[] = $code;
            }
        }

        return implode(',', $changed);
    }

    /**
     * A short, language-free summary of a sale's or purchase's items, such as
     * "Coke 1.5L ×2, Pancit Canton ×5 +3", to name it in the log.
     */
    public static function itemSummary(string $table, string $key, string $id): string
    {
        $rows = DB::table("{$table} as i")
            ->join('products as p', 'p.product_id', '=', 'i.product_id')
            ->where("i.{$key}", $id)
            ->get(['p.name', 'i.quantity']);

        $parts = $rows->take(2)->map(function ($row) {
            $qty = rtrim(rtrim(number_format((float) $row->quantity, 3, '.', ''), '0'), '.');

            return "{$row->name} ×{$qty}";
        })->all();
        $summary = implode(', ', $parts);
        if ($rows->count() > 2) {
            $summary .= ' +'.($rows->count() - 2);
        }

        return $summary !== '' ? $summary : '—';
    }

    /** A purchase's supplier (if any) and items, e.g. "Mang Tony Store — Rice ×2". */
    public static function purchaseSubject(string $businessId, string $purchaseId): string
    {
        $supplier = DB::table('purchases as pu')
            ->join('suppliers as s', 's.supplier_id', '=', 'pu.supplier_id')
            ->where('pu.business_id', $businessId)
            ->where('pu.purchase_id', $purchaseId)
            ->value('s.name');
        $items = self::itemSummary('purchase_items', 'purchase_id', $purchaseId);

        return $supplier ? "{$supplier} — {$items}" : $items;
    }

    /**
     * Signing in or out, logged in every store the person belongs to, so the owner
     * sees when staff came and went. Never stops the sign-in itself: if the entry
     * can't be saved, it's reported and the person carries on.
     */
    public static function account(object $user, string $action): void
    {
        try {
            $businessIds = DB::table('business_users')->where('user_id', $user->user_id)->pluck('business_id');
            foreach ($businessIds as $businessId) {
                self::record($businessId, self::ACCOUNT, $action, [
                    'subjectId' => $user->user_id,
                    'subject' => $user->name ?? '—',
                    'actor' => $user,
                ]);
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /** True when two prices differ once rounded to the centavo. */
    public static function priceChanged(float $old, float $new): bool
    {
        return round($old, 2) !== round($new, 2);
    }
}
