import { create } from 'zustand';
import i18n from '../i18n';

interface I18nSlice {
  locale: string;
  direction: 'ltr' | 'rtl';
  setLocale: (locale: string) => void;
}

const RTL_LOCALES = ['ar', 'he', 'fa'];

function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}

export const useI18nStore = create<I18nSlice>((set) => ({
  locale: 'en',
  direction: 'ltr',

  setLocale: (locale: string) => {
    const direction = getDirection(locale);

    // Update i18next language
    i18n.changeLanguage(locale);

    // Update document direction
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', locale);

    set({ locale, direction });
  },
}));
