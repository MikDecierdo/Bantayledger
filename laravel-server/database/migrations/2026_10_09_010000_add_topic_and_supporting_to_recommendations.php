<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `topic` tags special insight families (e.g. "trending") so the app can filter
 * them and offer extra actions; `supporting` holds the figures behind an
 * insight as JSON text (label/value pairs).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recommendations', function (Blueprint $table) {
            $table->string('topic', 20)->nullable()->after('type');
            $table->text('supporting')->nullable()->after('confidence');
        });
    }

    public function down(): void
    {
        Schema::table('recommendations', function (Blueprint $table) {
            $table->dropColumn(['topic', 'supporting']);
        });
    }
};
