import { Router } from 'express';
import fs from 'fs';
import db from '../db/index.js';
import { authRequired, canAccessEmployee } from '../middleware/auth.js';
import { makeUploader, toRelative, toAbsolute, safeDelete } from '../services/uploads.js';

const router = Router();
router.use(authRequired);

const upload = makeUploader('documents');
const DOC_TYPES = ['contract', 'passport', 'emirates_id', 'visa', 'cv', 'payslip', 'other'];

// Lister les documents d'un employé
router.get('/employee/:employeeId', (req, res) => {
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
  if (!emp || !canAccessEmployee(req, emp)) {
    return res.status(404).json({ error: 'Employé introuvable' });
  }
  const rows = db.prepare(`
    SELECT d.*, u.email AS uploaded_by_email, u.full_name AS uploaded_by_name
    FROM employee_documents d
    LEFT JOIN users u ON u.id = d.uploaded_by_user_id
    WHERE d.employee_id = ?
    ORDER BY d.uploaded_at DESC
  `).all(emp.id);
  res.json({ documents: rows });
});

// Uploader un document pour un employé
router.post('/employee/:employeeId', upload.single('file'), (req, res) => {
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
  if (!emp || !canAccessEmployee(req, emp)) {
    if (req.file) safeDelete(toRelative(req.file.path));
    return res.status(404).json({ error: 'Employé introuvable' });
  }
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });

  const { doc_type, label } = req.body || {};
  const type = DOC_TYPES.includes(doc_type) ? doc_type : 'other';

  const info = db.prepare(`
    INSERT INTO employee_documents
      (company_id, employee_id, doc_type, label,
       original_filename, stored_path, mime_type, size_bytes, uploaded_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.companyId, emp.id, type, label || null,
    req.file.originalname, toRelative(req.file.path),
    req.file.mimetype || null, req.file.size || null, req.user.userId
  );

  const row = db.prepare('SELECT * FROM employee_documents WHERE id = ?').get(info.lastInsertRowid);
  res.json({ document: row });
});

// Télécharger
router.get('/:id/download', (req, res) => {
  const d = db.prepare('SELECT * FROM employee_documents WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!d) return res.status(404).json({ error: 'Document introuvable' });
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(d.employee_id);
  if (!canAccessEmployee(req, emp)) return res.status(403).json({ error: 'Accès refusé' });

  const abs = toAbsolute(d.stored_path);
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Fichier manquant sur le serveur' });
  res.download(abs, d.original_filename || 'document');
});

// Supprimer (admin/hr, ou l'uploader s'il est encore dans la société)
router.delete('/:id', (req, res) => {
  const d = db.prepare('SELECT * FROM employee_documents WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!d) return res.status(404).json({ error: 'Document introuvable' });

  const canDelete = ['admin', 'hr'].includes(req.user.role) || d.uploaded_by_user_id === req.user.userId;
  if (!canDelete) return res.status(403).json({ error: 'Accès refusé' });

  if (d.stored_path) safeDelete(d.stored_path);
  db.prepare('DELETE FROM employee_documents WHERE id = ?').run(d.id);
  res.json({ ok: true });
});

export default router;
