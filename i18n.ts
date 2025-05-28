// src/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

// Import des traductions
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

// Mapper les codes de langue système aux langues supportées
const getSupportedLanguage = (locale: string): string => {
  const lang = locale.split("-")[0].toLowerCase(); // Ex. : "es-ES" -> "es"
  const supportedLanguages = [
    "en",
    "fr",
    "es",
    "de",
    "zh",
    "ar",
    "hi",
    "ru",
    "it",
  ];
  return supportedLanguages.includes(lang) ? lang : "en"; // Fallback à "en"
};

// Récupérer la langue de l'appareil
const deviceLanguage = getSupportedLanguage(Localization.locale);

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage, // Langue détectée automatiquement
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React protège déjà contre XSS
  },
  react: {
    useSuspense: false, // Pas de suspense pour chargement initial
  },
});

export default i18n;
