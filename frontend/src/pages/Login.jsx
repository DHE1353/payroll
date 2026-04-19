import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

export default function Login({ onLogin }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const { token } = await api.login({ email, password });
      setToken(token);
      await onLogin();
      navigate('/generate');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <LanguageSwitcher compact />
        </div>
        <h1>{t('login.title')}</h1>
        <div className="card">
          {err && <div className="alert error">{err}</div>}
          <form onSubmit={submit}>
            <label>{t('login.email')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            <div style={{ height: 12 }} />
            <label>{t('login.password')}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            <div style={{ height: 16 }} />
            <button type="submit" className="primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? t('login.loading') : t('login.submit')}
            </button>
          </form>
          <div className="switch">{t('login.noAccount')} <Link to="/register">{t('login.createAccount')}</Link></div>
        </div>
      </div>
    </div>
  );
}
