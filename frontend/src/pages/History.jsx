import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function History() {
  const [runs, setRuns] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.listRuns().then(d => setRuns(d.runs)).catch(e => setErr(e.message));
  }, []);

  return (
    <div className="card">
      <h2>Historique des fichiers générés</h2>
      {err && <div className="alert error">{err}</div>}
      <table>
        <thead>
          <tr>
            <th>Date génération</th>
            <th>Période</th>
            <th>Jours</th>
            <th>Employés</th>
            <th className="right">Total</th>
            <th>Fichier</th>
          </tr>
        </thead>
        <tbody>
          {runs.length === 0 && <tr><td colSpan={6} className="center" style={{ padding: 20, color: 'var(--muted)' }}>Aucune génération pour le moment.</td></tr>}
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
