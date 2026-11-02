<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Demo subscription for the project defense. One row per activation, recorded
 * from a typed GCash reference number: no payment is taken or verified, and the
 * plan only changes a label (App\Services\SubscriptionPlan). No feature checks it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_payments', function (Blueprint $table) {
            $table->char('payment_id', 36)->primary();
            $table->char('business_id', 36);
            $table->char('user_id', 36)->nullable();
            $table->string('term', 10);
            $table->decimal('amount', 10, 2);
            $table->char('reference', 13)->unique();
            $table->dateTime('starts_at');
            $table->dateTime('expires_at');
            $table->dateTime('cancelled_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['business_id', 'expires_at']);
            $table->foreign('business_id')->references('business_id')->on('businesses')->cascadeOnDelete();
            $table->foreign('user_id')->references('user_id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_payments');
    }
};
