import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function LanguageSwitcher({ compact = false }) {
  const { lang, setLang, languages } = useI18n();
  return (
    <select
      value={lang}
      onChange={e => setLang(e.target.value)}
      className="lang-switch"
      aria-label="Language"
      style={compact ? { width: 'auto', padding: '4px 8px', fontSize: 13 } : { width: 'auto' }}
    >
      {languages.map(l => (
        <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
      ))}
    </select>
  );
}
