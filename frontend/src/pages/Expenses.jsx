import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const CATEGORIES = ['travel', 'meals', 'supplies', 'other'];

function StatusBadge({ status, t }) {
  const cls = status === 'approved' || status === 'paid' ? 'success' : 'muted';
  return <span className={'badge ' + cls}>{t('status.' + status)}</span>;
}

export default function Expenses({ user }) {
  const { t } = useI18n();
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [form, setForm] = useState({
    employee_id: '', title: '', expense_date: '', category: 'travel',
    amount: '', currency: 'AED', description: ''
  });
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [sending, setSending] = useState(false);

  const canReview = ['admin', 'hr', 'manager'].includes(user.role);
  const canPickEmployee = ['admin', 'hr'].includes(user.role);
  const canPay = ['admin', 'hr'].includes(user.role);

  const load = async () => {
    try {
      const { expenses } = await api.listExpenses();
      setExpenses(expenses);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (canPickEmployee) api.listEmployees().then(d => setEmployees(d.employees)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setMsg(null); setSending(true);
    try {
      const body = { ...form };
      if (!canPickEmployee) delete body.employee_id;
      await api.createExpense(body, receipt);
      setMsg(t('common.save'));
      setForm({ employee_id: '', title: '', expense_date: '', category: 'travel', amount: '', currency: 'AED', description: '' });
      setReceipt(null);
      load();
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  };

  const review = async (id, action) => {
    const comment = window.prompt(t('lv.comment') || '');
    try { await api.reviewExpense(id, action, comment || undefined); load(); }
    catch (e) { setErr(e.message); }
  };

  const markPaid = async (id) => {
    try { await api.markExpensePaid(id); load(); }
    catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    if (!window.confirm(t('exp.confirmDelete'))) return;
    try { await api.deleteExpense(id); load(); }
    catch (e) { setErr(e.message); }
  };

  const download = async (id) => {
    try {
      const { blob, filename } = await api.downloadReceipt(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <div className="card">
        <h2>{t('exp.new')}</h2>
        {err && <div className="alert error">{err}</div>}
        {msg && <div className="alert success">{msg}</div>}
        <form onSubmit={submit}>
          <div className="row">
            {canPickEmployee && (
              <div className="col">
                <label>{t('exp.colEmployee')}</label>
                <select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} required>
                  <option value="">—</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name || emp.employee_id}</option>)}
                </select>
              </div>
            )}
            <div className="col">
              <label>{t('exp.field.title')}</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="col">
              <label>{t('exp.field.date')}</label>
              <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} required />
            </div>
            <div className="col">
              <label>{t('exp.field.category')}</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{t('exp.cat.' + c)}</option>)}
              </select>
            </div>
            <div className="col">
              <label>{t('exp.field.amount')}</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="col">
              <label>{t('exp.field.currency')}</label>
              <input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div className="col">
              <label>{t('exp.field.description')}</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="col">
              <label>{t('exp.field.receipt')}</label>
              <input type="file" accept="image/*,application/pdf" onChange={e => setReceipt(e.target.files[0] || null)} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="primary" disabled={sending}>
              {sending ? t('exp.submitting') : t('exp.submit')}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>{t('exp.title')}</h2>
        <table>
          <thead>
            <tr>
              <th>{t('exp.colEmployee')}</th>
              <th>{t('exp.colTitle')}</th>
              <th>{t('exp.colDate')}</th>
              <th>{t('exp.colCategory')}</th>
              <th className="right">{t('exp.colAmount')}</th>
              <th>{t('exp.colStatus')}</th>
              <th>{t('exp.colReceipt')}</th>
              <th>{t('exp.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr><td colSpan={8} className="center" style={{ padding: 20, color: 'var(--muted)' }}>{t('exp.empty')}</td></tr>
            )}
            {expenses.map(e => {
              const isMine = e.employee_id === user.employee_id_pk;
              const canDelete = e.status === 'pending' && (user.role === 'admin' || user.role === 'hr' || isMine);
              const canReviewThis = canReview && e.status === 'pending' && (user.role !== 'manager' || e.employee_manager_id === user.employee_id_pk);
              return (
                <tr key={e.id}>
                  <td>{e.employee_name || '—'}</td>
                  <td>{e.title}</td>
                  <td>{e.expense_date}</td>
                  <td>{e.category ? t('exp.cat.' + e.category) : '—'}</td>
                  <td className="right">{Number(e.amount).toLocaleString()} {e.currency}</td>
                  <td><StatusBadge status={e.status} t={t} /></td>
                  <td>
                    {e.receipt_path
                      ? <button onClick={() => download(e.id)}>{t('exp.download')}</button>
                      : <span className="small">—</span>}
                  </td>
                  <td>
                    <div className="btn-group">
                      {canReviewThis && <button onClick={() => review(e.id, 'approve')}>{t('exp.approve')}</button>}
                      {canReviewThis && <button className="danger" onClick={() => review(e.id, 'reject')}>{t('exp.reject')}</button>}
                      {canPay && e.status === 'approved' && <button onClick={() => markPaid(e.id)}>{t('exp.markPaid')}</button>}
                      {canDelete && <button className="danger" onClick={() => remove(e.id)}>{t('exp.delete')}</button>}
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
