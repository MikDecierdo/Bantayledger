<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Links a product to the "anchor" product of its size/variant group (e.g.
 * "Coke 500ml" -> "Coke 1 Liter"). Each row stays a fully independent
 * product — own stock, own price, own everything — this is purely a
 * convenience link for batch-adding and display grouping. The anchor's own
 * column stays null; every sibling points directly at the anchor's id, never
 * at another sibling.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->uuid('variant_group_id')->nullable()->after('id');
            $table->foreign('variant_group_id')->references('id')->on('products')->nullOnDelete();
            $table->index('variant_group_id');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['variant_group_id']);
            $table->dropIndex(['variant_group_id']);
            $table->dropColumn('variant_group_id');
        });
    }
};
