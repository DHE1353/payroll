import { Router } from 'express';
import fs from 'fs';
import db from '../db/index.js';
import { authRequired, canAccessEmployee, canValidateFor } from '../middleware/auth.js';
import { makeUploader, toRelative, toAbsolute, safeDelete } from '../services/uploads.js';

const router = Router();
router.use(authRequired);

const upload = makeUploader('receipts');
const STATUSES = ['pending', 'approved', 'rejected', 'paid'];

// Lister les notes de frais — vue adaptée au rôle
router.get('/', (req, res) => {
  const role = req.user.role;
  const companyId = req.user.companyId;
  const { status, employee_id } = req.query;

  let sql = `
    SELECT er.*, e.full_name AS employee_name, e.employee_id AS employee_code,
           e.manager_id AS employee_manager_id,
           u.email AS reviewer_email, u.full_name AS reviewer_name
    FROM expense_reports er
    LEFT JOIN employees e ON e.id = er.employee_id
    LEFT JOIN users u ON u.id = er.reviewer_user_id
    WHERE er.company_id = ?
  `;
  const args = [companyId];

  if (role === 'manager') {
    sql += ` AND (e.id = ? OR e.manager_id = ?)`;
    args.push(req.user.employeeId || -1, req.user.employeeId || -1);
  } else if (role === 'employee') {
    sql += ` AND er.employee_id = ?`;
    args.push(req.user.employeeId || -1);
  }

  if (status && STATUSES.includes(status)) {
    sql += ` AND er.status = ?`;
    args.push(status);
  }
  if (employee_id) {
    sql += ` AND er.employee_id = ?`;
    args.push(employee_id);
  }
  sql += ` ORDER BY er.created_at DESC`;

  const rows = db.prepare(sql).all(...args);
  res.json({ expenses: rows });
});

// Créer une note de frais (reçu optionnel)
router.post('/', upload.single('receipt'), (req, res) => {
  const {
    employee_id, title, expense_date, category, amount, currency, description
  } = req.body || {};

  let targetEmpId = employee_id;
  if (req.user.role === 'employee' || req.user.role === 'manager') {
    targetEmpId = req.user.employeeId;
  } else if (!targetEmpId) {
    if (req.file) safeDelete(toRelative(req.file.path));
    return res.status(400).json({ error: 'employee_id requis' });
  }

  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(targetEmpId);
  if (!emp || !canAccessEmployee(req, emp)) {
    if (req.file) safeDelete(toRelative(req.file.path));
    return res.status(404).json({ error: 'Employé introuvable' });
  }

  if (!title || !expense_date || !amount) {
    if (req.file) safeDelete(toRelative(req.file.path));
    return res.status(400).json({ error: 'title, expense_date et amount obligatoires' });
  }

  const receiptRel = req.file ? toRelative(req.file.path) : null;
  const receiptName = req.file ? req.file.originalname : null;

  const info = db.prepare(`
    INSERT INTO expense_reports
      (company_id, employee_id, title, expense_date, category, amount, currency,
       description, receipt_filename, receipt_path, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    req.user.companyId, emp.id, title, expense_date, category || null,
    Number(amount), currency || 'AED', description || null,
    receiptName, receiptRel
  );

  const row = db.prepare('SELECT * FROM expense_reports WHERE id = ?').get(info.lastInsertRowid);
  res.json({ expense: row });
});

// Télécharger le reçu
router.get('/:id/receipt', (req, res) => {
  const e = db.prepare('SELECT * FROM expense_reports WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!e) return res.status(404).json({ error: 'Note introuvable' });
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(e.employee_id);
  if (!canAccessEmployee(req, emp) && !canValidateFor(req, emp)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  if (!e.receipt_path) return res.status(404).json({ error: 'Aucun reçu attaché' });
  const abs = toAbsolute(e.receipt_path);
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Fichier manquant sur le serveur' });
  res.download(abs, e.receipt_filename || 'receipt');
});

// Annuler / supprimer sa propre note (si encore pending)
router.delete('/:id', (req, res) => {
  const e = db.prepare('SELECT * FROM expense_reports WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!e) return res.status(404).json({ error: 'Note introuvable' });

  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(e.employee_id);
  const isOwner = emp && emp.id === req.user.employeeId;
  const canAct = isOwner || ['admin', 'hr'].includes(req.user.role);
  if (!canAct) return res.status(403).json({ error: 'Accès refusé' });

  if (e.status !== 'pending' && !['admin', 'hr'].includes(req.user.role)) {
    return res.status(400).json({ error: 'Seules les notes en attente peuvent être supprimées' });
  }

  if (e.receipt_path) safeDelete(e.receipt_path);
  db.prepare('DELETE FROM expense_reports WHERE id = ?').run(e.id);
  res.json({ ok: true });
});

// Review (approve / reject)
router.post('/:id/review', (req, res) => {
  const { action, review_comment } = req.body || {};
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action invalide' });
  }
  const e = db.prepare('SELECT * FROM expense_reports WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!e) return res.status(404).json({ error: 'Note introuvable' });
  if (e.status !== 'pending') return res.status(400).json({ error: 'Déjà traitée' });

  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(e.employee_id);
  if (!canValidateFor(req, emp)) return res.status(403).json({ error: 'Accès refusé' });

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  db.prepare(`
    UPDATE expense_reports
    SET status = ?, reviewer_user_id = ?, review_comment = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, req.user.userId, review_comment || null, e.id);

  res.json({ expense: db.prepare('SELECT * FROM expense_reports WHERE id = ?').get(e.id) });
});

// Marquer comme payée (admin/hr, uniquement si approved)
router.post('/:id/mark-paid', (req, res) => {
  if (!['admin', 'hr'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const e = db.prepare('SELECT * FROM expense_reports WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!e) return res.status(404).json({ error: 'Note introuvable' });
  if (e.status !== 'approved') return res.status(400).json({ error: 'Seule une note approuvée peut être payée' });
  db.prepare(`UPDATE expense_reports SET status = 'paid' WHERE id = ?`).run(e.id);
  res.json({ expense: db.prepare('SELECT * FROM expense_reports WHERE id = ?').get(e.id) });
});

export default router;
