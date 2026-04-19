import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { LOCALES, LANGUAGES, detectBrowserLang } from './locales.js';

const I18nContext = createContext(null);
const STORAGE_KEY = 'wps_lang';

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LOCALES[saved]) return saved;
  } catch {}
  return detectBrowserLang();
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  const setLang = useCallback((newLang) => {
    if (!LOCALES[newLang]) return;
    setLangState(newLang);
    try { localStorage.setItem(STORAGE_KEY, newLang); } catch {}
  }, []);

  // Applique dir/lang sur <html> à chaque changement
  useEffect(() => {
    const meta = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
    document.body.classList.toggle('rtl', meta.dir === 'rtl');
  }, [lang]);

  // t('key') ou t('key', { name: 'Safwan' }) pour interpolation {name}
  const t = useCallback((key, vars) => {
    const dict = LOCALES[lang] || LOCALES.fr;
    let s = dict[key] ?? LOCALES.fr[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
      }
    }
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
