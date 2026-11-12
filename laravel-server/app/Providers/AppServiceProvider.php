<?php

namespace App\Providers;

use App\Mail\BrevoApiTransport;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
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
        // Sign-in and sign-up tries per minute, so a password can't be guessed by
        // trying thousands. Counted per email and per device address, so one
        // person's mistakes never lock out other stores.
        $tooMany = fn () => response()->json(['message' => __('Too many tries. Please wait a minute, then try again.')], 429);
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(10)->by('login|'.strtolower(trim((string) $request->input('email'))).'|'.$request->ip())->response($tooMany),
            Limit::perMinute(30)->by('login-ip|'.$request->ip())->response($tooMany),
        ]);
        RateLimiter::for('signup', fn (Request $request) => [
            Limit::perMinute(5)->by('signup|'.$request->ip())->response($tooMany),
            Limit::perHour(30)->by('signup-hour|'.$request->ip())->response($tooMany),
        ]);

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
