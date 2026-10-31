<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Philippine events a sari-sari store stocks up for, plus the store's own
 * yearly events (barangay fiesta…, saved in `business_events`).
 *
 * Each event knows its date in any year, how many days ahead to start
 * preparing, which products it usually lifts (a regex on product name and
 * category, like SeasonKnowledge) and a typical rise in sales. The rise is
 * only used before the store has its own records for that event; after a
 * year, ForecastService uses what actually sold last time.
 */
class EventCalendar
{
    /** Days before an event that count as its "shopping window" when comparing with last year. */
    public const WINDOW_DAYS = 14;

    private const FIESTA_MATCH = 'soft drink|soda|coke|sprite|royal|pepsi|mountain dew|juice|rice|bigas|oil|mantika|spaghetti|pasta|sauce|ketchup|hotdog|hot dog|ice|cup|plate|plato|baso|charcoal|uling|vinegar|suka|soy|toyo|seasoning|snack|chips|beer|gin|san miguel|red horse|sugar|asukal|noodle|pancit|canton|bihon';

    /**
     * Built-in events. `date` gives the event day for a year; `prep` is how
     * many days ahead the stock-up list appears.
     *
     * @return array<string, array{label: string, note: string, prep: int, uplift: float, match: string, date: callable(int): Carbon}>
     */
    private static function builtIn(): array
    {
        return [
            'christmas' => [
                'label' => 'Christmas',
                'note' => 'Families buy Noche Buena food and drinks, and the 13th-month pay raises spending.',
                'prep' => 30,
                'uplift' => 2.0,
                'match' => 'ham|cheese|queso|spaghetti|pasta|sauce|fruit cocktail|cocktail|cream|nestle|condensed|evap|mayonnaise|mayo|macaroni|hotdog|hot dog|soft drink|soda|coke|sprite|royal|pepsi|sugar|asukal|oil|mantika|rice|bigas|chocolate|candy|graham|gelatin|gulaman|noodle|pancit',
                'date' => fn (int $y) => Carbon::create($y, 12, 24),
            ],
            'newyear' => [
                'label' => "New Year's Eve",
                'note' => 'Households prepare Media Noche: pancit for long life, round fruits, sweets and drinks.',
                'prep' => 7,
                'uplift' => 1.8,
                'match' => 'soft drink|soda|coke|sprite|royal|pepsi|juice|noodle|pancit|canton|bihon|spaghetti|pasta|sauce|grape|orange|fruit|malagkit|glutinous|ice|cup|plate|ham|cheese|hotdog|chocolate|candy',
                'date' => fn (int $y) => Carbon::create($y, 12, 31),
            ],
            'valentines' => [
                'label' => "Valentine's Day",
                'note' => 'Small gifts sell: chocolates, candies and cards.',
                'prep' => 10,
                'uplift' => 1.6,
                'match' => 'chocolate|choco|candy|kendi|card|flower|rose|toblerone|cadbury|hershey|kitkat|ferrero',
                'date' => fn (int $y) => Carbon::create($y, 2, 14),
            ],
            'holyweek' => [
                'label' => 'Holy Week',
                'note' => 'Many households eat fish and meatless meals, and stores close for a few days, so customers stock up early.',
                'prep' => 10,
                'uplift' => 1.5,
                'match' => 'fish|isda|sardine|tuna|bangus|tinapa|galunggong|canned|de lata|egg|itlog|noodle|rice|bigas|vegetable|gulay|bread|tinapay',
                'date' => fn (int $y) => self::easter($y)->subDays(3), // Maundy Thursday
            ],
            'mothersday' => [
                'label' => "Mother's Day",
                'note' => 'Families buy treats and small gifts.',
                'prep' => 7,
                'uplift' => 1.4,
                'match' => 'chocolate|choco|cake|candy|snack|ice cream|juice|soft drink|flower|card',
                'date' => fn (int $y) => Carbon::create($y, 5, 1)->next(Carbon::SUNDAY)->addWeek(), // 2nd Sunday of May
            ],
            'school' => [
                'label' => 'School opening',
                'note' => 'Back-to-school means baon and school supplies: bread, biscuits, juice, milk and chocolate drinks.',
                'prep' => 14,
                'uplift' => 1.5,
                'match' => 'bread|pandesal|biscuit|cracker|skyflakes|juice|zesto|milk|milo|choco|noodle|snack|chips|notebook|pad paper|paper|pencil|pen|ballpen|crayon|eraser|folder|envelope',
                'date' => fn (int $y) => Carbon::create($y, 6, 1)->isMonday() ? Carbon::create($y, 6, 1) : Carbon::create($y, 6, 1)->next(Carbon::MONDAY),
            ],
            'undas' => [
                'label' => 'Undas',
                'note' => 'Families visit cemeteries: candles, water, drinks and snacks sell, and many travel home.',
                'prep' => 14,
                'uplift' => 1.7,
                'match' => 'candle|kandila|water|tubig|soft drink|soda|coke|sprite|royal|juice|snack|chips|biscuit|cracker|ice|bread|noodle|match|posporo|lighter',
                'date' => fn (int $y) => Carbon::create($y, 11, 1),
            ],
        ];
    }

