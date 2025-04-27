// LanguageContext.tsx
import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "../i18n";

type Language = "fr" | "en" | "es" | "de" | "zh" | "ar" | "hi";

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>("en");

  const supportedLanguages: Language[] = ["fr", "en", "es", "de", "zh", "ar", "hi"];

  const setLanguage = async (lang: Language) => {
  try {
    setLanguageState(lang); // ⬅️ D'abord changer l'état React pour forcer le rerendu
    await i18n.changeLanguage(lang); // ⬅️ Ensuite changer la langue dans i18n
    await AsyncStorage.setItem("appLanguage", lang);
  } catch (error) {
    console.error("Erreur lors du changement de langue :", error);
  }
};

  useEffect(() => {
    (async () => {
      try {
        const savedLang = await AsyncStorage.getItem("appLanguage");
        if (savedLang && isValidLanguage(savedLang)) {
          await i18n.changeLanguage(savedLang);
          setLanguageState(savedLang as Language);
        } else {
          const deviceLang = Localization.locale.split("-")[0] as Language;
          const defaultLang: Language = supportedLanguages.includes(deviceLang) ? deviceLang : "en";
          await i18n.changeLanguage(defaultLang);
          setLanguageState(defaultLang);
          await AsyncStorage.setItem("appLanguage", defaultLang);
        }
      } catch (error) {
        console.error("Erreur lors de l'initialisation de la langue :", error);
      }
    })();
  }, []);

  const isValidLanguage = (lang: string): lang is Language => {
    return supportedLanguages.includes(lang as Language);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
