import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { signToken, authRequired } from '../middleware/auth.js';

const router = Router();

// Inscription: crée une entreprise et son utilisateur admin en une fois
router.post('/register', (req, res) => {
  const {
    email, password, fullName,
    companyName, employerId, employerRoutingCode,
    employerReference, employerCode, currency
  } = req.body || {};

  if (!email || !password || !companyName || !employerId || !employerRoutingCode) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email déjà utilisé' });

  const hash = bcrypt.hashSync(password, 10);
  const tx = db.transaction(() => {
    const companyRes = db.prepare(`
      INSERT INTO companies (name, employer_id, employer_routing_code, employer_reference, employer_code, currency)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(companyName, employerId, employerRoutingCode, employerReference || null, employerCode || null, currency || 'AED');

    const userRes = db.prepare(`
      INSERT INTO users (company_id, email, password_hash, full_name, role)
      VALUES (?, ?, ?, ?, 'admin')
    `).run(companyRes.lastInsertRowid, email, hash, fullName || null);

    return { companyId: companyRes.lastInsertRowid, userId: userRes.lastInsertRowid };
  });

  const { companyId, userId } = tx();
  const token = signToken({ userId, companyId, email, role: 'admin' });
  return res.json({ token, user: { id: userId, email, fullName, companyId, role: 'admin' } });
});

// Connexion
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });

  const token = signToken({ userId: user.id, companyId: user.company_id, email: user.email, role: user.role });
  return res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.full_name, companyId: user.company_id, role: user.role }
  });
});

// Profil + entreprise
router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, email, full_name, company_id, role FROM users WHERE id = ?').get(req.user.userId);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.companyId);
  res.json({ user, company });
});

// Mise à jour des infos entreprise
router.put('/company', authRequired, (req, res) => {
  const { name, employer_id, employer_routing_code, employer_reference, employer_code, currency } = req.body || {};
  db.prepare(`
    UPDATE companies
    SET name = COALESCE(?, name),
        employer_id = COALESCE(?, employer_id),
        employer_routing_code = COALESCE(?, employer_routing_code),
        employer_reference = COALESCE(?, employer_reference),
        employer_code = COALESCE(?, employer_code),
        currency = COALESCE(?, currency)
    WHERE id = ?
  `).run(name, employer_id, employer_routing_code, employer_reference, employer_code, currency, req.user.companyId);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.companyId);
  res.json({ company });
});

export default router;
