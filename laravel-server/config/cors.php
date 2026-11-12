<?php

/*
 * Which apps may call the API from a browser (CORS).
 *
 * Only BantayLedger's own apps: the website, the Android and iOS apps
 * (Capacitor) and the Windows app (Electron). Sign-in uses a Bearer token, not
 * cookies, so this is a second line of defence. Add more with
 * CORS_ALLOWED_ORIGINS (comma separated). Outside production, any
 * localhost / 127.0.0.1 port also works, for development.
 */

$origins = array_values(array_filter(array_map('trim', explode(',', (string) env(
    'CORS_ALLOWED_ORIGINS',
    'https://bantayledger-web.onrender.com,https://localhost,capacitor://localhost,app://bantayledger'
)))));

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],

    'allowed_origins' => $origins,

    'allowed_origins_patterns' => env('APP_ENV', 'production') === 'production'
        ? []
        : ['#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#'],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 3600,

    'supports_credentials' => false,

];
