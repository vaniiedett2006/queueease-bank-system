import { useLanguage } from '../lib/LanguageContext';
import type { Language } from '../lib/i18n';

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="inline-flex items-center bg-navy-800 rounded-full p-1 shadow-sm border border-navy-600">
      <button
        onClick={() => setLang('en' as Language)}
        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
          lang === 'en'
            ? 'bg-white text-navy-700 shadow-sm'
            : 'text-navy-200 hover:text-white'
        }`}
        aria-label="English"
      >
        EN
      </button>
      <span className="text-navy-400 text-sm font-medium px-1">|</span>
      <button
        onClick={() => setLang('fil' as Language)}
        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
          lang === 'fil'
            ? 'bg-white text-navy-700 shadow-sm'
            : 'text-navy-200 hover:text-white'
        }`}
        aria-label="Filipino"
      >
        FIL
      </button>
    </div>
  );
}
