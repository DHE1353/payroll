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
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    employer_id TEXT NOT NULL,         -- ID établissement (utilisé dans SCR)
    employer_routing_code TEXT NOT NULL, -- Code routing banque employeur (SCR)
    employer_reference TEXT,            -- Référence additionnelle (ex: 2026-03-22 du modèle)
    employer_code TEXT,                 -- Code employeur 4 chiffres (ex: 0904)
    currency TEXT NOT NULL DEFAULT 'AED',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_id TEXT NOT NULL,         -- ex: 10020109625839 (Labour card / ID MOL)
    full_name TEXT,
    routing_code TEXT NOT NULL,        -- Code routing banque employé
    iban TEXT NOT NULL,                -- IBAN employé (AE...)
    fixed_income REAL NOT NULL DEFAULT 0,
    variable_income REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
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

  CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
  CREATE INDEX IF NOT EXISTS idx_runs_company ON payroll_runs(company_id);
`);

console.log(`Base de données initialisée: ${DB_PATH}`);
db.close();
