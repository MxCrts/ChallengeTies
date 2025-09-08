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

// ===== Détection robuste du locale (SDK 53+, fallback anciens) =====
const resolveSystemTag = (): string => {
  try {
    const getLocales = (Localization as any)?.getLocales;
    if (typeof getLocales === "function") {
      const arr = getLocales();
      const tag = arr?.[0]?.languageTag; // e.g. "fr-FR"
      if (tag) return String(tag);
    }
    const legacy = (Localization as any)?.locale; // anciens SDK
    if (legacy) return String(legacy);            // e.g. "fr-FR"
  } catch {}
  return "en";
};

const pickSupported = (tag: string): string => {
  // toujours forcer en string AVANT split:
  const lang = String(tag).split(/[-_]/)[0]?.toLowerCase() || "en";
  const SUPPORTED = ["en","fr","es","de","zh","ar","hi","ru","it"] as const;
  return (SUPPORTED as readonly string[]).includes(lang) ? lang : "en";
};

const deviceLanguage = pickSupported(resolveSystemTag());

/** Post-processor: garantit qu'on renvoie toujours une string
 * - Évite l'erreur iOS "Text strings must be rendered within a <Text> component"
 *   si jamais une clé renvoie un array/objet/null par accident.
 */

// (optionnel) post-processor pour garantir une string
i18n.use({
  type: "postProcessor",
  name: "ensureString",
  process(value) {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.join("\n");
    if (value == null) return "";
    try { return String(value); } catch { return ""; }
  },
});

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: deviceLanguage,
    fallbackLng: "en",
    supportedLngs: ["en","fr","es","de","zh","ar","hi","ru","it"],
    nonExplicitSupportedLngs: true,
    returnObjects: false,
    returnNull: false,
    joinArrays: "\n",
    postProcess: ["ensureString"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });


export default i18n;
