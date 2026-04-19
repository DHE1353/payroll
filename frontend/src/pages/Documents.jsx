import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const DOC_TYPES = ['contract', 'passport', 'emirates_id', 'visa', 'cv', 'payslip', 'other'];

function formatSize(bytes) {
  if (!bytes) return '—';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(0) + ' Ko';
  return (kb / 1024).toFixed(1) + ' Mo';
}

export default function Documents({ user }) {
  const { t } = useI18n();
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState('');
  const [docs, setDocs] = useState([]);
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState('other');
  const [label, setLabel] = useState('');
  const [err, setErr] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.listEmployees().then(d => {
      setEmployees(d.employees);
      if (d.employees.length === 1) setSelected(String(d.employees[0].id));
    }).catch(e => setErr(e.message));
  }, []);

  const load = async (empId) => {
    if (!empId) return setDocs([]);
    try { const { documents } = await api.listDocuments(empId); setDocs(documents); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(selected); }, [selected]);

  const upload = async (e) => {
    e.preventDefault();
    if (!selected || !file) return;
    setErr(null); setSending(true);
    try {
      await api.uploadDocument(selected, file, docType, label);
      setFile(null); setLabel('');
      e.target.reset();
      load(selected);
    } catch (err) { setErr(err.message); }
    finally { setSending(false); }
  };

  const download = async (id, fallback) => {
    try {
      const { blob, filename } = await api.downloadDocument(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename || fallback; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    if (!window.confirm(t('doc.confirmDelete'))) return;
    try { await api.deleteDocument(id); load(selected); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <div className="card">
        <h2>{t('doc.title')}</h2>
        {err && <div className="alert error">{err}</div>}
        <div className="row">
          <div className="col">
            <label>{t('doc.selectEmployee')}</label>
            <select value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">—</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name || emp.employee_id}</option>)}
            </select>
          </div>
        </div>
      </div>

      {selected && (
        <>
          <div className="card">
            <h3>{t('doc.upload')}</h3>
            <form onSubmit={upload}>
              <div className="row">
                <div className="col">
                  <label>{t('doc.file')}</label>
                  <input type="file" onChange={e => setFile(e.target.files[0] || null)} required />
                </div>
                <div className="col">
                  <label>{t('doc.type')}</label>
                  <select value={docType} onChange={e => setDocType(e.target.value)}>
                    {DOC_TYPES.map(dt => <option key={dt} value={dt}>{t('doc.type.' + dt)}</option>)}
                  </select>
                </div>
                <div className="col">
                  <label>{t('doc.label')}</label>
                  <input value={label} onChange={e => setLabel(e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="primary" disabled={sending}>
                  {sending ? t('doc.submitting') : t('doc.submit')}
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>{t('doc.colType')}</th>
                  <th>{t('doc.colLabel')}</th>
                  <th>{t('doc.colFile')}</th>
                  <th className="right">{t('doc.colSize')}</th>
                  <th>{t('doc.colUploadedBy')}</th>
                  <th>{t('doc.colDate')}</th>
                  <th>{t('doc.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 && (
                  <tr><td colSpan={7} className="center" style={{ padding: 20, color: 'var(--muted)' }}>{t('doc.empty')}</td></tr>
                )}
                {docs.map(d => {
                  const canDelete = ['admin', 'hr'].includes(user.role) || d.uploaded_by_user_id === user.id;
                  return (
                    <tr key={d.id}>
                      <td>{t('doc.type.' + d.doc_type)}</td>
                      <td>{d.label || ''}</td>
                      <td className="mono">{d.original_filename}</td>
                      <td className="right">{formatSize(d.size_bytes)}</td>
                      <td>{d.uploaded_by_name || d.uploaded_by_email || ''}</td>
                      <td>{d.uploaded_at}</td>
                      <td>
                        <div className="btn-group">
                          <button onClick={() => download(d.id, d.original_filename)}>{t('exp.download')}</button>
                          {canDelete && <button className="danger" onClick={() => remove(d.id)}>{t('common.delete')}</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
