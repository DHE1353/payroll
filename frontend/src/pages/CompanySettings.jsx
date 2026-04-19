import React, { useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function CompanySettings({ company, onUpdated }) {
  const { t } = useI18n();
  const [f, setF] = useState({
    name: company.name || '',
    employer_id: company.employer_id || '',
    employer_routing_code: company.employer_routing_code || '',
    employer_reference: company.employer_reference || '',
    employer_code: company.employer_code || '',
    currency: company.currency || 'AED'
  });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    setErr(null); setMsg(null);
    try {
      await api.updateCompany(f);
      setMsg(t('cs.updated'));
      await onUpdated();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="card">
      <h2>{t('cs.title')}</h2>
      <div className="small">{t('cs.help')}</div>
      {msg && <div className="alert success" style={{ marginTop: 12 }}>{msg}</div>}
      {err && <div className="alert error" style={{ marginTop: 12 }}>{err}</div>}

      <div style={{ marginTop: 14 }}>
        <label>{t('cs.name')}</label>
        <input value={f.name} onChange={set('name')} />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div className="col"><label>{t('register.employerId')}</label><input value={f.employer_id} onChange={set('employer_id')} /></div>
        <div className="col"><label>{t('register.routingCode')}</label><input value={f.employer_routing_code} onChange={set('employer_routing_code')} /></div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div className="col"><label>{t('register.reference')}</label><input value={f.employer_reference} onChange={set('employer_reference')} /></div>
        <div className="col"><label>{t('register.employerCode')}</label><input value={f.employer_code} onChange={set('employer_code')} /></div>
        <div className="col"><label>{t('register.currency')}</label><input value={f.currency} onChange={set('currency')} /></div>
      </div>
      <div className="btn-group" style={{ marginTop: 16 }}>
        <button className="primary" onClick={save}>{t('common.save')}</button>
      </div>
    </div>
  );
}
