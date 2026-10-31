<?php

namespace App\Mail;

use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\MessageConverter;

/**
 * Sends mail through Brevo's HTTPS API (https://api.brevo.com/v3/smtp/email).
 *
 * Render's free plan blocks outgoing SMTP ports (25/465/587), so the usual
 * `smtp` mailer cannot reach Brevo from there; the HTTPS API works anywhere.
 * Enabled with MAIL_MAILER=brevo and BREVO_API_KEY (see AppServiceProvider).
 */
class BrevoApiTransport extends AbstractTransport
{
    private const ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

    public function __construct(private readonly string $apiKey)
    {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        if ($this->apiKey === '') {
            throw new TransportException('Brevo is not set up: BREVO_API_KEY is empty.');
        }

        $email = MessageConverter::toEmail($message->getOriginalMessage());
        $from = $email->getFrom()[0] ?? null;
        if (! $from) {
            throw new TransportException('The email has no sender (MAIL_FROM_ADDRESS).');
        }

        $payload = array_filter([
            'sender' => self::address($from),
            'to' => array_map(self::address(...), $email->getTo()),
            'cc' => array_map(self::address(...), $email->getCc()),
            'bcc' => array_map(self::address(...), $email->getBcc()),
            'replyTo' => isset($email->getReplyTo()[0]) ? self::address($email->getReplyTo()[0]) : null,
            'subject' => (string) $email->getSubject(),
            'htmlContent' => self::body($email->getHtmlBody()),
            'textContent' => self::body($email->getTextBody()),
        ], fn ($value) => $value !== null && $value !== [] && $value !== '');

        $response = Http::withHeaders(['api-key' => $this->apiKey])
            ->acceptJson()
            ->timeout(20)
            ->post(self::ENDPOINT, $payload);

        if ($response->failed()) {
            throw new TransportException(sprintf('Brevo refused the email (HTTP %d): %s', $response->status(), $response->body()));
        }
    }

    /** @return array{email: string, name?: string} */
    private static function address(Address $address): array
    {
        return array_filter(['email' => $address->getAddress(), 'name' => $address->getName()]);
    }

    /** @param resource|string|null $body */
    private static function body(mixed $body): ?string
    {
        if (is_resource($body)) {
            return stream_get_contents($body) ?: null;
        }

        return $body === null ? null : (string) $body;
    }

    public function __toString(): string
    {
        return 'brevo+api://api.brevo.com';
    }
}
