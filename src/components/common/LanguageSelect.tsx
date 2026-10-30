import { IonIcon } from '@ionic/react';
import { languageOutline } from 'ionicons/icons';
import { useId } from 'react';
import { LANGUAGES, t, type LanguageCode } from '../../i18n';
import { useLanguage } from '../../i18n/LanguageContext';
import './LanguageSelect.css';

/**
 * Language picker (English / Filipino / Bisaya). Choosing one saves it and
 * reloads the page so everything is shown in that language.
 */
export function LanguageSelect({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage();
  const id = useId();

  return (
    <div className={['bl-lang', className ?? ''].filter(Boolean).join(' ')}>
      <label htmlFor={id} className="bl-sr-only">
        {t('Language')}
      </label>
      <IonIcon icon={languageOutline} aria-hidden="true" />
      <select
        id={id}
        className="bl-lang__select"
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </div>
  );
}

export default LanguageSelect;
