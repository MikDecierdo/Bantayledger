export interface PasswordRule {
  id: 'length' | 'upper' | 'lower' | 'number' | 'symbol';
  label: string;
  met: boolean;
}

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrengthResult {
  rules: PasswordRule[];
  /** 0 = empty, 1 = Weak, 2 = Fair, 3 = Good, 4 = Strong */
  level: StrengthLevel;
  /** Every required rule is met. */
  ok: boolean;
}

export function evaluatePassword(password: string, labels: Record<PasswordRule['id'], string>): PasswordStrengthResult {
  const rules: PasswordRule[] = [
    { id: 'length', label: labels.length, met: password.length >= 8 },
    { id: 'upper', label: labels.upper, met: /[A-Z]/.test(password) },
    { id: 'lower', label: labels.lower, met: /[a-z]/.test(password) },
    { id: 'number', label: labels.number, met: /\d/.test(password) },
    { id: 'symbol', label: labels.symbol, met: /[^A-Za-z0-9]/.test(password) },
  ];
  const met = rules.filter((r) => r.met).length;
  const ok = met === rules.length;

  let level: StrengthLevel = 0;
  if (password) {
    if (ok) level = password.length >= 12 ? 4 : 3;
    else level = met >= 3 ? 2 : 1;
  }
  return { rules, level, ok };
}
