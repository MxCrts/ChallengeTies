// LanguageContext.tsx
import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "../i18n";

/** ⇣ aligne avec i18n.ts */
type Language = "en" | "fr" | "es" | "de" | "zh" | "ar" | "hi" | "ru" | "it";
const SUPPORTED_LANGS: Language[] = ["en","fr","es","de","zh","ar","hi","ru","it"];

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

/** --- helpers robustes SDK 53+ --- */
const resolveSystemTag = (): string => {
  try {
    // Nouvel API SDK 53+
    const getLocales = (Localization as any)?.getLocales;
    if (typeof getLocales === "function") {
      const arr = getLocales();
      const tag = arr?.[0]?.languageTag; // ex: "fr-FR"
      if (tag) return String(tag);
    }
    // Legacy (SDK plus anciens)
    const legacy = (Localization as any)?.locale;
    if (legacy) return String(legacy);
  } catch {}
  return "en";
};

const pickSupported = (tag: string): Language => {
  const lang = String(tag).split(/[-_]/)[0]?.toLowerCase() || "en";
  return (SUPPORTED_LANGS as readonly string[]).includes(lang) ? (lang as Language) : "en";
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>("en");

  const setLanguage = async (lang: Language) => {
    try {
      setLanguageState(lang);           // rerender d'abord
      await i18n.changeLanguage(lang);  // puis i18n
      await AsyncStorage.setItem("appLanguage", lang);
    } catch (error) {
      console.error("Erreur lors du changement de langue :", error);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("appLanguage");
        let initial: Language;

        if (saved && (SUPPORTED_LANGS as readonly string[]).includes(saved)) {
          initial = saved as Language;
        } else {
          const systemTag = resolveSystemTag();   // jamais undefined
          initial = pickSupported(systemTag);     // map vers langue supportée
        }

        setLanguageState(initial);
        await i18n.changeLanguage(initial);
        await AsyncStorage.setItem("appLanguage", initial);
      } catch (error) {
        console.error("Erreur lors de l'initialisation de la langue :", error);
      }
    })();
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
};
