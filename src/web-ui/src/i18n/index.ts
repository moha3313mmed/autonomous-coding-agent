import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Lazy-load locale namespaces
const loadLocaleResources = async (locale: string, namespace: string) => {
  try {
    const module = await import(`./locales/${locale}/${namespace}.json`);
    return module.default;
  } catch {
    console.warn(`Failed to load locale: ${locale}/${namespace}`);
    return {};
  }
};

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common'],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
  backend: {
    loadPath: './locales/{{lng}}/{{ns}}.json',
  },
});

// Pre-load common namespace for default language
loadLocaleResources('en', 'common').then((resources) => {
  i18n.addResourceBundle('en', 'common', resources, true, true);
});

loadLocaleResources('ar', 'common').then((resources) => {
  i18n.addResourceBundle('ar', 'common', resources, true, true);
});

export default i18n;
