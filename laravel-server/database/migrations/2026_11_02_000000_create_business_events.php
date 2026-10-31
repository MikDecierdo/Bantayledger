<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Local events a store prepares for — the barangay fiesta, a town fiesta, a
 * school foundation day. Saved as month + day and repeated every year; the
 * forecast turns an upcoming one into a stock-up list (App\Services\EventCalendar).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_events', function (Blueprint $table) {
            $table->char('event_id', 36)->primary();
            $table->char('business_id', 36);
            $table->string('name', 80);
            $table->unsignedTinyInteger('month');
            $table->unsignedTinyInteger('day');
            // How many days before the event the stock-up list appears.
            $table->unsignedSmallInteger('prep_days')->default(21);
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['business_id', 'name', 'month', 'day']);
            $table->foreign('business_id')->references('business_id')->on('businesses')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_events');
    }
};
