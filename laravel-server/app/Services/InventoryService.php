<?php

namespace App\Services;

use App\Exceptions\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The inventory ledger. Ported from apply_inventory_movement() in
 * supabase/migrations/0002_functions_triggers.sql, by way of the Node/Express
 * port's server/src/services/inventoryService.ts — same logic, same
 * reasoning: the single place stock changes, so every path (sale, purchase,
 * waste, manual adjustment) is accounted for in one audit trail and
 * current_stock is only ever a cached sum of it.
 *
 * Business-rule placement mirrors the Node port too: this lives in
 * application code wrapped in a DB transaction, not a MySQL trigger — MySQL
 * triggers can't produce the dynamic "Not enough stock for X" message the
 * way plpgsql could.
 */
class InventoryService
{
    public static function computeStatus(float $currentStock, float $minimumStock): string
    {
        if ($currentStock <= 0) {
            return 'out';
        }
        if ($minimumStock > 0 && $currentStock <= $minimumStock * 0.5) {
            return 'critical';
        }
        if ($minimumStock > 0 && $currentStock < $minimumStock) {
            return 'low';
        }

        return 'healthy';
    }

    /**
     * Folds a received purchase into the product's cost price as a weighted
     * average of the stock on hand and the new batch, so margins and stock
     * value follow real purchase prices. Call inside the caller's transaction,
     * before recording the PURCHASE movement (it needs the stock before the
     * receipt). Reversing a receipt does not rewrite the cost: a blended
     * average can't be un-mixed reliably.
     */
    public static function applyPurchaseCost(string $businessId, string $productId, float $quantity, float $unitCost): void
    {
        if ($quantity <= 0) {
            return;
        }

        $product = DB::table('products')
            ->where('product_id', $productId)
            ->where('business_id', $businessId)
            ->lockForUpdate()
            ->first(['current_stock', 'cost_price']);

        if (! $product) {
            return; // recordMovement reports the missing product
        }

        $stock = max(0.0, (float) $product->current_stock);
        $cost = (float) $product->cost_price;
        $next = $stock > 0
            ? ($stock * $cost + $quantity * $unitCost) / ($stock + $quantity)
            : $unitCost;

        DB::table('products')->where('product_id', $productId)->update(['cost_price' => round($next, 2)]);
    }

    /**
     * Inserts one ledger row and applies its effect to products.current_stock,
     * inside the caller's transaction. Call within DB::transaction(...).
     */
    public static function recordMovement(
        string $businessId,
        string $productId,
        string $movementType,
        float $quantity,
        ?string $referenceType = null,
        ?string $referenceId = null,
        ?string $notes = null,
        ?string $createdBy = null,
    ): void {
        if ($quantity === 0.0) {
            throw ApiException::badRequest('Enter an adjustment other than zero.');
        }

        $product = DB::table('products')
            ->where('product_id', $productId)
            ->where('business_id', $businessId)
            ->lockForUpdate()
            ->first(['current_stock', 'minimum_stock', 'name', 'unit', 'is_active']);

        if (! $product) {
            throw ApiException::notFound('That product no longer exists.');
        }

        if ($movementType === 'SALE' && $quantity < 0 && ! $product->is_active) {
            throw ApiException::badRequest(':name is disabled. Enable it in Inventory to sell it.', ['name' => $product->name]);
        }

        $nextStock = (float) $product->current_stock + $quantity;

        if ($nextStock < 0) {
            $available = rtrim(rtrim(number_format((float) $product->current_stock, 3, '.', ''), '0'), '.');
            throw ApiException::badRequest('Not enough stock for :name. Only :available :unit available.', ['name' => $product->name, 'available' => $available, 'unit' => $product->unit]);
        }

        DB::table('inventory_movements')->insert([
            'inventory_movement_id' => (string) Str::uuid(),
            'business_id' => $businessId,
            'product_id' => $productId,
            'movement_type' => $movementType,
            'quantity' => $quantity,
            // The exact record that caused this movement: a sale, a purchase
            // or a spoiled-item record. All three null = manual adjustment.
            'sale_id' => $referenceType === 'sale' ? $referenceId : null,
            'purchase_id' => $referenceType === 'purchase' ? $referenceId : null,
            'waste_record_id' => $referenceType === 'waste' ? $referenceId : null,
            'notes' => $notes,
            'created_by_user_id' => $createdBy,
            'created_at' => now(),
        ]);

        DB::table('products')->where('product_id', $productId)->update([
            'current_stock' => $nextStock,
            'status' => self::computeStatus($nextStock, (float) $product->minimum_stock),
        ]);
    }

    /** Manual correction — member-level, not manager-level (matches Postgres's adjust_stock RPC). */
    public static function adjustStock(string $businessId, string $productId, float $quantity, string $userId, ?string $notes = null): void
    {
        DB::transaction(function () use ($businessId, $productId, $quantity, $userId, $notes) {
            self::recordMovement($businessId, $productId, 'ADJUSTMENT', $quantity, 'adjustment', null, $notes, $userId);
        });
    }

    /**
     * Reverses and deletes every ledger row caused by one sale, purchase or
     * spoiled-item record (optionally only one movement type) — used when
     * deleting that record. Call within the caller's transaction.
     */
    public static function removeMovementsByReference(
        string $businessId,
        string $referenceType,
        string $referenceId,
        ?string $movementType = null,
    ): void {
        $column = ['sale' => 'sale_id', 'purchase' => 'purchase_id', 'waste' => 'waste_record_id'][$referenceType] ?? null;
        if ($column === null) {
            return;
        }

        $query = DB::table('inventory_movements')
            ->where('business_id', $businessId)
            ->where($column, $referenceId);

        if ($movementType) {
            $query->where('movement_type', $movementType);
        }

        $movements = $query->get(['inventory_movement_id', 'product_id', 'quantity']);

        foreach ($movements as $movement) {
            $product = DB::table('products')
                ->where('product_id', $movement->product_id)
                ->lockForUpdate()
                ->first(['current_stock', 'minimum_stock']);

            if (! $product) {
                continue;
            }

            $restored = max((float) $product->current_stock - (float) $movement->quantity, 0);

            DB::table('products')->where('product_id', $movement->product_id)->update([
                'current_stock' => $restored,
                'status' => self::computeStatus($restored, (float) $product->minimum_stock),
            ]);
        }

        if ($movements->isNotEmpty()) {
            DB::table('inventory_movements')->whereIn('inventory_movement_id', $movements->pluck('inventory_movement_id'))->delete();
        }
    }
}
