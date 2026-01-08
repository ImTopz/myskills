import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zh from './locales/zh.json';
import en from './locales/en.json';

const resources = {
  zh: { translation: zh },
  en: { translation: en },
};

type SupportedLanguage = keyof typeof resources;

const LANGUAGE_STORAGE_KEY = 'myskills.language';

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === 'zh' || value === 'en';
}

function getStoredLanguage(): SupportedLanguage | null {
  try {
    if (typeof window === 'undefined') return null;
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

function detectSystemLanguage(): SupportedLanguage {
  try {
    if (typeof navigator === 'undefined') return 'en';
    const candidates = Array.isArray(navigator.languages)
      ? navigator.languages
      : [navigator.language];
    const lang = (candidates.find(Boolean) || '').toLowerCase();
    return lang.startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

const initialLanguage: SupportedLanguage = getStoredLanguage() ?? detectSystemLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
