<?php

namespace App\Support;

use Stringable;

/**
 * A user-facing sentence kept as an English template plus its parameters
 * (`:name` placeholders), so it can be stored language-neutral and shown in
 * the reader's language later through Laravel's JSON translation files
 * (lang/tl.json, lang/ceb.json).
 *
 * Cast to string it renders in English. Parameters may themselves be Msg
 * objects (a translatable fragment inside a sentence), and a `['date' => ...]`
 * parameter renders as a short date with a translated month name.
 */
final class Msg implements Stringable
{
    /** @param array<string, mixed> $params */
    public function __construct(public readonly string $key, public readonly array $params = [])
    {
    }

    /** @param array<string, mixed> $params */
    public static function of(string $key, array $params = []): self
    {
        return new self($key, $params);
    }

    public function __toString(): string
    {
        return self::render($this->toArray(), 'en');
    }

    /** Storable form: ['k' => key, 'p' => params], nested Msg objects expanded the same way. */
    public function toArray(): array
    {
        $p = [];
        foreach ($this->params as $name => $value) {
            $p[$name] = $value instanceof self ? $value->toArray() : $value;
        }

        return ['k' => $this->key, 'p' => $p];
    }

    /** Renders a stored spec in the given locale. */
    public static function render(array $spec, string $locale): string
    {
        $params = [];
        foreach (($spec['p'] ?? []) as $name => $value) {
            if (is_array($value) && isset($value['k'])) {
                $params[$name] = self::render($value, $locale);
            } elseif (is_array($value) && isset($value['date'])) {
                $params[$name] = self::shortDate((string) $value['date'], $locale);
            } else {
                $params[$name] = (string) $value;
            }
        }

        return __($spec['k'], $params, $locale);
    }

    /**
     * A stored value is either a plain string (older rows) or a spec array.
     * Returns a string for specs and passes anything else through.
     */
    public static function resolve(mixed $value, string $locale): mixed
    {
        return is_array($value) && isset($value['k']) ? self::render($value, $locale) : $value;
    }

    private static function shortDate(string $iso, string $locale): string
    {
        $t = strtotime($iso);
        if ($t === false) {
            return $iso;
        }

        return __(date('M', $t), [], $locale) . ' ' . date('j', $t);
    }
}
