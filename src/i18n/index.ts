import i18next from 'i18next';
import ceb from './locales/ceb.json';
import tl from './locales/tl.json';

/*
 * Languages: English (the source text), Tagalog (Filipino) and Cebuano
 * (Bisaya).
 *
 * The English sentence IS the translation key — t('Add Sale') — so English
 * needs no dictionary and a missing translation simply shows English instead
 * of breaking a screen. `tl.json` and `ceb.json` map English -> translation.
 * To add another language (e.g. Hiligaynon or Waray): add a JSON file, import
 * it below, and add one entry to LANGUAGES.
 *
 * `t` is the global translator, usable anywhere (components, helpers, toasts,
 * receipts). Changing the language remounts the app tree (see
 * LanguageProvider), so text evaluated during render is always current.
 */

export type LanguageCode = 'en' | 'tl' | 'ceb';

export interface LanguageOption {
  code: LanguageCode;
  /** Name in its own language, shown in the picker. */
  native: string;
  /** BCP-47 tag for Intl number/date formatting. */
  intl: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', native: 'English', intl: 'en-PH' },
  { code: 'tl', native: 'Filipino (Tagalog)', intl: 'fil-PH' },
  { code: 'ceb', native: 'Bisaya (Cebuano)', intl: 'ceb-PH' },
];

const STORAGE_KEY = 'bl-lang';

function isLanguage(value: string | null | undefined): value is LanguageCode {
  return value === 'en' || value === 'tl' || value === 'ceb';
}

/** Saved choice first, then the browser's language, else English. */
export function detectLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    /* storage unavailable: fall through */
  }
  const preferred = (typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [])
    .map((l) => l.toLowerCase());
  for (const l of preferred) {
    if (l.startsWith('ceb')) return 'ceb';
    if (l.startsWith('fil') || l.startsWith('tl')) return 'tl';
  }
  return 'en';
}

void i18next.init({
  lng: detectLanguage(),
  fallbackLng: 'en',
  resources: {
    en: { translation: {} },
    tl: { translation: tl },
    ceb: { translation: ceb },
  },
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
  initAsync: false,
});

if (typeof document !== 'undefined') document.documentElement.lang = i18next.language;

/** True when this browser already has a saved language choice. */
export function hasSavedLanguage(): boolean {
  try {
    return isLanguage(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export function currentLanguage(): LanguageCode {
  return isLanguage(i18next.language) ? i18next.language : 'en';
}

/** Intl locale for the active language, with a fallback the runtime supports. */
export function intlLocale(): string {
  const wanted = LANGUAGES.find((l) => l.code === currentLanguage())?.intl ?? 'en-PH';
  try {
    return Intl.NumberFormat.supportedLocalesOf([wanted]).length > 0 ? wanted : 'fil-PH';
  } catch {
    return 'en-PH';
  }
}

export async function changeLanguage(code: LanguageCode): Promise<void> {
  await i18next.changeLanguage(code);
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* the choice just won't persist */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = code;
}

export type TranslateOptions = Record<string, string | number | boolean | null | undefined>;

/** Translate an English sentence. `{{name}}` placeholders are filled from `options`. */
export const t = (key: string, options?: TranslateOptions): string =>
  i18next.t(key, options as never) as unknown as string;

export default i18next;
