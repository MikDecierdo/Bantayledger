import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { authClient } from '../services/api/authClient';
import { changeLanguage, currentLanguage, type LanguageCode } from './index';

interface LanguageValue {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
}

const LanguageContext = createContext<LanguageValue>({ language: 'en', setLanguage: () => {} });

/**
 * Holds the chosen language. Choosing one saves it and reloads the page, so
 * every string and number format — including text built once at module load
 * (filter lists, chart labels) — is produced in the new language. Language is
 * a rare, deliberate switch, so the reload is the simplest correct behavior.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<LanguageCode>(currentLanguage());

  const setLanguage = useCallback((code: LanguageCode) => {
    if (code === currentLanguage()) return;
    void changeLanguage(code)
      .then(async () => {
        // Keep the account's saved language in step (ignored when signed out).
        if (authClient.getToken()) await authClient.updateProfile({ language: code }).catch(() => undefined);
      })
      .then(() => {
        setLang(code);
        window.location.reload();
      });
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  return useContext(LanguageContext);
}
