import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { api, clearToken } from './api.js';
import { useI18n } from './i18n/I18nContext.jsx';
import LanguageSwitcher from './components/LanguageSwitcher.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Employees from './pages/Employees.jsx';
import Generate from './pages/Generate.jsx';
import CompanySettings from './pages/CompanySettings.jsx';
import History from './pages/History.jsx';
import Leaves from './pages/Leaves.jsx';
import Expenses from './pages/Expenses.jsx';
import Documents from './pages/Documents.jsx';
import Users from './pages/Users.jsx';
import MySpace from './pages/MySpace.jsx';

export default function App() {
  const { t } = useI18n();
  const [auth, setAuth] = useState({ loading: true, user: null, company: null });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('wps_token');
    if (!token) { setAuth({ loading: false, user: null, company: null }); return; }
    api.me()
      .then(d => setAuth({
        loading: false,
        user: { ...d.user, fullName: d.user.full_name, employee_id_pk: d.user.employee_id },
        company: d.company
      }))
      .catch(() => setAuth({ loading: false, user: null, company: null }));
  }, []);

  const refreshMe = async () => {
    const d = await api.me();
    setAuth(a => ({
      ...a,
      user: { ...d.user, fullName: d.user.full_name, employee_id_pk: d.user.employee_id },
      company: d.company
    }));
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

  const role = auth.user.role;
  const isAdmin = role === 'admin';
  const isHRorAdmin = role === 'admin' || role === 'hr';
  const canSeePayroll = isHRorAdmin;

  const NavItem = ({ to, children }) => (
    <NavLink to={to} className={({ isActive }) => isActive ? 'active' : ''}>{children}</NavLink>
  );

  return (
    <>
      <header className="navbar">
        <div className="brand"><span className="brand-name">HRH</span> <span className="brand-sub">— {auth.company?.name}</span></div>
        <nav>
          <NavItem to="/dashboard">{t('nav.dashboard')}</NavItem>
          <NavItem to="/leaves">{t('nav.leaves')}</NavItem>
          <NavItem to="/expenses">{t('nav.expenses')}</NavItem>
          {isHRorAdmin && <NavItem to="/documents">{t('nav.documents')}</NavItem>}
          {canSeePayroll && <NavItem to="/generate">{t('nav.generate')}</NavItem>}
          {isHRorAdmin && <NavItem to="/employees">{t('nav.employees')}</NavItem>}
          {canSeePayroll && <NavItem to="/history">{t('nav.history')}</NavItem>}
          {isAdmin && <NavItem to="/users">{t('nav.users')}</NavItem>}
          {isAdmin && <NavItem to="/settings">{t('nav.settings')}</NavItem>}
          <NavItem to="/me">{t('nav.mySpace')}</NavItem>
        </nav>
        <div className="user">
          <LanguageSwitcher compact />
          <span className="badge muted">{t('role.' + role)}</span>
          <span>{auth.user.email}</span>
          <button onClick={logout}>{t('nav.logout')}</button>
        </div>
      </header>
      <div className="container">
        <Routes>
          <Route path="/dashboard" element={<Dashboard user={auth.user} />} />
          <Route path="/leaves" element={<Leaves user={auth.user} />} />
          <Route path="/expenses" element={<Expenses user={auth.user} />} />
          <Route path="/me" element={<MySpace user={auth.user} />} />

          {isHRorAdmin && (
            <>
              <Route path="/documents" element={<Documents user={auth.user} />} />
              <Route path="/employees" element={<Employees />} />
            </>
          )}
          {canSeePayroll && (
            <>
              <Route path="/generate" element={<Generate company={auth.company} />} />
              <Route path="/history" element={<History />} />
            </>
          )}
          {isAdmin && (
            <>
              <Route path="/users" element={<Users currentUser={auth.user} />} />
              <Route path="/settings" element={<CompanySettings company={auth.company} onUpdated={refreshMe} />} />
            </>
          )}

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </>
  );
}
