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

        // Sent in the user's language (User::preferredLocale), so __() below translates.
        ResetPassword::toMailUsing(function ($user, string $token) {
            $minutes = (int) config('auth.passwords.users.expire', 60);

            return (new MailMessage)
                ->subject(__('Reset your BantayLedger password'))
                ->greeting(__('Hi :name,', ['name' => $user->name ?: __('there')]))
                ->line(__('We received a request to reset the password for your BantayLedger AI account (:email).', ['email' => $user->email]))
                ->action(__('Choose a new password'), self::resetUrl($user->getEmailForPasswordReset(), $token))
                ->line(__('This link expires in :minutes minutes and can only be used once.', ['minutes' => $minutes]))
                ->line(__('If you did not ask to reset your password, you can ignore this email. Your password will stay the same.'))
                ->salutation(__('— BantayLedger AI'));
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
