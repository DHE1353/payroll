import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';

export default function Register({ onRegister }) {
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
        <h1>Créer un compte entreprise</h1>
        <div className="card">
          {err && <div className="alert error">{err}</div>}
          <form onSubmit={submit}>
            <h3>Entreprise</h3>
            <label>Nom de l'entreprise *</label>
            <input value={form.companyName} onChange={set('companyName')} required />
            <div className="row" style={{ marginTop: 10 }}>
              <div className="col">
                <label>ID établissement (employer_id) *</label>
                <input value={form.employerId} onChange={set('employerId')} required placeholder="ex: 0000002554476" />
              </div>
              <div className="col">
                <label>Code routing banque employeur *</label>
                <input value={form.employerRoutingCode} onChange={set('employerRoutingCode')} required placeholder="ex: 808610001" />
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <div className="col">
                <label>Référence additionnelle</label>
                <input value={form.employerReference} onChange={set('employerReference')} placeholder="ex: 2026-03-22" />
              </div>
              <div className="col">
                <label>Code employeur (4 chiffres)</label>
                <input value={form.employerCode} onChange={set('employerCode')} placeholder="ex: 0904" />
              </div>
              <div className="col">
                <label>Devise</label>
                <input value={form.currency} onChange={set('currency')} />
              </div>
            </div>

            <h3 style={{ marginTop: 20 }}>Utilisateur admin</h3>
            <label>Nom complet</label>
            <input value={form.fullName} onChange={set('fullName')} />
            <div className="row" style={{ marginTop: 10 }}>
              <div className="col">
                <label>Email *</label>
                <input type="email" value={form.email} onChange={set('email')} required />
              </div>
              <div className="col">
                <label>Mot de passe *</label>
                <input type="password" value={form.password} onChange={set('password')} required minLength={6} />
              </div>
            </div>

            <div style={{ height: 16 }} />
            <button type="submit" className="primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>
          <div className="switch">Déjà un compte ? <Link to="/login">Se connecter</Link></div>
        </div>
      </div>
    </div>
  );
}
