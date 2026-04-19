import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const ROLES = ['admin', 'hr', 'manager', 'employee'];

export default function Users({ currentUser }) {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'employee', employee_id: '' });
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      const u = await api.listUsers();
      setUsers(u.users);
      const e = await api.listEmployees();
      setEmployees(e.employees);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    try {
      const body = { ...form };
      if (!body.employee_id) delete body.employee_id;
      await api.createUser(body);
      setMsg(t('common.save'));
      setForm({ email: '', password: '', full_name: '', role: 'employee', employee_id: '' });
      load();
    } catch (e) { setErr(e.message); }
  };

  const resetPwd = async (u) => {
    const pwd = window.prompt(t('usr.newPassword'));
    if (!pwd) return;
    try { await api.resetUserPassword(u.id, pwd); setMsg(t('usr.passwordReset')); }
    catch (e) { setErr(e.message); }
  };

  const toggleActive = async (u) => {
    try { await api.updateUser(u.id, { active: !u.active }); load(); }
    catch (e) { setErr(e.message); }
  };

  const changeRole = async (u, newRole) => {
    try { await api.updateUser(u.id, { role: newRole }); load(); }
    catch (e) { setErr(e.message); }
  };

  const remove = async (u) => {
    if (!window.confirm(t('usr.confirmDelete'))) return;
    try { await api.deleteUser(u.id); load(); }
    catch (e) { setErr(e.message); }
  };

  const needsEmployee = form.role === 'manager' || form.role === 'employee';

  return (
    <div>
      {currentUser.role === 'admin' && (
        <div className="card">
          <h2>{t('usr.new')}</h2>
          {err && <div className="alert error">{err}</div>}
          {msg && <div className="alert success">{msg}</div>}
          <form onSubmit={submit}>
            <div className="row">
              <div className="col">
                <label>{t('usr.field.email')}</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="col">
                <label>{t('usr.field.password')}</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div className="col">
                <label>{t('usr.field.fullName')}</label>
                <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="col">
                <label>{t('usr.field.role')}</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map(r => <option key={r} value={r}>{t('role.' + r)}</option>)}
                </select>
              </div>
              <div className="col">
                <label>{t('usr.field.employee')}</label>
                <select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} required={needsEmployee}>
                  <option value="">—</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name || emp.employee_id}</option>)}
                </select>
              </div>
            </div>
            <div className="small" style={{ marginTop: 6 }}>{t('usr.roleHint')}</div>
            <div style={{ marginTop: 12 }}>
              <button className="primary">{t('usr.submit')}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>{t('usr.title')}</h2>
        <table>
          <thead>
            <tr>
              <th>{t('usr.colEmail')}</th>
              <th>{t('usr.colName')}</th>
              <th>{t('usr.colRole')}</th>
              <th>{t('usr.colEmployee')}</th>
              <th>{t('usr.colActive')}</th>
              <th>{t('usr.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.full_name || u.employee_name || ''}</td>
                <td>
                  {currentUser.role === 'admin' && u.id !== currentUser.id ? (
                    <select value={u.role} onChange={e => changeRole(u, e.target.value)}>
                      {ROLES.map(r => <option key={r} value={r}>{t('role.' + r)}</option>)}
                    </select>
                  ) : t('role.' + u.role)}
                </td>
                <td>{u.employee_code ? `${u.employee_name || ''} (${u.employee_code})` : '—'}</td>
                <td>
                  <span className={'badge ' + (u.active ? 'success' : 'muted')}>
                    {u.active ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td>
                  {currentUser.role === 'admin' && u.id !== currentUser.id && (
                    <div className="btn-group">
                      <button onClick={() => toggleActive(u)}>
                        {u.active ? t('usr.deactivate') : t('usr.activate')}
                      </button>
                      <button onClick={() => resetPwd(u)}>{t('usr.resetPassword')}</button>
                      <button className="danger" onClick={() => remove(u)}>{t('common.delete')}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