    /**
     * Events whose preparation window has started, nearest first.
     *
     * @param  Collection<int, object>  $local  rows from business_events
     * @return list<array{key: string, label: string, local: bool, note: string, date: Carbon, lastYearDate: Carbon, daysUntil: int, windowDays: int, uplift: float, match: string}>
     */
    public static function upcoming(Carbon $today, Collection $local): array
    {
        $today = $today->copy()->startOfDay();
        $events = [];

        foreach (self::builtIn() as $key => $e) {
            $events[] = self::occurrence($today, $key, $e['label'], false, $e['note'], $e['prep'], $e['uplift'], $e['match'], $e['date']);
        }
        foreach ($local as $row) {
            $month = (int) $row->month;
            $day = (int) $row->day;
            $date = fn (int $y) => Carbon::create($y, $month, min($day, Carbon::create($y, $month, 1)->daysInMonth));
            $events[] = self::occurrence($today, 'local:' . $row->event_id, (string) $row->name, true,
                'Fiestas bring visitors and handaan: drinks, rice, cooking basics, spaghetti, ice and disposable cups and plates.',
                (int) $row->prep_days, 1.8, self::FIESTA_MATCH, $date);
        }

        $upcoming = array_values(array_filter($events, fn ($e) => $e['daysUntil'] >= 0 && $e['daysUntil'] <= $e['prep']));
        usort($upcoming, fn ($a, $b) => $a['daysUntil'] <=> $b['daysUntil']);

        return array_map(function ($e) {
            unset($e['prep']);

            return $e;
        }, $upcoming);
    }

    /** The next time an event happens (today counts), and the same event a year earlier. */
    private static function occurrence(Carbon $today, string $key, string $label, bool $local, string $note, int $prep, float $uplift, string $match, callable $date): array
    {
        $next = $date((int) $today->year)->startOfDay();
        if ($next->lt($today)) {
            $next = $date((int) $today->year + 1)->startOfDay();
        }

        return [
            'key' => $key,
            'label' => $label,
            'local' => $local,
            'note' => $note,
            'date' => $next,
            'lastYearDate' => $date((int) $next->year - 1)->startOfDay(),
            'daysUntil' => (int) $today->diffInDays($next),
            'prep' => $prep,
            'windowDays' => min(self::WINDOW_DAYS, $prep),
            'uplift' => $uplift,
            'match' => $match,
        ];
    }

    /** Easter Sunday (Gregorian), without needing PHP's calendar extension. */
    public static function easter(int $year): Carbon
    {
        $a = $year % 19;
        $b = intdiv($year, 100);
        $c = $year % 100;
        $d = intdiv($b, 4);
        $e = $b % 4;
        $f = intdiv($b + 8, 25);
        $g = intdiv($b - $f + 1, 3);
        $h = (19 * $a + $b - $d - $g + 15) % 30;
        $i = intdiv($c, 4);
        $k = $c % 4;
        $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $month = intdiv($h + $l - 7 * $m + 114, 31);
        $day = (($h + $l - 7 * $m + 114) % 31) + 1;

        return Carbon::create($year, $month, $day);
    }
}
