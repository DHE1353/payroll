import { Router } from 'express';
import db from '../db/index.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const { role, companyId, userId, employeeId } = req.user;
  const out = { role, context: {} };

  if (role === 'admin' || role === 'hr') {
    const employees = db.prepare('SELECT COUNT(*) AS n FROM employees WHERE company_id = ? AND active = 1')
      .get(companyId).n;
    const pendingLeaves = db.prepare(`SELECT COUNT(*) AS n FROM leave_requests WHERE company_id = ? AND status = 'pending'`)
      .get(companyId).n;
    const pendingExpenses = db.prepare(`SELECT COUNT(*) AS n FROM expense_reports WHERE company_id = ? AND status = 'pending'`)
      .get(companyId).n;
    const totalMonthlySalaries = db.prepare(`
      SELECT COALESCE(SUM(fixed_income + variable_income), 0) AS s
      FROM employees WHERE company_id = ? AND active = 1
    `).get(companyId).s;
    const lastRun = db.prepare(`
      SELECT * FROM payroll_runs WHERE company_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(companyId);

    const recentLeaves = db.prepare(`
      SELECT lr.*, e.full_name AS employee_name
      FROM leave_requests lr
      LEFT JOIN employees e ON e.id = lr.employee_id
      WHERE lr.company_id = ?
      ORDER BY lr.created_at DESC LIMIT 5
    `).all(companyId);
    const recentExpenses = db.prepare(`
      SELECT er.*, e.full_name AS employee_name
      FROM expense_reports er
      LEFT JOIN employees e ON e.id = er.employee_id
      WHERE er.company_id = ?
      ORDER BY er.created_at DESC LIMIT 5
    `).all(companyId);

    out.context = {
      employees, pendingLeaves, pendingExpenses,
      totalMonthlySalaries, lastRun,
      recentLeaves, recentExpenses
    };
    return res.json(out);
  }

  if (role === 'manager') {
    const myTeam = db.prepare('SELECT COUNT(*) AS n FROM employees WHERE company_id = ? AND manager_id = ? AND active = 1')
      .get(companyId, employeeId).n;
    const pendingLeaves = db.prepare(`
      SELECT COUNT(*) AS n
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      WHERE lr.company_id = ? AND lr.status = 'pending' AND e.manager_id = ?
    `).get(companyId, employeeId).n;
    const pendingExpenses = db.prepare(`
      SELECT COUNT(*) AS n
      FROM expense_reports er
      JOIN employees e ON e.id = er.employee_id
      WHERE er.company_id = ? AND er.status = 'pending' AND e.manager_id = ?
    `).get(companyId, employeeId).n;

    const me = employeeId ? db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) : null;

    out.context = {
      myTeam, pendingLeaves, pendingExpenses,
      myLeaveBalance: me?.annual_leave_balance ?? null,
      me
    };
    return res.json(out);
  }

  // employee
  const me = employeeId ? db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) : null;
  const myPendingLeaves = employeeId
    ? db.prepare(`SELECT COUNT(*) AS n FROM leave_requests WHERE employee_id = ? AND status = 'pending'`)
        .get(employeeId).n
    : 0;
  const myPendingExpenses = employeeId
    ? db.prepare(`SELECT COUNT(*) AS n FROM expense_reports WHERE employee_id = ? AND status = 'pending'`)
        .get(employeeId).n
    : 0;
  const myDocs = employeeId
    ? db.prepare(`SELECT COUNT(*) AS n FROM employee_documents WHERE employee_id = ?`).get(employeeId).n
    : 0;

  out.context = {
    me,
    myLeaveBalance: me?.annual_leave_balance ?? null,
    myPendingLeaves,
    myPendingExpenses,
    myDocuments: myDocs
  };
  res.json(out);
});

export default router;
