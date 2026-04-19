import { Router } from 'express';
import db from '../db/index.js';
import { authRequired, canAccessEmployee, canValidateFor } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

const LEAVE_TYPES = ['annual', 'sick', 'unpaid', 'other'];
const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

function businessDaysBetween(startStr, endStr) {
  // Tous les jours inclus (simpliste). On peut raffiner si besoin (jours ouvrés).
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start) || isNaN(end) || end < start) return 0;
  const diff = (end - start) / (1000 * 60 * 60 * 24);
  return diff + 1;
}

function decorateRequest(r) {
  return r;
}

// Lister les demandes — vue adaptée au rôle
router.get('/', (req, res) => {
  const role = req.user.role;
  const companyId = req.user.companyId;
  const { status, employee_id } = req.query;

  let sql = `
    SELECT lr.*, e.full_name AS employee_name, e.employee_id AS employee_code,
           e.manager_id AS employee_manager_id,
           u.email AS reviewer_email, u.full_name AS reviewer_name
    FROM leave_requests lr
    LEFT JOIN employees e ON e.id = lr.employee_id
    LEFT JOIN users u ON u.id = lr.reviewer_user_id
    WHERE lr.company_id = ?
  `;
  const args = [companyId];

  if (role === 'manager') {
    sql += ` AND (e.id = ? OR e.manager_id = ?)`;
    args.push(req.user.employeeId || -1, req.user.employeeId || -1);
  } else if (role === 'employee') {
    sql += ` AND lr.employee_id = ?`;
    args.push(req.user.employeeId || -1);
  }

  if (status && STATUSES.includes(status)) {
    sql += ` AND lr.status = ?`;
    args.push(status);
  }
  if (employee_id) {
    sql += ` AND lr.employee_id = ?`;
    args.push(employee_id);
  }
  sql += ` ORDER BY lr.created_at DESC`;

  const rows = db.prepare(sql).all(...args);
  res.json({ requests: rows.map(decorateRequest) });
});

// Créer une demande — par l'employé lui-même ou un admin/hr
router.post('/', (req, res) => {
  const { employee_id, leave_type, start_date, end_date, reason } = req.body || {};
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'Dates de début et fin obligatoires' });
  }
  const lt = LEAVE_TYPES.includes(leave_type) ? leave_type : 'annual';

  let targetEmpId = employee_id;
  if (req.user.role === 'employee' || req.user.role === 'manager') {
    targetEmpId = req.user.employeeId;
  } else if (!targetEmpId) {
    return res.status(400).json({ error: 'employee_id requis' });
  }

  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(targetEmpId);
  if (!emp || !canAccessEmployee(req, emp)) {
    return res.status(404).json({ error: 'Employé introuvable' });
  }

  const days = businessDaysBetween(start_date, end_date);
  if (days <= 0) return res.status(400).json({ error: 'Période invalide' });

  const info = db.prepare(`
    INSERT INTO leave_requests
      (company_id, employee_id, leave_type, start_date, end_date, days, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(req.user.companyId, emp.id, lt, start_date, end_date, days, reason || null);

  const row = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(info.lastInsertRowid);
  res.json({ request: row });
});

// Annuler sa propre demande (si encore pending)
router.post('/:id/cancel', (req, res) => {
  const r = db.prepare('SELECT * FROM leave_requests WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!r) return res.status(404).json({ error: 'Demande introuvable' });

  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(r.employee_id);
  const isOwner = emp && emp.id === req.user.employeeId;
  const canAct = isOwner || ['admin', 'hr'].includes(req.user.role);
  if (!canAct) return res.status(403).json({ error: 'Accès refusé' });

  if (r.status !== 'pending') {
    return res.status(400).json({ error: 'Seules les demandes en attente peuvent être annulées' });
  }

  db.prepare(`UPDATE leave_requests SET status = 'cancelled' WHERE id = ?`).run(r.id);
  res.json({ ok: true });
});

// Valider (approve/reject) — admin, hr, ou manager du collaborateur
router.post('/:id/review', (req, res) => {
  const { action, review_comment } = req.body || {};
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action invalide (approve | reject)' });
  }
  const r = db.prepare('SELECT * FROM leave_requests WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!r) return res.status(404).json({ error: 'Demande introuvable' });
  if (r.status !== 'pending') {
    return res.status(400).json({ error: 'Cette demande a déjà été traitée' });
  }

  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(r.employee_id);
  if (!canValidateFor(req, emp)) {
    return res.status(403).json({ error: 'Vous ne pouvez pas valider cette demande' });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE leave_requests
      SET status = ?, reviewer_user_id = ?, review_comment = ?, reviewed_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, req.user.userId, review_comment || null, r.id);

    if (newStatus === 'approved' && r.leave_type === 'annual') {
      db.prepare(`
        UPDATE employees
        SET annual_leave_balance = annual_leave_balance - ?
        WHERE id = ?
      `).run(r.days, r.employee_id);
    }
  });
  tx();

  const updated = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(r.id);
  res.json({ request: updated });
});

// Solde de l'employé
router.get('/balance/:employeeId', (req, res) => {
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
  if (!emp || !canAccessEmployee(req, emp)) {
    return res.status(404).json({ error: 'Employé introuvable' });
  }
  const pending = db.prepare(`
    SELECT COALESCE(SUM(days), 0) AS d FROM leave_requests
    WHERE employee_id = ? AND status = 'pending' AND leave_type = 'annual'
  `).get(emp.id);
  res.json({
    employee_id: emp.id,
    annual_leave_balance: emp.annual_leave_balance,
    pending_days: pending.d
  });
});

export default router;
