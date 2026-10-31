<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Capital locked in at sale time: each sale line keeps the buying price the
 * product had when it was sold, so profit stays correct after a price change.
 * Existing lines are filled from the product's current buying price.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE sale_items ADD COLUMN unit_cost DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER unit_price');
        DB::statement('ALTER TABLE sale_items ADD CONSTRAINT sale_items_unit_cost_check CHECK (unit_cost >= 0)');
        DB::statement('UPDATE sale_items si JOIN products p ON p.product_id = si.product_id SET si.unit_cost = p.cost_price');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE sale_items DROP CONSTRAINT sale_items_unit_cost_check');
        DB::statement('ALTER TABLE sale_items DROP COLUMN unit_cost');
    }
};
