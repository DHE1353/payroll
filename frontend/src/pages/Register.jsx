import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

export default function Register({ onRegister }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    email: '', password: '', fullName: '',
    companyName: '', employerId: '', employerRoutingCode: '',
    employerReference: '', employerCode: '', currency: 'AED'
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const { token } = await api.register(form);
      setToken(token);
      await onRegister();
      navigate('/generate');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-box" style={{ maxWidth: 540 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <LanguageSwitcher compact />
        </div>
        <h1>{t('register.title')}</h1>
        <div className="card">
          {err && <div className="alert error">{err}</div>}
          <form onSubmit={submit}>
            <h3>{t('register.company')}</h3>
            <label>{t('register.companyName')} *</label>
            <input value={form.companyName} onChange={set('companyName')} required />
            <div className="row" style={{ marginTop: 10 }}>
              <div className="col">
                <label>{t('register.employerId')} *</label>
                <input value={form.employerId} onChange={set('employerId')} required placeholder={t('register.employerIdPh')} />
              </div>
              <div className="col">
                <label>{t('register.routingCode')} *</label>
                <input value={form.employerRoutingCode} onChange={set('employerRoutingCode')} required placeholder={t('register.routingCodePh')} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <div className="col">
                <label>{t('register.reference')}</label>
                <input value={form.employerReference} onChange={set('employerReference')} placeholder={t('register.referencePh')} />
              </div>
              <div className="col">
                <label>{t('register.employerCode')}</label>
                <input value={form.employerCode} onChange={set('employerCode')} placeholder={t('register.employerCodePh')} />
              </div>
              <div className="col">
                <label>{t('register.currency')}</label>
                <input value={form.currency} onChange={set('currency')} />
              </div>
            </div>

            <h3 style={{ marginTop: 20 }}>{t('register.adminUser')}</h3>
            <label>{t('register.fullName')}</label>
            <input value={form.fullName} onChange={set('fullName')} />
            <div className="row" style={{ marginTop: 10 }}>
              <div className="col">
                <label>{t('login.email')} *</label>
                <input type="email" value={form.email} onChange={set('email')} required />
              </div>
              <div className="col">
                <label>{t('login.password')} *</label>
                <input type="password" value={form.password} onChange={set('password')} required minLength={6} />
              </div>
            </div>

            <div style={{ height: 16 }} />
            <button type="submit" className="primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? t('register.loading') : t('register.submit')}
            </button>
          </form>
          <div className="switch">{t('register.haveAccount')} <Link to="/login">{t('register.signIn')}</Link></div>
        </div>
      </div>
    </div>
  );
}
