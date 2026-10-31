<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BusinessController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SignalController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\WasteController;
use Illuminate\Support\Facades\Route;

/*
 * Route shape mirrors the Node/Express port (server/src/routes/*) as closely
 * as possible, so the eventual client integration touches the same handful
 * of files regardless of which backend it ends up pointed at.
 */

// Used by the app to wake the server (Render free sleeps) and to check it's reachable.
Route::get('/health', fn () => response()->json(['ok' => true]));

Route::post('/auth/signup', [AuthController::class, 'signup']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/google', [AuthController::class, 'google']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/businesses', [AuthController::class, 'createBusiness']);

    Route::patch('/profile', [BusinessController::class, 'updateProfile']);
    Route::post('/profile/consent', [BusinessController::class, 'acceptPrivacy']);

    Route::prefix('/businesses/{business}')->group(function () {
        Route::get('/', [BusinessController::class, 'show'])->middleware('business.member');
        Route::patch('/', [BusinessController::class, 'update'])->middleware('business.manager');
        Route::get('/members', [BusinessController::class, 'members'])->middleware('business.member');
        Route::post('/members', [BusinessController::class, 'addMember'])->middleware('business.manager');
        Route::patch('/members/{userId}/password', [BusinessController::class, 'resetMemberPassword'])->middleware('business.manager');
        Route::delete('/members/{userId}', [BusinessController::class, 'removeMember'])->middleware('business.manager');

        // Catalogue: categories_write_manager / suppliers_write_manager / products_write_manager
        Route::get('/categories', [CategoryController::class, 'index'])->middleware('business.member');
        Route::post('/categories', [CategoryController::class, 'store'])->middleware('business.manager');
        Route::delete('/categories/{id}', [CategoryController::class, 'destroy'])->middleware('business.manager');

        Route::get('/suppliers', [SupplierController::class, 'index'])->middleware('business.member');
        Route::post('/suppliers', [SupplierController::class, 'store'])->middleware('business.manager');
        Route::patch('/suppliers/{id}', [SupplierController::class, 'update'])->middleware('business.manager');
        Route::delete('/suppliers/{id}', [SupplierController::class, 'destroy'])->middleware('business.manager');

        Route::get('/products', [ProductController::class, 'index'])->middleware('business.member');
        Route::get('/products/{id}', [ProductController::class, 'show'])->middleware('business.member');
        Route::get('/products/{id}/stock-movement', [ProductController::class, 'stockMovement'])->middleware('business.member');
        Route::get('/products/{id}/unit-sales', [ProductController::class, 'unitSales'])->middleware('business.member');
        Route::post('/products', [ProductController::class, 'store'])->middleware('business.manager');
        Route::patch('/products/{id}', [ProductController::class, 'update'])->middleware('business.manager');
        Route::delete('/products/{id}', [ProductController::class, 'destroy'])->middleware('business.manager');
        Route::post('/products/{id}/image', [ProductController::class, 'uploadImage'])->middleware('business.manager');
        Route::delete('/products/{id}/image', [ProductController::class, 'removeImage'])->middleware('business.manager');
        // adjust_stock in Postgres only required membership, not manager.
        Route::post('/products/{id}/adjust-stock', [ProductController::class, 'adjustStock'])->middleware('business.member');

        // Sales: insert_member, delete_manager
        Route::get('/sales', [SaleController::class, 'index'])->middleware('business.member');
        Route::get('/sales/overview', [SaleController::class, 'overview'])->middleware('business.member');
        Route::post('/sales', [SaleController::class, 'store'])->middleware(['business.member', 'idempotent']);
        Route::delete('/sales/{id}', [SaleController::class, 'destroy'])->middleware('business.manager');

        // Purchases: insert_member, update_member (status flip), delete_manager
        Route::get('/purchases', [PurchaseController::class, 'index'])->middleware('business.member');
        Route::get('/purchases/overview', [PurchaseController::class, 'overview'])->middleware('business.member');
        Route::post('/purchases', [PurchaseController::class, 'store'])->middleware(['business.member', 'idempotent']);
        Route::patch('/purchases/{id}/status', [PurchaseController::class, 'setStatus'])->middleware('business.member');
        Route::delete('/purchases/{id}', [PurchaseController::class, 'destroy'])->middleware('business.manager');

        // Expenses / waste: insert_member, delete_manager
        Route::get('/expenses', [ExpenseController::class, 'index'])->middleware('business.member');
        Route::get('/expenses/overview', [ExpenseController::class, 'overview'])->middleware('business.member');
        Route::post('/expenses', [ExpenseController::class, 'store'])->middleware(['business.member', 'idempotent']);
        Route::delete('/expenses/{id}', [ExpenseController::class, 'destroy'])->middleware('business.manager');

        Route::get('/waste', [WasteController::class, 'index'])->middleware('business.member');
        Route::get('/waste/overview', [WasteController::class, 'overview'])->middleware('business.member');
        Route::post('/waste', [WasteController::class, 'store'])->middleware(['business.member', 'idempotent']);
        Route::delete('/waste/{id}', [WasteController::class, 'destroy'])->middleware('business.manager');

        // Signals: read for members; mark-read is a member action; write is a future model-service concern.
        Route::get('/alerts', [SignalController::class, 'alerts'])->middleware('business.member');
        Route::get('/alerts/counts', [SignalController::class, 'alertCounts'])->middleware('business.member');
        Route::post('/alerts/{id}/read', [SignalController::class, 'markAlertRead'])->middleware('business.member');
        Route::post('/alerts/read-all', [SignalController::class, 'markAllAlertsRead'])->middleware('business.member');
        Route::delete('/alerts/{id}', [SignalController::class, 'removeAlert'])->middleware('business.member');

        Route::get('/insights', [SignalController::class, 'insights'])->middleware('business.member');
        Route::post('/insights/{id}/read', [SignalController::class, 'markInsightRead'])->middleware('business.member');
        Route::post('/insights/{id}/explain', [SignalController::class, 'explainInsight'])->middleware('business.member');

        Route::get('/reports', [ReportController::class, 'show'])->middleware('business.member');

        Route::get('/forecasts', [SignalController::class, 'forecasts'])->middleware('business.member');
        Route::post('/forecasts/refresh', [SignalController::class, 'refreshForecasts'])->middleware('business.member');
    });
});
