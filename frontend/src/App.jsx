import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { api, clearToken } from './api.js';
import { useI18n } from './i18n/I18nContext.jsx';
import LanguageSwitcher from './components/LanguageSwitcher.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Employees from './pages/Employees.jsx';
import Generate from './pages/Generate.jsx';
import CompanySettings from './pages/CompanySettings.jsx';
import History from './pages/History.jsx';

export default function App() {
  const { t } = useI18n();
  const [auth, setAuth] = useState({ loading: true, user: null, company: null });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('wps_token');
    if (!token) { setAuth({ loading: false, user: null, company: null }); return; }
    api.me()
      .then(d => setAuth({ loading: false, user: d.user, company: d.company }))
      .catch(() => setAuth({ loading: false, user: null, company: null }));
  }, []);

  const refreshMe = async () => {
    const d = await api.me();
    setAuth(a => ({ ...a, user: d.user, company: d.company }));
  };

  const logout = () => {
    clearToken();
    setAuth({ loading: false, user: null, company: null });
    navigate('/login');
  };

  if (auth.loading) return <div className="container">{t('common.loading')}</div>;

  if (!auth.user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={refreshMe} />} />
        <Route path="/register" element={<Register onRegister={refreshMe} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <header className="navbar">
        <div className="brand">📄 {t('nav.brand')} — {auth.company?.name}</div>
        <nav>
          <NavLink to="/generate" className={({isActive}) => isActive ? 'active' : ''}>{t('nav.generate')}</NavLink>
          <NavLink to="/employees" className={({isActive}) => isActive ? 'active' : ''}>{t('nav.employees')}</NavLink>
          <NavLink to="/history" className={({isActive}) => isActive ? 'active' : ''}>{t('nav.history')}</NavLink>
          <NavLink to="/settings" className={({isActive}) => isActive ? 'active' : ''}>{t('nav.settings')}</NavLink>
        </nav>
        <div className="user">
          <LanguageSwitcher compact />
          <span>{auth.user.email}</span>
          <button onClick={logout}>{t('nav.logout')}</button>
        </div>
      </header>
      <div className="container">
        <Routes>
          <Route path="/generate" element={<Generate company={auth.company} />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<CompanySettings company={auth.company} onUpdated={refreshMe} />} />
          <Route path="*" element={<Navigate to="/generate" replace />} />
        </Routes>
      </div>
    </>
  );
}
