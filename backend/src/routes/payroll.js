import { Router } from 'express';
import db from '../db/index.js';
import { authRequired } from '../middleware/auth.js';
import { generateSifWorkbook, computeDaysInPeriod } from '../services/sifGenerator.js';

const router = Router();
router.use(authRequired);

/**
 * Prévisualisation: calcule les totaux sans générer le fichier.
 * Body: { payStartDate, payEndDate, daysInPeriod?, employeeOverrides?: {id|employee_id: {fixed_income, variable_income, leave_days, include}}}
 */
router.post('/preview', (req, res) => {
  const { payStartDate, payEndDate, daysInPeriod, employeeOverrides = {} } = req.body || {};
  if (!payStartDate || !payEndDate) return res.status(400).json({ error: 'payStartDate et payEndDate requis' });

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.companyId);
  const employees = db.prepare('SELECT * FROM employees WHERE company_id = ? AND active = 1 ORDER BY full_name, employee_id')
    .all(req.user.companyId);

  const days = daysInPeriod ? Number(daysInPeriod) : computeDaysInPeriod(payStartDate, payEndDate);

  const items = employees.map(emp => {
    const key = emp.id in employeeOverrides ? emp.id : emp.employee_id;
    const ov = employeeOverrides[key] || {};
    const include = ov.include !== false;
    const fixed = ov.fixed_income != null ? Number(ov.fixed_income) : Number(emp.fixed_income) || 0;
    const variable = ov.variable_income != null ? Number(ov.variable_income) : Number(emp.variable_income) || 0;
    const leave = ov.leave_days != null ? Number(ov.leave_days) : 0;
    return { ...emp, fixed, variable, leave, include };
  }).filter(e => e.include);

  const totals = items.reduce((acc, e) => {
    acc.employeeCount += 1;
    acc.totalSalaries += e.fixed + e.variable;
    return acc;
  }, { employeeCount: 0, totalSalaries: 0 });

  res.json({
    company,
    period: { payStartDate, payEndDate, days },
    employees: items,
    totals: { employeeCount: totals.employeeCount, totalSalaries: Number(totals.totalSalaries.toFixed(2)) }
  });
});

/**
 * Génère et retourne le fichier SIF .xlsx en téléchargement.
 * Body: même structure que /preview.
 */
router.post('/generate', async (req, res) => {
  const { payStartDate, payEndDate, daysInPeriod, employeeOverrides = {}, scrOverrides = {} } = req.body || {};
  if (!payStartDate || !payEndDate) return res.status(400).json({ error: 'payStartDate et payEndDate requis' });

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.companyId);
  const employees = db.prepare('SELECT * FROM employees WHERE company_id = ? AND active = 1 ORDER BY full_name, employee_id')
    .all(req.user.companyId);

  const days = daysInPeriod ? Number(daysInPeriod) : computeDaysInPeriod(payStartDate, payEndDate);

  // Applique les overrides (et possibilité d'exclure)
  const leaveMap = {};
  const filtered = employees.filter(emp => {
    const key = emp.id in employeeOverrides ? emp.id : emp.employee_id;
    const ov = employeeOverrides[key] || {};
    if (ov.include === false) return false;
    if (ov.fixed_income != null) emp.fixed_income = Number(ov.fixed_income);
    if (ov.variable_income != null) emp.variable_income = Number(ov.variable_income);
    leaveMap[emp.id] = ov.leave_days != null ? Number(ov.leave_days) : 0;
    return true;
  });

  const { workbook, summary } = await generateSifWorkbook({
    company,
    employees: filtered,
    payStartDate,
    payEndDate,
    daysInPeriod: days,
    leaveDaysByEmployee: leaveMap,
    scrOverrides
  });

  // Nom de fichier à la David/Safwan: payroll_template_MM_YYYY_Company.xlsx
  const m = String(payStartDate).match(/^(\d{4})-(\d{2})/);
  const mm = m ? m[2] : '00';
  const yyyy = m ? m[1] : '0000';
  const safeCompany = (company.name || 'company').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const fileName = `payroll_template_${mm}_${yyyy}_${safeCompany}.xlsx`;

  // Enregistrement du run
  db.prepare(`
    INSERT INTO payroll_runs (company_id, pay_start_date, pay_end_date, days_in_period, total_employees, total_salaries, file_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(company.id, payStartDate, payEndDate, days, summary.employeeCount, summary.totalSalaries, fileName);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  await workbook.xlsx.write(res);
  res.end();
});

router.get('/runs', (req, res) => {
  const rows = db.prepare('SELECT * FROM payroll_runs WHERE company_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(req.user.companyId);
  res.json({ runs: rows });
});

export default router;
