/**
 * Internationalization Context for OpenClaw Mobile H5
 */

import { createContext, useContext, useState, ReactNode } from "react";
import { zh, en } from "../i18n/translations";

type Language = "zh" | "en";

interface Translations {
  [key: string]: string;
}

const translations: Record<Language, Translations> = { zh, en };

interface I18nContextType {
  language: Language;
  t: (key: string) => string;
  setLanguage: (lang: Language) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

/**
 * I18n Provider Component
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  // 从 localStorage 读取语言设置，默认中文
  const getInitialLanguage = (): Language => {
    if (typeof window === "undefined") return "zh";
    try {
      const saved = localStorage.getItem("openclaw-language") as Language;
      if (saved === "zh" || saved === "en") return saved;
    } catch {
      // Ignore error
    }
    return "zh";
  };

  const [language, setLanguageState] = useState<Language>(getInitialLanguage());

  const t = (key: string): string => {
    return translations[language]?.[key] || key;
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("openclaw-language", lang);
    }
  };

  return (
    <I18nContext.Provider value={{ language, t, setLanguage }}>{children}</I18nContext.Provider>
  );
}

/**
 * Hook to use i18n translations
 */
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
