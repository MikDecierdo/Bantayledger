<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Selling loose ("tingi"): a product stocked by the sack, pack or tray can also be
 * sold by the kilo, stick or piece.
 *
 * - products: the loose unit, how many loose units make one stock unit (50 kg in
 *   a sack, 20 sticks in a pack) and the price per loose unit.
 * - sale_items: what the customer actually bought (½ kg), kept for the receipt.
 *   `quantity` stays in stock units (0.01 sack), so stock, forecasts and reports
 *   keep counting in one unit.
 * - Quantities get 6 decimals so a loose sale (1 egg = 1/30 tray) leaves no
 *   rounding residue in the stock.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE products
            ADD COLUMN loose_unit VARCHAR(20) NULL AFTER unit,
            ADD COLUMN loose_per_unit DECIMAL(14,3) NULL AFTER loose_unit,
            ADD COLUMN loose_price DECIMAL(14,2) NULL AFTER loose_per_unit,
            MODIFY current_stock DECIMAL(16,6) NOT NULL DEFAULT 0');
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_loose_check CHECK (
            (loose_unit IS NULL AND loose_per_unit IS NULL AND loose_price IS NULL)
            OR (loose_unit IS NOT NULL AND loose_per_unit > 0 AND loose_price >= 0))');

        DB::statement('ALTER TABLE inventory_movements MODIFY quantity DECIMAL(16,6) NOT NULL');

        // The subtotal is computed from quantity, so it is rebuilt around the change.
        DB::statement('ALTER TABLE sale_items DROP COLUMN subtotal');
        DB::statement('ALTER TABLE sale_items
            MODIFY quantity DECIMAL(16,6) NOT NULL,
            ADD COLUMN loose_quantity DECIMAL(14,3) NULL AFTER unit_cost,
            ADD COLUMN loose_unit VARCHAR(20) NULL AFTER loose_quantity,
            ADD COLUMN subtotal DECIMAL(14,2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED AFTER unit_price');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE sale_items DROP COLUMN subtotal');
        DB::statement('ALTER TABLE sale_items
            DROP COLUMN loose_unit,
            DROP COLUMN loose_quantity,
            MODIFY quantity DECIMAL(14,3) NOT NULL,
            ADD COLUMN subtotal DECIMAL(14,2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED AFTER unit_price');
        DB::statement('ALTER TABLE inventory_movements MODIFY quantity DECIMAL(14,3) NOT NULL');
        DB::statement('ALTER TABLE products DROP CONSTRAINT products_loose_check');
        DB::statement('ALTER TABLE products
            DROP COLUMN loose_price,
            DROP COLUMN loose_per_unit,
            DROP COLUMN loose_unit,
            MODIFY current_stock DECIMAL(14,3) NOT NULL DEFAULT 0');
    }
};
