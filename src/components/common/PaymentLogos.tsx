/**
 * Artwork for the payment-method cards: the GCash logo (supplied file in
 * public/) and a generic, original peso-note illustration (not real banknote
 * artwork).
 */

interface LogoProps {
  size?: number;
}

export function GCashLogo({ size = 44 }: LogoProps) {
  return (
    <img
      src="/gcash-logo.png"
      alt=""
      aria-hidden="true"
      width={Math.round(size * (490 / 414))}
      height={size}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  );
}

export function PesoCashLogo({ size = 44 }: LogoProps) {
  const w = size * (64 / 48);
  return (
    <svg width={w} height={size} viewBox="0 0 64 48" aria-hidden="true" focusable="false">
      {/* Banknote */}
      <rect x="2" y="8" width="54" height="30" rx="5" fill="#2E8F73" />
      <rect x="5.5" y="11.5" width="47" height="23" rx="3" fill="none" stroke="#BDE8D8" strokeWidth="1.2" />
      <circle cx="29" cy="23" r="8" fill="#BDE8D8" />
      <text
        x="29"
        y="27.6"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#1F6F58"
      >
        ₱
      </text>
      <circle cx="10.5" cy="17" r="2" fill="#BDE8D8" />
      <circle cx="47.5" cy="29" r="2" fill="#BDE8D8" />
      {/* Coin */}
      <circle cx="51" cy="35" r="10" fill="#F2B632" />
      <circle cx="51" cy="35" r="7.4" fill="none" stroke="#D99A14" strokeWidth="1.2" />
      <text
        x="51"
        y="39.2"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#9A6A07"
      >
        ₱
      </text>
    </svg>
  );
}
