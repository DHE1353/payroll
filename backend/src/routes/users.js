import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

const VALID_ROLES = ['admin', 'hr', 'manager', 'employee'];

// Lister les utilisateurs de la société (admin + hr)
router.get('/', requireRole('admin', 'hr'), (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.email, u.full_name, u.role, u.active, u.created_at,
           u.employee_id AS employee_pk,
           e.employee_id AS employee_code, e.full_name AS employee_name
    FROM users u
    LEFT JOIN employees e ON e.id = u.employee_id
    WHERE u.company_id = ?
    ORDER BY u.role, u.email
  `).all(req.user.companyId);
  res.json({ users: rows });
});

// Créer un utilisateur (admin seulement)
router.post('/', requireRole('admin'), (req, res) => {
  const { email, password, full_name, role, employee_id } = req.body || {};
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'email, password et role sont obligatoires' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }
  if ((role === 'employee' || role === 'manager') && !employee_id) {
    return res.status(400).json({ error: 'Un employé doit être associé pour le rôle employee ou manager' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email déjà utilisé' });

  // Valider que l'employé appartient à la société
  if (employee_id) {
    const emp = db.prepare('SELECT id FROM employees WHERE id = ? AND company_id = ?')
      .get(employee_id, req.user.companyId);
    if (!emp) return res.status(400).json({ error: 'Employé introuvable dans votre société' });
    // Un seul compte par employé
    const linked = db.prepare('SELECT id FROM users WHERE employee_id = ?').get(employee_id);
    if (linked) return res.status(409).json({ error: 'Cet employé a déjà un compte utilisateur' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`
    INSERT INTO users (company_id, employee_id, email, password_hash, full_name, role, active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(req.user.companyId, employee_id || null, email, hash, full_name || null, role);

  const user = db.prepare('SELECT id, email, full_name, role, active, employee_id FROM users WHERE id = ?')
    .get(info.lastInsertRowid);
  res.json({ user });
});

// Modifier un utilisateur (rôle, active, nom)
router.put('/:id', requireRole('admin'), (req, res) => {
  const { full_name, role, active, employee_id } = req.body || {};
  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }
  const existing = db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!existing) return res.status(404).json({ error: 'Utilisateur introuvable' });

  // Empêcher de se désactiver soi-même ou de perdre le dernier admin
  if (existing.id === req.user.userId && active === false) {
    return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' });
  }
  if (existing.role === 'admin' && role && role !== 'admin') {
    const admins = db.prepare('SELECT COUNT(*) AS n FROM users WHERE company_id = ? AND role = ? AND active = 1')
      .get(req.user.companyId, 'admin');
    if (admins.n <= 1) {
      return res.status(400).json({ error: 'Impossible de rétrograder le dernier administrateur' });
    }
  }

  if (employee_id != null && employee_id !== existing.employee_id) {
    if (employee_id) {
      const emp = db.prepare('SELECT id FROM employees WHERE id = ? AND company_id = ?')
        .get(employee_id, req.user.companyId);
      if (!emp) return res.status(400).json({ error: 'Employé introuvable' });
      const linked = db.prepare('SELECT id FROM users WHERE employee_id = ? AND id != ?')
        .get(employee_id, existing.id);
      if (linked) return res.status(409).json({ error: 'Cet employé a déjà un compte' });
    }
  }

  db.prepare(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      role = COALESCE(?, role),
      active = COALESCE(?, active),
      employee_id = COALESCE(?, employee_id)
    WHERE id = ? AND company_id = ?
  `).run(
    full_name,
    role || null,
    active != null ? (active ? 1 : 0) : null,
    employee_id != null ? employee_id : null,
    req.params.id, req.user.companyId
  );

  const user = db.prepare('SELECT id, email, full_name, role, active, employee_id FROM users WHERE id = ?')
    .get(req.params.id);
  res.json({ user });
});

// Réinitialiser mot de passe (admin)
router.post('/:id/password', requireRole('admin'), (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères)' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!existing) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ ok: true });
});

// Changer son propre mot de passe
router.post('/me/password', (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Mots de passe requis (nouveau min 6 caractères)' });
  }
  const me = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.userId);
  if (!me || !bcrypt.compareSync(current_password, me.password_hash)) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(new_password, 10), req.user.userId);
  res.json({ ok: true });
});

// Supprimer un utilisateur (admin)
router.delete('/:id', requireRole('admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!existing) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (existing.id === req.user.userId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  if (existing.role === 'admin') {
    const admins = db.prepare('SELECT COUNT(*) AS n FROM users WHERE company_id = ? AND role = ? AND active = 1')
      .get(req.user.companyId, 'admin');
    if (admins.n <= 1) {
      return res.status(400).json({ error: 'Impossible de supprimer le dernier administrateur' });
    }
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
