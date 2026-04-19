import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function History() {
  const { t } = useI18n();
  const [runs, setRuns] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.listRuns().then(d => setRuns(d.runs)).catch(e => setErr(e.message));
  }, []);

  return (
    <div className="card">
      <h2>{t('hist.title')}</h2>
      {err && <div className="alert error">{err}</div>}
      <table>
        <thead>
          <tr>
            <th>{t('hist.colDate')}</th>
            <th>{t('hist.colPeriod')}</th>
            <th>{t('hist.colDays')}</th>
            <th>{t('hist.colEmployees')}</th>
            <th className="right">{t('hist.colTotal')}</th>
            <th>{t('hist.colFile')}</th>
          </tr>
        </thead>
        <tbody>
          {runs.length === 0 && <tr><td colSpan={6} className="center" style={{ padding: 20, color: 'var(--muted)' }}>{t('hist.empty')}</td></tr>}
          {runs.map(r => (
            <tr key={r.id}>
              <td>{r.created_at}</td>
              <td>{r.pay_start_date} → {r.pay_end_date}</td>
              <td>{r.days_in_period}</td>
              <td>{r.total_employees}</td>
              <td className="right">{Number(r.total_salaries).toLocaleString()}</td>
              <td className="mono">{r.file_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
