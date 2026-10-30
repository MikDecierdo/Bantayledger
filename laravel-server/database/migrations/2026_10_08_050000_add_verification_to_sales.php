<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An owner/admin ticks a GCash sale as verified after matching it against the
 * GCash app. NULL means not yet matched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->timestamp('verified_at')->nullable()->after('payment_reference');
            $table->char('verified_by', 36)->nullable()->after('verified_at');
            $table->index(['business_id', 'payment_method', 'sale_date'], 'sales_method_date_idx');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex('sales_method_date_idx');
            $table->dropColumn(['verified_at', 'verified_by']);
        });
    }
};
