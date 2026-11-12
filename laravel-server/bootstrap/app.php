<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\EnsureBusinessManager;
use App\Http\Middleware\EnsureBusinessMember;
use App\Http\Middleware\ForceJsonResponse;
use App\Http\Middleware\Idempotent;
use App\Http\Middleware\SetLocale;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Render (like most hosts) puts a proxy in front of the API. Take the
        // visitor's address from it, so per-device limits count each device.
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'business.member' => EnsureBusinessMember::class,
            'business.manager' => EnsureBusinessManager::class,
            'idempotent' => Idempotent::class,
        ]);

        // Every /api/* request is treated as JSON-expecting regardless of
        // its Accept header — see ForceJsonResponse's docblock for why this
        // is necessary, not just a nicety.
        $middleware->api(prepend: [ForceJsonResponse::class, SetLocale::class]);

        // Safety headers on every answer (see SecurityHeaders).
        $middleware->append(SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ApiException $e, Request $request) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        });

        // Expected client errors (403/404/etc via ApiException) aren't
        // application faults — don't clutter the log at ERROR level.
        $exceptions->dontReport([ApiException::class]);
    })->create();
