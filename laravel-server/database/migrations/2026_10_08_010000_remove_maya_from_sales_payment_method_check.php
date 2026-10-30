<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Maya is no longer offered as a payment method — drop it from the allowed set. */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE sales DROP CONSTRAINT sales_payment_method_check');
        DB::statement("ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('Cash', 'GCash', 'Card', 'Other'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE sales DROP CONSTRAINT sales_payment_method_check');
        DB::statement("ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('Cash', 'GCash', 'Maya', 'Card', 'Other'))");
    }
};
