import React, { useState } from 'react';
import { api } from '../api.js';

export default function CompanySettings({ company, onUpdated }) {
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
      setMsg('Informations entreprise mises à jour');
      await onUpdated();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="card">
      <h2>Paramètres de l'entreprise</h2>
      <div className="small">Ces informations sont utilisées pour composer la ligne SCR (contrôle) du fichier SIF.</div>
      {msg && <div className="alert success" style={{ marginTop: 12 }}>{msg}</div>}
      {err && <div className="alert error" style={{ marginTop: 12 }}>{err}</div>}

      <div style={{ marginTop: 14 }}>
        <label>Nom</label>
        <input value={f.name} onChange={set('name')} />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div className="col"><label>ID établissement</label><input value={f.employer_id} onChange={set('employer_id')} /></div>
        <div className="col"><label>Code routing banque employeur</label><input value={f.employer_routing_code} onChange={set('employer_routing_code')} /></div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div className="col"><label>Référence additionnelle</label><input value={f.employer_reference} onChange={set('employer_reference')} /></div>
        <div className="col"><label>Code employeur (4 chiffres)</label><input value={f.employer_code} onChange={set('employer_code')} /></div>
        <div className="col"><label>Devise</label><input value={f.currency} onChange={set('currency')} /></div>
      </div>
      <div className="btn-group" style={{ marginTop: 16 }}>
        <button className="primary" onClick={save}>Enregistrer</button>
      </div>
    </div>
  );
}
