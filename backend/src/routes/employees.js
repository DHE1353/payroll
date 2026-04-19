import { Router } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import db from '../db/index.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authRequired);

// Lister les employés de l'entreprise
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM employees WHERE company_id = ? ORDER BY full_name, employee_id')
    .all(req.user.companyId);
  res.json({ employees: rows });
});

// Créer un employé
router.post('/', (req, res) => {
  const { employee_id, full_name, routing_code, iban, fixed_income, variable_income, active } = req.body || {};
  if (!employee_id || !routing_code || !iban) {
    return res.status(400).json({ error: 'employee_id, routing_code et iban sont obligatoires' });
  }
  try {
    const info = db.prepare(`
      INSERT INTO employees (company_id, employee_id, full_name, routing_code, iban, fixed_income, variable_income, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.companyId, String(employee_id), full_name || null, String(routing_code), String(iban),
      Number(fixed_income) || 0, Number(variable_income) || 0, active === false ? 0 : 1
    );
    const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(info.lastInsertRowid);
    res.json({ employee: row });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Un employé avec cet ID existe déjà dans votre entreprise' });
    }
    res.status(500).json({ error: e.message });
  }
});

// Modifier un employé
router.put('/:id', (req, res) => {
  const { employee_id, full_name, routing_code, iban, fixed_income, variable_income, active } = req.body || {};
  const existing = db.prepare('SELECT * FROM employees WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!existing) return res.status(404).json({ error: 'Employé introuvable' });

  db.prepare(`
    UPDATE employees SET
      employee_id = COALESCE(?, employee_id),
      full_name = COALESCE(?, full_name),
      routing_code = COALESCE(?, routing_code),
      iban = COALESCE(?, iban),
      fixed_income = COALESCE(?, fixed_income),
      variable_income = COALESCE(?, variable_income),
      active = COALESCE(?, active),
      updated_at = datetime('now')
    WHERE id = ? AND company_id = ?
  `).run(
    employee_id, full_name, routing_code, iban,
    fixed_income != null ? Number(fixed_income) : null,
    variable_income != null ? Number(variable_income) : null,
    active != null ? (active ? 1 : 0) : null,
    req.params.id, req.user.companyId
  );

  const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  res.json({ employee: row });
});

// Supprimer
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM employees WHERE id = ? AND company_id = ?')
    .run(req.params.id, req.user.companyId);
  if (info.changes === 0) return res.status(404).json({ error: 'Employé introuvable' });
  res.json({ ok: true });
});

// Import masse (CSV ou XLSX)
// Attendu (colonnes): employee_id, full_name, routing_code, iban, fixed_income, variable_income
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  const filename = req.file.originalname || '';
  const isXlsx = /\.xlsx$/i.test(filename);
  let rows = [];

  try {
    if (isXlsx) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(req.file.buffer);
      const ws = wb.worksheets[0];
      const headers = [];
      ws.getRow(1).eachCell((cell, col) => { headers[col] = String(cell.value ?? '').trim(); });
      ws.eachRow((row, rowIdx) => {
        if (rowIdx === 1) return;
        const obj = {};
        row.eachCell((cell, col) => { obj[headers[col]] = cell.value; });
        rows.push(obj);
      });
    } else {
      const text = req.file.buffer.toString('utf8');
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      rows = parsed.data;
    }
  } catch (e) {
    return res.status(400).json({ error: 'Impossible de lire le fichier: ' + e.message });
  }

  const upsert = db.prepare(`
    INSERT INTO employees (company_id, employee_id, full_name, routing_code, iban, fixed_income, variable_income, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(company_id, employee_id) DO UPDATE SET
      full_name = excluded.full_name,
      routing_code = excluded.routing_code,
      iban = excluded.iban,
      fixed_income = excluded.fixed_income,
      variable_income = excluded.variable_income,
      updated_at = datetime('now')
  `);

  let inserted = 0, updated = 0, errors = [];
  const tx = db.transaction((items) => {
    for (const it of items) {
      const empId = String(it.employee_id ?? '').trim();
      const iban = String(it.iban ?? '').trim();
      const routing = String(it.routing_code ?? '').trim();
      if (!empId || !iban || !routing) {
        errors.push({ row: it, reason: 'employee_id, iban, routing_code requis' });
        continue;
      }
      const before = db.prepare('SELECT id FROM employees WHERE company_id = ? AND employee_id = ?')
        .get(req.user.companyId, empId);
      upsert.run(
        req.user.companyId, empId, it.full_name ? String(it.full_name) : null, routing, iban,
        Number(it.fixed_income) || 0, Number(it.variable_income) || 0
      );
      if (before) updated++; else inserted++;
    }
  });
  tx(rows);

  res.json({ inserted, updated, errors, total: rows.length });
});

export default router;
