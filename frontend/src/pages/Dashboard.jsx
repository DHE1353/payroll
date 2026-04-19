import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n/I18nContext.jsx';

function Stat({ label, value, hint }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="small">{hint}</div>}
    </div>
  );
}

export default function Dashboard({ user }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.dashboard().then(setData).catch(e => setErr(e.message));
  }, []);

  if (err) return <div className="alert error">{err}</div>;
  if (!data) return <div>{t('common.loading')}</div>;

  const ctx = data.context;

  return (
    <div>
      <div className="card">
        <h2>{t('dash.title')}</h2>
        <div className="small">{t('dash.welcome', { name: user?.fullName || user?.email })}</div>
      </div>

      {(data.role === 'admin' || data.role === 'hr') && (
        <>
          <div className="card">
            <div className="stats">
              <Stat label={t('dash.employeesActive')} value={ctx.employees} />
              <Stat label={t('dash.pendingLeaves')} value={ctx.pendingLeaves} />
              <Stat label={t('dash.pendingExpenses')} value={ctx.pendingExpenses} />
              <Stat
                label={t('dash.monthlySalaries')}
                value={Number(ctx.totalMonthlySalaries || 0).toLocaleString() + ' AED'}
              />
            </div>
          </div>

          <div className="row">
            <div className="col card">
              <h3>{t('dash.recentLeaves')}</h3>
              {ctx.recentLeaves.length === 0 && <div className="small">{t('lv.empty')}</div>}
              {ctx.recentLeaves.map(l => (
                <div key={l.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <strong>{l.employee_name || '—'}</strong>
                  <span className="small"> · {l.start_date} → {l.end_date} · </span>
                  <span className={'badge ' + (l.status === 'pending' ? 'muted' : 'success')}>
                    {t('status.' + l.status)}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 10 }}>
                <Link to="/leaves">{t('dash.goToLeaves')} →</Link>
              </div>
            </div>
            <div className="col card">
              <h3>{t('dash.recentExpenses')}</h3>
              {ctx.recentExpenses.length === 0 && <div className="small">{t('exp.empty')}</div>}
              {ctx.recentExpenses.map(e => (
                <div key={e.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <strong>{e.employee_name || '—'}</strong>
                  <span className="small"> · {e.title} · </span>
                  <span>{Number(e.amount).toLocaleString()} {e.currency}</span>
                  <span className={'badge ' + (e.status === 'pending' ? 'muted' : 'success')} style={{ marginLeft: 8 }}>
                    {t('status.' + e.status)}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 10 }}>
                <Link to="/expenses">{t('dash.goToExpenses')} →</Link>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>{t('dash.lastRun')}</h3>
            {!ctx.lastRun && <div className="small">{t('dash.noRun')}</div>}
            {ctx.lastRun && (
              <div>
                <span className="mono">{ctx.lastRun.file_name}</span>
                <span className="small"> — {ctx.lastRun.pay_start_date} → {ctx.lastRun.pay_end_date} · {ctx.lastRun.total_employees} emp · {Number(ctx.lastRun.total_salaries).toLocaleString()} AED</span>
              </div>
            )}
          </div>
        </>
      )}

      {data.role === 'manager' && (
        <>
          <div className="card">
            <div className="stats">
              <Stat label={t('dash.myTeam')} value={ctx.myTeam} />
              <Stat label={t('dash.pendingLeaves')} value={ctx.pendingLeaves} />
              <Stat label={t('dash.pendingExpenses')} value={ctx.pendingExpenses} />
              <Stat label={t('dash.myLeaveBalance')} value={ctx.myLeaveBalance != null ? ctx.myLeaveBalance : '—'} />
            </div>
          </div>
          <div className="card">
            <h3>{t('dash.quickActions')}</h3>
            <div className="btn-group">
              <Link to="/leaves"><button>{t('dash.goToLeaves')}</button></Link>
              <Link to="/expenses"><button>{t('dash.goToExpenses')}</button></Link>
              <Link to="/me"><button>{t('nav.mySpace')}</button></Link>
            </div>
          </div>
        </>
      )}

      {data.role === 'employee' && (
        <>
          <div className="card">
            <div className="stats">
              <Stat label={t('dash.myLeaveBalance')} value={ctx.myLeaveBalance != null ? ctx.myLeaveBalance : '—'} />
              <Stat label={t('dash.myPendingLeaves')} value={ctx.myPendingLeaves} />
              <Stat label={t('dash.myPendingExpenses')} value={ctx.myPendingExpenses} />
              <Stat label={t('dash.myDocuments')} value={ctx.myDocuments} />
            </div>
          </div>
          <div className="card">
            <h3>{t('dash.quickActions')}</h3>
            <div className="btn-group">
              <Link to="/leaves"><button className="primary">{t('dash.newLeave')}</button></Link>
              <Link to="/expenses"><button>{t('dash.newExpense')}</button></Link>
              <Link to="/me"><button>{t('nav.mySpace')}</button></Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
