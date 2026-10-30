<?php

namespace App\Services;

use App\Support\Msg;
use Carbon\Carbon;

/**
 * A small, offline guide to why a product might be selling now, aimed at
 * Philippine retail: the weather/holiday calendar plus a plain description of
 * what kinds of product the season favours.
 *
 * It is general knowledge, not a measurement — wording stays careful ("likely",
 * "commonly") and the caller labels it as such. The shop's own history for the
 * same period is stronger evidence and is passed in when it exists.
 */
class SeasonKnowledge
{
    /** @var array<string, array{label: string, months: int[], note: string, match: string}> */
    private const SEASONS = [
        'hot' => [
            'label' => 'hot dry season',
            'months' => [3, 4, 5],
            'note' => 'hot weather lifts cold drinks, water, juice and ice cream',
            'match' => 'soft drink|soda|coke|sprite|royal|pepsi|mountain dew|juice|water|ice|cold|tea|c2|gatorade|sting|energy',
        ],
        'rainy' => [
            'label' => 'rainy and typhoon season',
            'months' => [6, 7, 8, 9, 10, 11],
            'note' => 'cooler, rainy weather lifts hot drinks, instant meals and pantry basics (people also stock up before storms)',
            'match' => 'milo|coffee|kape|choco|cocoa|tea|3in1|3-in-1|bear brand|birch|noodle|pancit|lucky me|canned|sardine|corned|rice|bigas|water|candle|battery',
        ],
        'ber' => [
            'label' => 'holiday build-up (the "-ber months")',
            'months' => [9, 10, 11, 12],
            'note' => 'holiday shopping starts early, with more cooking, gifting and noche buena ingredients',
            'match' => 'oil|sugar|asukal|rice|bigas|spaghetti|pasta|sauce|ham|cheese|cream|milk|flour|egg|chocolate|candy',
        ],
        'school' => [
            'label' => 'back-to-school',
            'months' => [6, 7, 8],
            'note' => 'school days mean baon: bread, biscuits, juice, milk and chocolate drinks',
            'match' => 'milo|bread|pandesal|biscuit|cracker|juice|milk|chocolate|choco|noodle|snack|chips|piattos|chippy',
        ],
        'lent' => [
            'label' => 'Lenten season',
            'months' => [3, 4],
            'note' => 'many households switch to fish and meatless meals',
            'match' => 'fish|sardine|tuna|bangus|tinapa|canned|egg',
        ],
        'bonus' => [
            'label' => 'December bonus and Christmas',
            'months' => [12],
            'note' => '13th-month pay and Christmas gatherings raise spending on food and treats',
            'match' => '.',
        ],
    ];

    /** @var array<string, array{match: string, benefit: string}> */
    private const BENEFITS = [
        'chocolate-malt drink' => [
            'match' => 'milo|ovaltine|choco malt|cocoa|chocolate drink',
            'benefit' => 'A fortified chocolate-malt drink, commonly bought for kids\' school days and as a hot drink when the weather turns cool.',
        ],
        'coffee' => [
            'match' => 'coffee|kape|nescafe|great taste|kopiko|3in1|3-in-1',
            'benefit' => 'A convenient hot drink for mornings and cool or rainy days, often bought in sachets for a cheap, quick cup.',
        ],
        'soft drink' => [
            'match' => 'soft drink|soda|coke|sprite|royal|pepsi|mountain dew',
            'benefit' => 'A cold, ready-to-drink refreshment that sells best in hot weather and at gatherings.',
        ],
        'instant noodles' => [
            'match' => 'noodle|pancit|lucky me|nissin',
            'benefit' => 'A fast, filling and affordable meal, which is why it sells steadily and jumps when storms hit.',
        ],
        'canned goods' => [
            'match' => 'canned|sardine|corned|tuna|ligo|argentina',
            'benefit' => 'Long shelf life and no cooking needed, so households stock up before storms and on tight budgets.',
        ],
        'rice' => [
            'match' => 'rice|bigas|sinandomeng|jasmine',
            'benefit' => 'The staple of most Filipino meals, bought every week and in bulk before holidays or storms.',
        ],
        'cooking basics' => [
            'match' => 'oil|sugar|asukal|salt|asin|vinegar|suka|soy sauce|toyo',
            'benefit' => 'Everyday cooking essentials that households restock regularly, with bigger runs before the holidays.',
        ],
        'bread and baon' => [
            'match' => 'bread|pandesal|biscuit|cracker',
            'benefit' => 'Quick breakfast and school-baon food, bought fresh and often.',
        ],
        'snacks' => [
            'match' => 'chips|piattos|chippy|snack|candy|chocolate',
            'benefit' => 'Impulse and kid-friendly buys that rise with school days and gatherings.',
        ],
        'toiletries' => [
            'match' => 'soap|shampoo|toothpaste|surf|detergent|safeguard|colgate',
            'benefit' => 'Household necessities that sell steadily, often in small sachets between paydays.',
        ],
    ];

    /**
     * @param  string  $name      Product name.
     * @param  string|null  $category  Category name, if any.
     * @param  Carbon  $today
     * @param  array|null  $ownHistory  ['months' => ['October', ...]] — months the shop itself sold this product strongly.
     * @return array{seasonal: string, season: ?Msg, why: Msg, benefit: ?Msg, source: string}
     */
    public static function explain(string $name, ?string $category, Carbon $today, ?array $ownHistory = null): array
    {
        $haystack = mb_strtolower(trim($name . ' ' . ($category ?? '')));
        $month = (int) $today->format('n');

        $fits = [];
        foreach (self::SEASONS as $key => $season) {
            if ($key === 'bonus') {
                continue;
            }
            if (in_array($month, $season['months'], true) && preg_match('/' . $season['match'] . '/u', $haystack)) {
                $fits[] = $season;
            }
        }
        // Holiday bonus applies to everything in December.
        if ($month === 12) {
            $fits[] = self::SEASONS['bonus'];
        }

        $benefit = null;
        foreach (self::BENEFITS as $b) {
            if (preg_match('/' . $b['match'] . '/u', $haystack)) {
                $benefit = Msg::of($b['benefit']);
                break;
            }
        }

        $ownMonth = $today->format('F');
        $soldThisMonthBefore = $ownHistory && in_array($ownMonth, $ownHistory['months'] ?? [], true);

        if ($soldThisMonthBefore) {
            return [
                'seasonal' => 'yes',
                'season' => Msg::of($ownMonth),
                'why' => Msg::of('Based on your records, :name also sold strongly in :month before, so this looks seasonal for your shop.', ['name' => $name, 'month' => Msg::of($ownMonth)]),
                'benefit' => $benefit,
                'source' => 'your records',
            ];
        }

        if ($fits) {
            $first = $fits[0];
            $labels = count($fits) >= 2
                ? Msg::of(':a and :b', ['a' => Msg::of($fits[0]['label']), 'b' => Msg::of($fits[1]['label'])])
                : Msg::of($first['label']);

            return [
                'seasonal' => count($fits) >= 2 ? 'yes' : 'maybe',
                'season' => Msg::of($first['label']),
                'why' => Msg::of('Likely seasonal: it is the :seasons, and :note.', ['seasons' => $labels, 'note' => Msg::of($first['note'])]),
                'benefit' => $benefit,
                'source' => 'general knowledge',
            ];
        }

        return [
            'seasonal' => 'no',
            'season' => null,
            'why' => Msg::of('No clear seasonal reason for this product at this time of year, so the rise is more likely about your own customers, a promotion or a stock-up.'),
            'benefit' => $benefit,
            'source' => 'general knowledge',
        ];
    }
}
