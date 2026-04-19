import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function MySpace({ user }) {
  const { t } = useI18n();
  const [me, setMe] = useState(null);
  const [pwd, setPwd] = useState({ current_password: '', new_password: '' });
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (user.employee_id_pk) {
      api.getEmployee(user.employee_id_pk).then(d => setMe(d.employee)).catch(() => {});
      api.leaveBalance(user.employee_id_pk).then(setBalance).catch(() => {});
    }
  }, [user.employee_id_pk]);

  const changePwd = async (e) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    try {
      await api.changeMyPassword(pwd.current_password, pwd.new_password);
      setMsg(t('me.passwordChanged'));
      setPwd({ current_password: '', new_password: '' });
    } catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <div className="card">
        <h2>{t('me.title')}</h2>
        <h3>{t('me.profile')}</h3>
        <div className="row">
          <div className="col">
            <label>{t('login.email')}</label>
            <input value={user.email} disabled />
          </div>
          <div className="col">
            <label>{t('register.fullName')}</label>
            <input value={user.fullName || ''} disabled />
          </div>
          <div className="col">
            <label>{t('usr.colRole')}</label>
            <input value={t('role.' + user.role)} disabled />
          </div>
        </div>

        {me && (
          <div className="row" style={{ marginTop: 12 }}>
            <div className="col">
              <label>{t('emp.fieldId')}</label>
              <input className="mono" value={me.employee_id} disabled />
            </div>
            <div className="col">
              <label>{t('emp.fieldIban')}</label>
              <input className="mono" value={me.iban} disabled />
            </div>
            <div className="col">
              <label>{t('dash.myLeaveBalance')}</label>
              <input value={(balance?.annual_leave_balance ?? me.annual_leave_balance)} disabled />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>{t('me.security')}</h3>
        {err && <div className="alert error">{err}</div>}
        {msg && <div className="alert success">{msg}</div>}
        <form onSubmit={changePwd}>
          <div className="row">
            <div className="col">
              <label>{t('me.currentPassword')}</label>
              <input type="password" value={pwd.current_password} onChange={e => setPwd({ ...pwd, current_password: e.target.value })} required />
            </div>
            <div className="col">
              <label>{t('me.newPassword')}</label>
              <input type="password" value={pwd.new_password} onChange={e => setPwd({ ...pwd, new_password: e.target.value })} required minLength={6} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="primary">{t('me.changePassword')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
