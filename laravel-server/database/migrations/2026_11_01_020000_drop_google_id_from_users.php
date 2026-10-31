<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * "Continue with Google" was removed again (the owner decided against it), so
 * the google_id column added by 2026_11_01_010000 goes away. That earlier
 * migration stays because it already ran on the online database.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'google_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropUnique(['google_id']);
                $table->dropColumn('google_id');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'google_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('google_id', 64)->nullable()->unique()->after('email');
            });
        }
    }
};
