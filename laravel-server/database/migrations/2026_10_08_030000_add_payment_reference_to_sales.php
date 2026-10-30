<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The last 4 digits of a GCash reference number, so a GCash sale can be
 * matched against the GCash app. Separate from `reference`, which is the
 * sale's own receipt number. NULL for cash sales and for sales recorded
 * before this existed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('payment_reference', 4)->nullable()->after('payment_method');
            $table->index(['business_id', 'sale_date', 'payment_reference'], 'sales_payment_reference_idx');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex('sales_payment_reference_idx');
            $table->dropColumn('payment_reference');
        });
    }
};
