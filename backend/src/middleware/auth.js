import jwt from 'jsonwebtoken';
import db from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Recharger les infos vivantes (rôle/active/employee_id) à chaque requête
    const fresh = db.prepare(`
      SELECT id, company_id, role, active, employee_id
      FROM users WHERE id = ?
    `).get(decoded.userId);
    if (!fresh || !fresh.active) return res.status(401).json({ error: 'Compte désactivé' });
    req.user = {
      userId: fresh.id,
      companyId: fresh.company_id,
      email: decoded.email,
      role: fresh.role,
      employeeId: fresh.employee_id || null
    };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

/**
 * Vérifie que le rôle de l'utilisateur courant fait partie des rôles autorisés.
 * Usage: router.post('/', authRequired, requireRole('admin', 'hr'), ...)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé (rôle insuffisant)' });
    }
    next();
  };
}

/**
 * Peut-il voir/modifier les données d'un employé donné ?
 * - admin / hr : tous les employés de la société
 * - manager : ses subordonnés directs (manager_id = son employeeId) + lui-même
 * - employee : uniquement lui-même
 */
export function canAccessEmployee(req, employeeRow) {
  if (!employeeRow || employeeRow.company_id !== req.user.companyId) return false;
  const role = req.user.role;
  if (role === 'admin' || role === 'hr') return true;
  const myEmpId = req.user.employeeId;
  if (!myEmpId) return false;
  if (role === 'manager') {
    return employeeRow.id === myEmpId || employeeRow.manager_id === myEmpId;
  }
  // employee
  return employeeRow.id === myEmpId;
}

/**
 * Peut-il valider (approve/reject) une demande d'un employé ?
 * - admin / hr : toujours
 * - manager : uniquement pour ses subordonnés
 * - employee : jamais
 */
export function canValidateFor(req, employeeRow) {
  if (!employeeRow || employeeRow.company_id !== req.user.companyId) return false;
  const role = req.user.role;
  if (role === 'admin' || role === 'hr') return true;
  if (role === 'manager') return employeeRow.manager_id === req.user.employeeId;
  return false;
}
