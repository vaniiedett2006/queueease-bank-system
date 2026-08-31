import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Language } from './i18n';
import { translate } from './i18n';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem('queueease-lang');
    return stored === 'fil' ? 'fil' : 'en';
  });

  useEffect(() => {
    localStorage.setItem('queueease-lang', lang);
  }, [lang]);

  const setLang = (l: Language) => setLangState(l);
  const t = (key: string) => translate(key, lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
