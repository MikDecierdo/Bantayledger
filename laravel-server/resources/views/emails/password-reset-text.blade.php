{!! __('Reset your password') !!} — BantayLedger AI

{!! __('Hi :name,', ['name' => $firstName]) !!}

{!! __('We received a request to reset the password for your BantayLedger AI account,') !!} {!! $email !!}. {!! __('Open the link below to choose a new one.') !!}

{!! $url !!}

{!! __('Expires') !!}: {!! __('In :minutes minutes', ['minutes' => $minutes]) !!}
{!! __('Works') !!}: {!! __('One time only') !!}

{!! __('Didn\'t ask for this?') !!} {!! __('You can ignore this email. Your password won\'t change, and someone may have typed your email by mistake.') !!}

--
BantayLedger AI · {!! __('For Philippine sari-sari stores and small shops') !!}
{!! __('You received this because a password reset was requested for :email.', ['email' => $email]) !!}
{!! $siteUrl !!}
