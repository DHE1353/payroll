import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';

const empty = { employee_id: '', full_name: '', routing_code: '', iban: '', fixed_income: 0, variable_income: 0, active: true };

export default function Employees() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null); // null or employee object
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const fileRef = useRef();

  const load = () => api.listEmployees().then(d => setList(d.employees)).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);

  const save = async (form) => {
    setErr(null); setMsg(null);
    try {
      if (form.id) await api.updateEmployee(form.id, form);
      else await api.createEmployee(form);
      setEditing(null); setCreating(false);
      setMsg('Employé enregistré');
      load();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (emp) => {
    if (!confirm(`Supprimer ${emp.full_name || emp.employee_id} ?`)) return;
    try { await api.deleteEmployee(emp.id); load(); }
    catch (e) { setErr(e.message); }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setMsg(null);
    try {
      const r = await api.importEmployees(file);
      setMsg(`Import: ${r.inserted} ajouté(s), ${r.updated} mis à jour${r.errors?.length ? `, ${r.errors.length} erreur(s)` : ''}`);
      load();
    } catch (e) { setErr(e.message); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Employés ({list.length})</h2>
          <div className="btn-group">
            <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={onImport} />
            <button onClick={() => fileRef.current?.click()}>Importer CSV/Excel</button>
            <button className="primary" onClick={() => { setCreating(true); setEditing({ ...empty }); }}>+ Ajouter</button>
          </div>
        </div>
        {msg && <div className="alert success" style={{ marginTop: 12 }}>{msg}</div>}
        {err && <div className="alert error" style={{ marginTop: 12 }}>{err}</div>}
        <div className="small" style={{ marginTop: 8 }}>
          Format d'import attendu (en-têtes): <code className="mono">employee_id, full_name, routing_code, iban, fixed_income, variable_income</code>
        </div>
      </div>

      {editing && (
        <EmployeeForm
          initial={editing}
          isNew={creating}
          onCancel={() => { setEditing(null); setCreating(false); }}
          onSave={save}
        />
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID employé</th>
              <th>Nom</th>
              <th>Routing</th>
              <th>IBAN</th>
              <th className="right">Fixe</th>
              <th className="right">Variable</th>
              <th>Actif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={8} className="center" style={{ padding: 24, color: 'var(--muted)' }}>Aucun employé. Ajoutez-en ou importez un fichier.</td></tr>}
            {list.map(e => (
              <tr key={e.id}>
                <td className="mono">{e.employee_id}</td>
                <td>{e.full_name || '—'}</td>
                <td className="mono">{e.routing_code}</td>
                <td className="mono">{e.iban}</td>
                <td className="right">{Number(e.fixed_income).toLocaleString()}</td>
                <td className="right">{Number(e.variable_income).toLocaleString()}</td>
                <td>{e.active ? <span className="badge success">Actif</span> : <span className="badge muted">Inactif</span>}</td>
                <td className="right">
                  <button onClick={() => { setCreating(false); setEditing(e); }}>Éditer</button>{' '}
                  <button className="danger" onClick={() => remove(e)}>Suppr.</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmployeeForm({ initial, isNew, onSave, onCancel }) {
  const [f, setF] = useState(initial);
  useEffect(() => { setF(initial); }, [initial]);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div className="card">
      <h3>{isNew ? 'Nouvel employé' : 'Modifier employé'}</h3>
      <div className="row">
        <div className="col"><label>ID employé *</label><input value={f.employee_id} onChange={set('employee_id')} /></div>
        <div className="col"><label>Nom complet</label><input value={f.full_name || ''} onChange={set('full_name')} /></div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div className="col"><label>Code routing *</label><input value={f.routing_code} onChange={set('routing_code')} /></div>
        <div className="col" style={{ flex: 2 }}><label>IBAN *</label><input value={f.iban} onChange={set('iban')} placeholder="AE..." /></div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div className="col"><label>Salaire fixe (AED)</label><input type="number" step="0.01" value={f.fixed_income} onChange={set('fixed_income')} /></div>
        <div className="col"><label>Salaire variable (AED)</label><input type="number" step="0.01" value={f.variable_income} onChange={set('variable_income')} /></div>
        <div className="col"><label>&nbsp;</label><label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={!!f.active} onChange={set('active')} style={{ width: 'auto' }} /> Actif</label></div>
      </div>
      <div className="btn-group" style={{ marginTop: 16 }}>
        <button className="primary" onClick={() => onSave(f)}>Enregistrer</button>
        <button onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}
