<?php

namespace App\Services;

use App\Exceptions\ApiException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * Optional AI write-up for a trending-product insight ("why is it trending,
 * what are its benefits, is it seasonal?").
 *
 * Only the product name, its category and weekly unit counts are sent — never
 * the business name, customers, prices or user details. Answers are cached per
 * business, product and week, and each business gets a small daily allowance,
 * so cost stays bounded.
 */
class InsightExplainer
{
    private const DAILY_LIMIT = 10;
    private const TIMEOUT_SECONDS = 15;

    private const DEFAULT_MODELS = [
        'gemini' => 'gemini-2.5-flash',
        'anthropic' => 'claude-haiku-5-5',
        'openai' => 'llama3.2',
    ];

    private static function provider(): string
    {
        $p = strtolower((string) config('services.ai.provider'));

        return in_array($p, ['gemini', 'anthropic', 'openai'], true) ? $p : 'gemini';
    }

    private static function model(): string
    {
        return (string) (config('services.ai.model') ?: self::DEFAULT_MODELS[self::provider()]);
    }

    /** A provider is usable when it has a key (or, for OpenAI-compatible/local endpoints, a base URL). */
    public static function enabled(): bool
    {
        $key = (string) config('services.ai.key');

        return self::provider() === 'openai'
            ? (string) config('services.ai.base_url') !== ''
            : $key !== '';
    }

    public static function explain(string $business, string $insightId): array
    {
        if (! self::enabled()) {
            throw ApiException::unprocessable('AI explanations are not set up on this server.');
        }

        $rec = DB::table('recommendations')
            ->where('business_id', $business)
            ->where('recommendation_id', $insightId)
            ->first();
        if (! $rec || $rec->topic !== 'trending' || ! $rec->product_id) {
            throw ApiException::notFound('That insight could not be found.');
        }

        $product = DB::table('products as p')
            ->leftJoin('categories as c', 'c.category_id', '=', 'p.category_id')
            ->where('p.product_id', $rec->product_id)
            ->first(['p.name', 'c.name as category']);
        if (! $product) {
            throw ApiException::notFound('That product could not be found.');
        }

        $week = now()->format('o-W');
        $cacheKey = "insight-explain:{$business}:{$rec->product_id}:{$week}:" . app()->getLocale();
        if ($cached = Cache::get($cacheKey)) {
            return ['text' => $cached, 'cached' => true];
        }

        $limitKey = "insight-explain-count:{$business}:" . now()->format('Y-m-d');
        $used = (int) Cache::get($limitKey, 0);
        if ($used >= self::DAILY_LIMIT) {
            throw ApiException::tooManyRequests('You have used today\'s AI explanations. Try again tomorrow.');
        }

        $weekly = self::weeklyUnits($business, $rec->product_id);
        $prompt = self::prompt($product->name, $product->category, $weekly, (string) $rec->reason, self::languageName());

        $text = trim(self::complete($prompt));
        if ($text === '') {
            throw ApiException::badGateway('The AI service returned an empty answer. Please try again.');
        }

        Cache::put($cacheKey, $text, now()->addDays(2));
        Cache::put($limitKey, $used + 1, now()->endOfDay());

        return ['text' => $text, 'cached' => false];
    }

    /** Sends the prompt to the configured provider and returns its text answer. */
    private static function complete(string $prompt): string
    {
        $key = (string) config('services.ai.key');
        $model = self::model();

        try {
            $http = Http::timeout(self::TIMEOUT_SECONDS);

            $response = match (self::provider()) {
                'gemini' => $http->withHeaders(['x-goog-api-key' => $key])->post(
                    'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent',
                    [
                        'contents' => [['parts' => [['text' => $prompt]]]],
                        'generationConfig' => ['maxOutputTokens' => 500],
                    ],
                ),
                'anthropic' => $http->withHeaders(['x-api-key' => $key, 'anthropic-version' => '2023-06-01'])->post(
                    'https://api.anthropic.com/v1/messages',
                    ['model' => $model, 'max_tokens' => 500, 'messages' => [['role' => 'user', 'content' => $prompt]]],
                ),
                default => ($key !== '' ? $http->withToken($key) : $http)->post(
                    rtrim((string) config('services.ai.base_url'), '/') . '/chat/completions',
                    ['model' => $model, 'max_tokens' => 500, 'messages' => [['role' => 'user', 'content' => $prompt]]],
                ),
            };
        } catch (\Throwable $e) {
            throw ApiException::badGateway('The AI service could not be reached. Please try again later.');
        }

        if ($response->status() === 429) {
            throw ApiException::tooManyRequests('The free AI quota is used up for now. Please try again a little later.');
        }
        if (! $response->successful()) {
            throw ApiException::badGateway('The AI service could not answer right now. Please try again later.');
        }

        $json = $response->json();

        return (string) match (self::provider()) {
            'gemini' => data_get($json, 'candidates.0.content.parts.0.text', ''),
            'anthropic' => data_get($json, 'content.0.text', ''),
            default => data_get($json, 'choices.0.message.content', ''),
        };
    }

    /** Units sold per week for the last four weeks, oldest first. */
    private static function weeklyUnits(string $business, string $productId): array
    {
        $today = now()->startOfDay();
        $weeks = [];
        for ($w = 3; $w >= 0; $w--) {
            $to = $today->copy()->subDays($w * 7);
            $from = $to->copy()->subDays(6);
            $weeks[] = (float) DB::table('sale_items as si')
                ->join('sales as s', 's.sale_id', '=', 'si.sale_id')
                ->where('s.business_id', $business)
                ->where('si.product_id', $productId)
                ->whereBetween('s.sale_date', [$from->format('Y-m-d'), $to->format('Y-m-d')])
                ->sum('si.quantity');
        }

        return $weeks;
    }

    /** The language the answer should be written in, matching the app language. */
    private static function languageName(): string
    {
        return match (app()->getLocale()) {
            'tl' => 'Tagalog (Filipino)',
            'ceb' => 'Cebuano (Bisaya)',
            default => 'English',
        };
    }

    private static function prompt(string $name, ?string $category, array $weekly, string $builtIn, string $language = 'English'): string
    {
        $series = implode(', ', array_map(fn ($u) => rtrim(rtrim(number_format($u, 2, '.', ''), '0'), '.') ?: '0', $weekly));
        $cat = $category ? " (category: {$category})" : '';
        $date = now()->format('F j, Y');

        return <<<TXT
A small sari-sari / grocery shop in the Philippines sells "{$name}"{$cat}. Today is {$date}.
Units sold per week over the last 4 weeks (oldest first): {$series}.
A simple built-in guide already said: {$builtIn}

In under 120 words, answer in exactly three short labelled lines:
Why it's trending: the most likely reasons given the season, weather, holidays or school calendar in the Philippines.
Benefits: what makes this kind of product appealing to customers (keep claims general and avoid medical or health promises).
Seasonal or not: say yes, maybe or no, and why.
If you are unsure, say so briefly instead of guessing. Do not invent statistics.
Write the whole answer, including the three labels, in {$language}, using simple everyday words a store owner would use.
TXT;
    }
}
