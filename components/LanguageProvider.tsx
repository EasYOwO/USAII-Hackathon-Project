'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Languages } from 'lucide-react';

export type AppLanguage = 'en' | 'zh' | 'ms';

export type LocalizedText = {
  en: string;
  zh: string;
  ms?: string;
};

type LanguageContextValue = {
  language: AppLanguage;
  hasChosenLanguage: boolean;
  chooseLanguage: (language: AppLanguage) => void;
  t: (text: LocalizedText) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const storageKey = 'report-workflow-language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>('zh');
  const [hasChosenLanguage, setHasChosenLanguage] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved === 'en' || saved === 'zh' || saved === 'ms') {
      setLanguage(saved);
      setHasChosenLanguage(true);
      document.documentElement.lang = saved === 'zh' ? 'zh-CN' : saved === 'ms' ? 'ms-MY' : 'en';
    }
    setReady(true);
  }, []);

  function chooseLanguage(nextLanguage: AppLanguage) {
    setLanguage(nextLanguage);
    setHasChosenLanguage(true);
    sessionStorage.setItem(storageKey, nextLanguage);
    sessionStorage.setItem('elderly-flow-active', '1');
    document.documentElement.lang = nextLanguage === 'zh' ? 'zh-CN' : nextLanguage === 'ms' ? 'ms-MY' : 'en';
  }

  const value = useMemo(
    () => ({
      language,
      hasChosenLanguage,
      chooseLanguage,
      t: (item: LocalizedText) => item[language] ?? item.en,
    }),
    [hasChosenLanguage, language],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
      {ready && !hasChosenLanguage ? <LanguageGate onChoose={chooseLanguage} /> : null}
    </LanguageContext.Provider>
  );
}

function LanguageGate({ onChoose }: { onChoose: (language: AppLanguage) => void }) {
  return (
    <div className="language-gate" role="dialog" aria-modal="true" aria-labelledby="language-gate-title">
      <div className="language-gate-panel ui-language-gate">
        <span className="language-gate-icon">
          <Languages size={26} />
        </span>
        <div>
          <h2 id="language-gate-title">Choose language / Pilih Bahasa / 选择语言</h2>
        </div>
        <div className="language-gate-actions tri-language">
          <button className="btn primary" type="button" onClick={() => onChoose('en')}>
            English
          </button>
          <button className="btn primary" type="button" onClick={() => onChoose('ms')}>
            Bahasa Melayu
          </button>
          <button className="btn primary" type="button" onClick={() => onChoose('zh')}>
            中文
          </button>
        </div>
      </div>
    </div>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
}

export function LanguageSwitch() {
  const { chooseLanguage, language } = useLanguage();

  return (
    <div className="language-switch" aria-label="Language selector">
      <button className={language === 'zh' ? 'active' : ''} type="button" onClick={() => chooseLanguage('zh')}>
        中文
      </button>
      <button className={language === 'ms' ? 'active' : ''} type="button" onClick={() => chooseLanguage('ms')}>
        BM
      </button>
      <button className={language === 'en' ? 'active' : ''} type="button" onClick={() => chooseLanguage('en')}>
        EN
      </button>
    </div>
  );
}
