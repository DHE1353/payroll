import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/wps.db');

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
// Disable FK checks during schema creation, re-enable after
db.pragma('foreign_keys = OFF');

// Schéma de base + migrations idempotentes
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    employer_id TEXT NOT NULL,
    employer_routing_code TEXT NOT NULL,
    employer_reference TEXT,
    employer_code TEXT,
    currency TEXT NOT NULL DEFAULT 'AED',
    default_leave_balance REAL NOT NULL DEFAULT 30,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_id INTEGER,             -- lien vers employees.id si l'utilisateur est un collaborateur
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'employee',  -- admin | hr | manager | employee
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_id TEXT NOT NULL,
    full_name TEXT,
    email TEXT,
    job_title TEXT,
    manager_id INTEGER,              -- FK sur employees.id (manager direct)
    annual_leave_balance REAL NOT NULL DEFAULT 30,
    routing_code TEXT NOT NULL,
    iban TEXT NOT NULL,
    fixed_income REAL NOT NULL DEFAULT 0,
    variable_income REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL,
    UNIQUE(company_id, employee_id)
  );

  CREATE TABLE IF NOT EXISTS payroll_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    pay_start_date TEXT NOT NULL,
    pay_end_date TEXT NOT NULL,
    days_in_period INTEGER NOT NULL,
    total_employees INTEGER NOT NULL,
    total_salaries REAL NOT NULL,
    file_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    leave_type TEXT NOT NULL DEFAULT 'annual',   -- annual | sick | unpaid | other
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days REAL NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',      -- pending | approved | rejected | cancelled
    reviewer_user_id INTEGER,
    review_comment TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS expense_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    expense_date TEXT NOT NULL,
    category TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'AED',
    description TEXT,
    receipt_filename TEXT,        -- nom original du fichier
    receipt_path TEXT,            -- chemin relatif sous /uploads
    status TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | paid
    reviewer_user_id INTEGER,
    review_comment TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS employee_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL DEFAULT 'other',    -- contract | passport | emirates_id | visa | cv | other
    label TEXT,
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,                 -- chemin relatif sous /uploads
    mime_type TEXT,
    size_bytes INTEGER,
    uploaded_by_user_id INTEGER,
    uploaded_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
  CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
  CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
  CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id);
  CREATE INDEX IF NOT EXISTS idx_runs_company ON payroll_runs(company_id);
  CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);
  CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
  CREATE INDEX IF NOT EXISTS idx_expense_employee ON expense_reports(employee_id);
  CREATE INDEX IF NOT EXISTS idx_expense_status ON expense_reports(status);
  CREATE INDEX IF NOT EXISTS idx_docs_employee ON employee_documents(employee_id);
`);

// Micro-migrations pour dépôts existants (ajoutent les colonnes si absentes)
function columnExists(table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some(r => r.name === column);
}
function ensureColumn(table, column, ddl) {
  if (!columnExists(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn('users', 'employee_id', 'employee_id INTEGER');
ensureColumn('users', 'active', 'active INTEGER NOT NULL DEFAULT 1');
ensureColumn('employees', 'email', 'email TEXT');
ensureColumn('employees', 'job_title', 'job_title TEXT');
ensureColumn('employees', 'manager_id', 'manager_id INTEGER');
ensureColumn('employees', 'annual_leave_balance', 'annual_leave_balance REAL NOT NULL DEFAULT 30');
ensureColumn('companies', 'default_leave_balance', 'default_leave_balance REAL NOT NULL DEFAULT 30');

// Re-enable FK checks after schema is ready
db.pragma('foreign_keys = ON');

export default db;
