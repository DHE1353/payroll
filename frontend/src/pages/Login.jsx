import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';

export default function Login({ onLogin }) {
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
        <h1>Connexion</h1>
        <div className="card">
          {err && <div className="alert error">{err}</div>}
          <form onSubmit={submit}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            <div style={{ height: 12 }} />
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            <div style={{ height: 16 }} />
            <button type="submit" className="primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
          <div className="switch">Pas de compte ? <Link to="/register">Créer un compte</Link></div>
        </div>
      </div>
    </div>
  );
}
