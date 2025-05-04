// src/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Import your translation JSON files
import en from "./src/locales/en/translation.json";
import fr from "./src/locales/fr/translation.json";
import ar from "./src/locales/ar/translation.json";
import hi from "./src/locales/hi/translation.json";
import zh from "./src/locales/zh/translation.json";
import ru from "./src/locales/ru/translation.json";
import it from "./src/locales/it/translation.json";
import de from "./src/locales/de/translation.json";
import es from "./src/locales/es/translation.json";

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  ar: { translation: ar },
  hi: { translation: hi },
  zh: { translation: zh },
  ru: { translation: ru },
  it: { translation: it },
  de: { translation: de },
  es: { translation: es },
};

i18n
  .use(initReactI18next) // pass the i18n instance to react-i18next.
  .init({
    resources,
    fallbackLng: "en",
    lng: "en", // or detect language automatically if you install a detector
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    react: {
      useSuspense: false, // set to true if you want to suspense-load translations
    },
  });

export default i18n;
