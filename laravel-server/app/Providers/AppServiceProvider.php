<?php

namespace App\Providers;

use App\Mail\BrevoApiTransport;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // MAIL_MAILER=brevo: send through Brevo's HTTPS API (works on Render's free plan).
        Mail::extend('brevo', fn () => new BrevoApiTransport((string) config('services.brevo.key')));

        // "Forgot password" emails link to the website's reset page, not the API.
        ResetPassword::createUrlUsing(fn ($user, string $token) => self::resetUrl($user->getEmailForPasswordReset(), $token));

        // Branded email (resources/views/emails/password-reset*.blade.php), in the
        // language the request came in with (SetLocale), so __() translates it.
        ResetPassword::toMailUsing(function ($user, string $token) {
            $site = rtrim((string) config('app.frontend_url'), '/');
            $name = trim((string) $user->name);

            return (new MailMessage)
                ->subject(__('Reset your BantayLedger password'))
                ->view(['html' => 'emails.password-reset', 'text' => 'emails.password-reset-text'], [
                    'firstName' => $name !== '' ? strtok($name, ' ') : __('there'),
                    'email' => $user->email,
                    'url' => self::resetUrl($user->getEmailForPasswordReset(), $token),
                    'minutes' => (int) config('auth.passwords.users.expire', 60),
                    'siteUrl' => $site,
                    'logoUrl' => $site.'/email-logo.png',
                    'year' => now()->year,
                ]);
        });
    }

    private static function resetUrl(string $email, string $token): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/reset-password?'.http_build_query([
            'token' => $token,
            'email' => $email,
        ]);
    }
}
