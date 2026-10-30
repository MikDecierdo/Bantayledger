import { IonIcon } from '@ionic/react';
import { checkmarkCircle, ellipseOutline } from 'ionicons/icons';
import { evaluatePassword, type StrengthLevel } from '../../utils/passwordStrength';
import { t } from '../../i18n';
import './PasswordStrength.css';

function levelName(level: StrengthLevel): string {
  switch (level) {
    case 1:
      return t('Weak');
    case 2:
      return t('Fair');
    case 3:
      return t('Good');
    case 4:
      return t('Strong');
    default:
      return '';
  }
}

/** Live strength meter and rule checklist shown under a "new password" field. */
export function PasswordStrength({ password }: { password: string }) {
  const { rules, level } = evaluatePassword(password, {
    length: t('At least 8 characters'),
    upper: t('An uppercase letter (A–Z)'),
    lower: t('A lowercase letter (a–z)'),
    number: t('A number (0–9)'),
    symbol: t('A symbol (! @ # ? …)'),
  });

  return (
    <div className={`bl-pw bl-pw--l${level}`}>
      <div className="bl-pw__meter">
        <div className="bl-pw__bars" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <span className="bl-pw__label" aria-live="polite">
          {level ? t('Password strength: {{level}}', { level: levelName(level) }) : t('Password strength')}
        </span>
      </div>
      <ul className="bl-pw__rules">
        {rules.map((r) => (
          <li key={r.id} className={r.met ? 'is-met' : undefined}>
            <IonIcon icon={r.met ? checkmarkCircle : ellipseOutline} aria-hidden="true" />
            <span>{r.label}</span>
            <span className="bl-sr-only">{r.met ? t('done') : t('not yet')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PasswordStrength;
