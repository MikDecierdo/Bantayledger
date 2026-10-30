<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The welcome step after sign-up / first login: when the person accepted the
 * data privacy notice (and which version), and the language they chose.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('privacy_accepted_at')->nullable()->after('avatar_url');
            $table->string('privacy_version', 10)->nullable()->after('privacy_accepted_at');
            $table->string('language', 5)->nullable()->after('privacy_version');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['privacy_accepted_at', 'privacy_version', 'language']);
        });
    }
};
