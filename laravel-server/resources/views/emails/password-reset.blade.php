{{--
    "Forgot password" email (AppServiceProvider → ResetPassword::toMailUsing).
    Email-safe markup: tables and inline styles only, because Gmail and Outlook
    drop most <style> rules. The card is fluid (max 600px), so it fits phones.
--}}
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{{ __('Reset your password') }}</title>
{{-- Phones: tighter padding (Gmail, Apple Mail and most apps read this; others keep the desktop spacing). --}}
<style>
    @media only screen and (max-width: 480px) {
        .bl-outer { padding: 20px 10px 28px !important; }
        .bl-card { padding: 26px 20px 24px !important; }
        .bl-title { font-size: 23px !important; line-height: 29px !important; }
        .bl-button a { display: block !important; text-align: center !important; }
        .bl-button { width: 100% !important; }
    }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F3F5F4; -webkit-text-size-adjust:100%;">

{{-- Inbox preview line (hidden in the email itself). --}}
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F3F5F4;">
    {{ __('Use this link within :minutes minutes to choose a new password.', ['minutes' => $minutes]) }}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F5F4;">
<tr>
<td align="center" class="bl-outer" style="padding:32px 16px 40px;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

        {{-- Brand row --}}
        <tr>
            <td style="padding:0 4px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td valign="middle" style="padding-right:12px;">
                            <a href="{{ $siteUrl }}" style="text-decoration:none;">
                                <img src="{{ $logoUrl }}" width="48" height="48" alt="BantayLedger" style="display:block; width:48px; height:48px; border:0; border-radius:50%;">
                            </a>
                        </td>
                        <td valign="middle" style="font-family:Arial, Helvetica, sans-serif;">
                            <a href="{{ $siteUrl }}" style="text-decoration:none; color:#14201C; font-size:19px; font-weight:bold; letter-spacing:-0.2px;">BantayLedger <span style="color:#1F6F5B;">AI</span></a>
                            <div style="font-size:12px; color:#6B7672; padding-top:2px;">{{ __('Business & forecast tracker') }}</div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>

        {{-- Card --}}
        <tr>
            <td class="bl-card" style="background-color:#FFFFFF; border:1px solid #DFE6E3; border-top:4px solid #1F6F5B; border-radius:12px; padding:36px 36px 32px; font-family:Arial, Helvetica, sans-serif; color:#33403C;">

                <div style="font-size:12px; font-weight:bold; letter-spacing:1.2px; text-transform:uppercase; color:#1F6F5B;">{{ __('Password reset') }}</div>
                <h1 class="bl-title" style="margin:8px 0 20px; font-size:26px; line-height:32px; font-weight:bold; color:#14201C; letter-spacing:-0.3px;">{{ __('Reset your password') }}</h1>

                <p style="margin:0 0 12px; font-size:16px; line-height:24px;">{{ __('Hi :name,', ['name' => $firstName]) }}</p>
                <p style="margin:0 0 28px; font-size:16px; line-height:24px;">
                    {{ __('We received a request to reset the password for your BantayLedger AI account,') }}
                    <strong style="color:#14201C;">{{ $email }}</strong>.
                    {{ __('Tap the button below to choose a new one.') }}
                </p>

                {{-- Button (a table, so Outlook draws it too) --}}
                <table role="presentation" class="bl-button" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                    <tr>
                        <td align="center" bgcolor="#1F6F5B" style="border-radius:8px;">
                            <a href="{{ $url }}" target="_blank" style="display:inline-block; padding:14px 28px; font-family:Arial, Helvetica, sans-serif; font-size:16px; font-weight:bold; color:#FFFFFF; text-decoration:none; border-radius:8px;">{{ __('Choose a new password') }}</a>
                        </td>
                    </tr>
                </table>

                {{-- Two facts about the link --}}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF6F2; border-radius:8px; margin:0 0 24px;">
                    <tr>
                        <td width="50%" valign="top" style="padding:14px 16px; border-right:1px solid #D5E7DE;">
                            <div style="font-size:11px; font-weight:bold; letter-spacing:0.8px; text-transform:uppercase; color:#5C6B66;">{{ __('Expires') }}</div>
                            <div style="font-size:15px; font-weight:bold; color:#14201C; padding-top:3px;">{{ __('In :minutes minutes', ['minutes' => $minutes]) }}</div>
                        </td>
                        <td width="50%" valign="top" style="padding:14px 16px;">
                            <div style="font-size:11px; font-weight:bold; letter-spacing:0.8px; text-transform:uppercase; color:#5C6B66;">{{ __('Works') }}</div>
                            <div style="font-size:15px; font-weight:bold; color:#14201C; padding-top:3px;">{{ __('One time only') }}</div>
                        </td>
                    </tr>
                </table>

                <p style="margin:0 0 4px; font-size:14px; line-height:21px; color:#14201C; font-weight:bold;">{{ __('Didn\'t ask for this?') }}</p>
                <p style="margin:0 0 28px; font-size:14px; line-height:21px; color:#5C6B66;">
                    {{ __('You can ignore this email. Your password won\'t change, and someone may have typed your email by mistake.') }}
                </p>

                {{-- Fallback link --}}
                <div style="border-top:1px solid #E6ECEA; padding-top:20px;">
                    <p style="margin:0 0 8px; font-size:13px; line-height:19px; color:#6B7672;">{{ __('Button not working? Copy this link into your browser:') }}</p>
                    <div style="background-color:#F6F8F7; border:1px solid #E6ECEA; border-radius:6px; padding:10px 12px; font-family:Consolas, 'Courier New', monospace; font-size:12px; line-height:18px; word-break:break-all;">
                        <a href="{{ $url }}" target="_blank" style="color:#1F6F5B; text-decoration:none;">{{ $url }}</a>
                    </div>
                </div>

            </td>
        </tr>

        {{-- Footer --}}
        <tr>
            <td align="center" style="padding:24px 16px 0; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:#7D8884;">
                <p style="margin:0 0 6px;"><strong style="color:#5C6B66;">BantayLedger AI</strong> · {{ __('For Philippine sari-sari stores and small shops') }}</p>
                <p style="margin:0 0 6px;">{{ __('You received this because a password reset was requested for :email.', ['email' => $email]) }}</p>
                <p style="margin:0;">© {{ $year }} BantayLedger AI · <a href="{{ $siteUrl }}" style="color:#7D8884; text-decoration:underline;">{{ preg_replace('#^https?://#', '', $siteUrl) }}</a></p>
            </td>
        </tr>

    </table>

</td>
</tr>
</table>
</body>
</html>
