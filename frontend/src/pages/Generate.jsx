import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n/I18nContext.jsx';

function isoMonthRange(year, month1to12) {
  const first = new Date(Date.UTC(year, month1to12 - 1, 1));
  const last = new Date(Date.UTC(year, month1to12, 0));
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(first), end: iso(last) };
}

export default function Generate({ company }) {
  const { t } = useI18n();
  const today = new Date();
  const defaultRange = isoMonthRange(today.getUTCFullYear(), today.getUTCMonth() + 1);
  const [start, setStart] = useState(defaultRange.start);
  const [end, setEnd] = useState(defaultRange.end);
  const [days, setDays] = useState('');
  const [employees, setEmployees] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [scr, setScr] = useState({ file_creation_date: '', file_creation_time: '', salary_month_year: '' });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listEmployees()
      .then(d => setEmployees(d.employees.filter(e => e.active)))
      .catch(e => setErr(e.message));
  }, []);

  const totals = useMemo(() => {
    let count = 0, sum = 0;
    employees.forEach(e => {
      const ov = overrides[e.employee_id] || {};
      if (ov.include === false) return;
      const fixed = ov.fixed_income != null ? Number(ov.fixed_income) : Number(e.fixed_income);
      const variable = ov.variable_income != null ? Number(ov.variable_income) : Number(e.variable_income);
      count++;
      sum += (fixed || 0) + (variable || 0);
    });
    return { count, sum };
  }, [employees, overrides]);

  const setOv = (empId, key, val) => setOverrides(o => ({ ...o, [empId]: { ...o[empId], [key]: val } }));

  const download = async () => {
    setErr(null); setLoading(true);
    try {
      const scrOverrides = {};
      if (scr.file_creation_date) scrOverrides.file_creation_date = scr.file_creation_date;
      if (scr.file_creation_time) scrOverrides.file_creation_time = scr.file_creation_time;
      if (scr.salary_month_year) scrOverrides.salary_month_year = scr.salary_month_year;
      const body = {
        payStartDate: start,
        payEndDate: end,
        daysInPeriod: days ? Number(days) : undefined,
        employeeOverrides: overrides,
        scrOverrides
      };
      const { blob, filename } = await api.generatePayroll(body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="card">
        <h2>{t('gen.title')}</h2>
        <div className="small">{t('gen.help')}</div>

        <div className="row" style={{ marginTop: 14 }}>
          <div className="col">
            <label>{t('gen.periodStart')}</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div className="col">
            <label>{t('gen.periodEnd')}</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
          <div className="col">
            <label>{t('gen.days')}</label>
            <input type="number" placeholder={t('common.auto')} value={days} onChange={e => setDays(e.target.value)} />
          </div>
        </div>

        <div className="stats" style={{ marginTop: 16 }}>
          <div className="stat"><div className="label">{t('gen.employeesIncluded')}</div><div className="value">{totals.count}</div></div>
          <div className="stat"><div className="label">{t('gen.totalTransfer')}</div><div className="value">{totals.sum.toLocaleString()} {company?.currency || 'AED'}</div></div>
          <div className="stat"><div className="label">{t('gen.monthYear')}</div><div className="value">{(start || '').slice(5,7)}/{(start || '').slice(0,4)}</div></div>
        </div>

        {err && <div className="alert error" style={{ marginTop: 12 }}>{err}</div>}

        <h3 style={{ marginTop: 20 }}>{t('gen.scrTitle')}</h3>
        <div className="small">{t('gen.scrHelp')}</div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="col">
            <label>{t('gen.fileDate')}</label>
            <input placeholder={t('common.auto')} value={scr.file_creation_date} onChange={e => setScr(s => ({ ...s, file_creation_date: e.target.value }))} />
          </div>
          <div className="col">
            <label>{t('gen.fileTime')}</label>
            <input placeholder={t('common.auto')} value={scr.file_creation_time} onChange={e => setScr(s => ({ ...s, file_creation_time: e.target.value }))} />
          </div>
          <div className="col">
            <label>{t('gen.salaryMonth')}</label>
            <input placeholder={t('common.auto')} value={scr.salary_month_year} onChange={e => setScr(s => ({ ...s, salary_month_year: e.target.value }))} />
          </div>
        </div>

        <div className="btn-group" style={{ marginTop: 16 }}>
          <button className="primary" onClick={download} disabled={loading || totals.count === 0}>
            {loading ? t('gen.downloading') : t('gen.download')}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>{t('gen.adjustTitle')}</h3>
        <div className="small">{t('gen.adjustHelp')}</div>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>{t('gen.include')}</th>
              <th>{t('gen.colId')}</th>
              <th>{t('gen.colName')}</th>
              <th className="right">{t('gen.colFixedBase')}</th>
              <th className="right">{t('gen.colFixedMonth')}</th>
              <th className="right">{t('gen.colVariable')}</th>
              <th className="right">{t('gen.colLeave')}</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && <tr><td colSpan={7} className="center" style={{ padding: 20, color: 'var(--muted)' }}>{t('gen.noActive')}</td></tr>}
            {employees.map(e => {
              const ov = overrides[e.employee_id] || {};
              const included = ov.include !== false;
              return (
                <tr key={e.id} style={{ opacity: included ? 1 : 0.5 }}>
                  <td><input type="checkbox" checked={included} onChange={ev => setOv(e.employee_id, 'include', ev.target.checked)} style={{ width: 'auto' }} /></td>
                  <td className="mono">{e.employee_id}</td>
                  <td>{e.full_name || '—'}</td>
                  <td className="right mono">{Number(e.fixed_income).toLocaleString()}</td>
                  <td className="right"><input type="number" step="0.01" value={ov.fixed_income ?? e.fixed_income} onChange={ev => setOv(e.employee_id, 'fixed_income', ev.target.value)} style={{ width: 110, textAlign: 'right' }} /></td>
                  <td className="right"><input type="number" step="0.01" value={ov.variable_income ?? e.variable_income} onChange={ev => setOv(e.employee_id, 'variable_income', ev.target.value)} style={{ width: 110, textAlign: 'right' }} /></td>
                  <td className="right"><input type="number" step="0.5" value={ov.leave_days ?? 0} onChange={ev => setOv(e.employee_id, 'leave_days', ev.target.value)} style={{ width: 90, textAlign: 'right' }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
