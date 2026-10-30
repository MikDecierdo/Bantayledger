<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Optional "Explain with AI" on trending insights. Off until a provider is
    // configured. `gemini` (free tier from Google AI Studio) is the default;
    // `openai` covers any OpenAI-compatible endpoint (local Ollama, Groq,
    // OpenRouter...); `anthropic` is also supported. Keys stay on the server.
    'ai' => [
        'provider' => env('AI_PROVIDER', 'gemini'),
        'key' => env('AI_API_KEY', env('GEMINI_API_KEY', env('ANTHROPIC_API_KEY'))),
        'model' => env('AI_MODEL', env('ANTHROPIC_MODEL')),
        'base_url' => env('AI_BASE_URL'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
