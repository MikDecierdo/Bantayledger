<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** A hash of the records a forecast run read, so "has anything changed since?" is a cheap comparison. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forecast_runs', function (Blueprint $table) {
            $table->string('fingerprint', 40)->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('forecast_runs', function (Blueprint $table) {
            $table->dropColumn('fingerprint');
        });
    }
};
