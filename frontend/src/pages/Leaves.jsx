import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const LEAVE_TYPES = ['annual', 'sick', 'unpaid', 'other'];

function StatusBadge({ status, t }) {
  const cls = status === 'approved' || status === 'paid' ? 'success'
    : status === 'rejected' ? 'muted'
    : 'muted';
  return <span className={'badge ' + cls}>{t('status.' + status)}</span>;
}

export default function Leaves({ user }) {
  const { t } = useI18n();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '', employee_id: '' });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [sending, setSending] = useState(false);

  const canReview = ['admin', 'hr', 'manager'].includes(user.role);
  const canPickEmployee = ['admin', 'hr'].includes(user.role);

  const load = async () => {
    try {
      const params = filter === 'pending' ? { status: 'pending' } : {};
      const { requests } = await api.listLeaves(params);
      setRequests(requests);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { load(); }, [filter]);

  useEffect(() => {
    if (canPickEmployee) {
      api.listEmployees().then(d => setEmployees(d.employees)).catch(() => {});
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setMsg(null); setSending(true);
    try {
      const body = { ...form };
      if (!canPickEmployee) delete body.employee_id;
      await api.createLeave(body);
      setMsg(t('common.save'));
      setForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '', employee_id: '' });
      load();
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  };

  const review = async (id, action) => {
    const comment = window.prompt(t('lv.comment') || '');
    try {
      await api.reviewLeave(id, action, comment || undefined);
      load();
    } catch (e) { setErr(e.message); }
  };

  const cancelReq = async (id) => {
    if (!window.confirm(t('lv.confirmCancel'))) return;
    try { await api.cancelLeave(id); load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <div className="card">
        <h2>{t('lv.new')}</h2>
        {err && <div className="alert error">{err}</div>}
        {msg && <div className="alert success">{msg}</div>}
        <form onSubmit={submit}>
          <div className="row">
            {canPickEmployee && (
              <div className="col">
                <label>{t('lv.colEmployee')}</label>
                <select
                  value={form.employee_id}
                  onChange={e => setForm({ ...form, employee_id: e.target.value })}
                  required
                >
                  <option value="">—</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name || emp.employee_id}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="col">
              <label>{t('lv.type')}</label>
              <select value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })}>
                {LEAVE_TYPES.map(lt => <option key={lt} value={lt}>{t('lv.type.' + lt)}</option>)}
              </select>
            </div>
            <div className="col">
              <label>{t('lv.startDate')}</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
            </div>
            <div className="col">
              <label>{t('lv.endDate')}</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required />
            </div>
          </div>
          <div className="row">
            <div className="col">
              <label>{t('lv.reason')}</label>
              <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="primary" disabled={sending}>
              {sending ? t('lv.submitting') : t('lv.submit')}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{t('lv.title')}</h2>
          <div className="btn-group">
            <button onClick={() => setFilter('all')} className={filter === 'all' ? 'primary' : ''}>
              {t('lv.filter.all')}
            </button>
            <button onClick={() => setFilter('pending')} className={filter === 'pending' ? 'primary' : ''}>
              {t('lv.filter.pending')}
            </button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>{t('lv.colEmployee')}</th>
              <th>{t('lv.colType')}</th>
              <th>{t('lv.colPeriod')}</th>
              <th className="right">{t('lv.days')}</th>
              <th>{t('lv.reason')}</th>
              <th>{t('lv.colStatus')}</th>
              <th>{t('lv.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr><td colSpan={7} className="center" style={{ padding: 20, color: 'var(--muted)' }}>{t('lv.empty')}</td></tr>
            )}
            {requests.map(r => {
              const isMine = r.employee_id === user.employee_id_pk;
              const canCancel = r.status === 'pending' && (user.role === 'admin' || user.role === 'hr' || isMine);
              const canReviewThis = canReview && r.status === 'pending' && (user.role !== 'manager' || r.employee_manager_id === user.employee_id_pk);
              return (
                <tr key={r.id}>
                  <td>{r.employee_name || '—'}</td>
                  <td>{t('lv.type.' + r.leave_type)}</td>
                  <td>{r.start_date} → {r.end_date}</td>
                  <td className="right">{r.days}</td>
                  <td>{r.reason || ''}</td>
                  <td><StatusBadge status={r.status} t={t} /></td>
                  <td>
                    <div className="btn-group">
                      {canReviewThis && <button onClick={() => review(r.id, 'approve')}>{t('lv.approve')}</button>}
                      {canReviewThis && <button className="danger" onClick={() => review(r.id, 'reject')}>{t('lv.reject')}</button>}
                      {canCancel && <button onClick={() => cancelReq(r.id)}>{t('lv.cancel')}</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
