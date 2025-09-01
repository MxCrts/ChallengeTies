// src/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

// ⚠️ Chemins corrigés (i18n.ts est dans src/)
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

const SUPPORTED_LANGS = ["en", "fr", "es", "de", "zh", "ar", "hi", "ru", "it"] as const;

// Détection robuste (Expo nouveaux/anciens SDK, web)
const getSupportedLanguage = (forceLocale?: string): string => {
  let detected: string | undefined = forceLocale;

  if (!detected) {
    try {
      if (typeof (Localization as any)?.getLocales === "function") {
        const loc = (Localization as any).getLocales();
        if (Array.isArray(loc) && loc[0]?.languageTag) {
          detected = String(loc[0].languageTag); // ex: "fr-FR" ou "pt_BR"
        }
      }
      if (!detected && (Localization as any)?.locale) {
        detected = String((Localization as any).locale); // ex: "fr-FR"
      }
    } catch {
      // ignore
    }
  }

  const tag = (detected || "en").toString();
  const lang = (tag.split(/[-_]/)[0] || "en").toLowerCase();
  return (SUPPORTED_LANGS as readonly string[]).includes(lang) ? lang : "en";
};

const deviceLanguage = getSupportedLanguage();

/** Post-processor: garantit qu'on renvoie toujours une string
 * - Évite l'erreur iOS "Text strings must be rendered within a <Text> component"
 *   si jamais une clé renvoie un array/objet/null par accident.
 */
i18n.use({
  type: "postProcessor",
  name: "ensureString",
  process(value) {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.join("\n");
    if (value == null) return "";
    try {
      return String(value);
    } catch {
      return "";
    }
  },
});

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage,
  fallbackLng: "en",
  supportedLngs: SUPPORTED_LANGS as unknown as string[],
  nonExplicitSupportedLngs: true,

  // 🔒 Important en React Native / iOS
  returnObjects: false,        // pas d'objets dans <Text>
  returnNull: false,           // évite null dans <Text>
  joinArrays: "\n",            // si un tableau passe, on le joint proprement
  postProcess: ["ensureString"],

  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
