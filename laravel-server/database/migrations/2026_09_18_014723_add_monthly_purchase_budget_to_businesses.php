<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A single overall monthly spending cap on supply purchases (warn-only —
 * the app never blocks recording a purchase once it's reached, it just
 * shows a banner on the Purchases page). Null means no budget is set.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->decimal('monthly_purchase_budget', 14, 2)->nullable()->after('currency');
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn('monthly_purchase_budget');
        });
    }
};
