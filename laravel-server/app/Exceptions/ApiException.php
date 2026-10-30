<?php

namespace App\Exceptions;

use Exception;

/**
 * A user-facing API error. Every controller/service throws this instead of
 * formatting its own JSON response, so status code -> message stays
 * consistent in one place (see bootstrap/app.php's exception rendering).
 *
 * Messages are English templates with `:name` placeholders; they are
 * translated into the request's language (lang/tl.json, lang/ceb.json) when
 * the exception is created.
 */
class ApiException extends Exception
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }

    /** @param array<string, scalar|null> $replace */
    private static function make(int $status, string $message, array $replace = []): self
    {
        return new self($status, __($message, $replace));
    }

    /** @param array<string, scalar|null> $replace */
    public static function badRequest(string $message, array $replace = []): self
    {
        return self::make(400, $message, $replace);
    }

    public static function unauthorized(string $message = 'You must be signed in to do that.'): self
    {
        return self::make(401, $message);
    }

    public static function forbidden(string $message = 'You do not have access to that.'): self
    {
        return self::make(403, $message);
    }

    public static function notFound(string $message = 'That could not be found.'): self
    {
        return self::make(404, $message);
    }

    /** @param array<string, scalar|null> $replace */
    public static function conflict(string $message, array $replace = []): self
    {
        return self::make(409, $message, $replace);
    }

    public static function unprocessable(string $message): self
    {
        return self::make(422, $message);
    }

    public static function tooManyRequests(string $message): self
    {
        return self::make(429, $message);
    }

    public static function badGateway(string $message): self
    {
        return self::make(502, $message);
    }
}
