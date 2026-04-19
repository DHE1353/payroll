import ExcelJS from 'exceljs';

/**
 * Génère un classeur ExcelJS contenant la feuille "SIF" au format
 * du modèle fourni (ligne EDR par employé + ligne SCR de contrôle).
 *
 * Colonnes: Type | Employee_ID | Routing_Code | Employee_IBAN |
 *           PayStart_Date | PayEnd_Date | Days_In_Period |
 *           Fixed_Income | Variable_Income | Leave_Days
 *
 * Toutes les valeurs des lignes EDR et SCR sont écrites comme TEXTE
 * (format "@") pour que la banque ne réinterprète pas les nombres
 * (préservation des zéros de tête, formats de date, etc.) — identique
 * au modèle fourni.
 *
 * Mapping de la ligne SCR (reproduit exactement la position du modèle):
 *   A (Type)            = 'SCR'
 *   B (Employee_ID)     = employer_id (ID établissement)
 *   C (Routing_Code)    = employer_routing_code
 *   D (Employee_IBAN)   = file_creation_date (date création fichier, YYYY-MM-DD)
 *   E (PayStart_Date)   = file_creation_time (HHMM)
 *   F (PayEnd_Date)     = salary_month_year (MMYYYY — mois du salaire)
 *   G (Days_In_Period)  = nombre d'employés
 *   H (Fixed_Income)    = total des salaires (fixe + variable)
 *   I (Variable_Income) = devise (ex: AED)
 *   J (Leave_Days)      = vide
 */
export async function generateSifWorkbook({
  company,
  employees,
  payStartDate,
  payEndDate,
  daysInPeriod,
  leaveDaysByEmployee = {},
  scrOverrides = {}
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WPS SIF App';
  wb.created = new Date();
  const ws = wb.addWorksheet('SIF');

  const headers = [
    'Type', 'Employee_ID', 'Routing_Code', 'Employee_IBAN',
    'PayStart_Date', 'PayEnd_Date', 'Days_In_Period',
    'Fixed_Income', 'Variable_Income', 'Leave_Days'
  ];
  ws.addRow(headers);

  // Lignes EDR (une par employé actif inclus)
  let totalSalaries = 0;
  let employeeCount = 0;
  for (const emp of employees) {
    if (emp.active === 0) continue;
    const fixed = Number(emp.fixed_income) || 0;
    const variable = Number(emp.variable_income) || 0;
    const leave = Number(leaveDaysByEmployee[emp.id] ?? leaveDaysByEmployee[emp.employee_id] ?? 0) || 0;

    ws.addRow([
      'EDR',
      String(emp.employee_id),
      String(emp.routing_code),
      String(emp.iban),
      String(payStartDate),
      String(payEndDate),
      String(Math.trunc(Number(daysInPeriod))),
      stringifyMoney(fixed),
      stringifyMoney(variable),
      stringifyLeave(leave)
    ]);
    totalSalaries += fixed + variable;
    employeeCount++;
  }

  // Ligne SCR (contrôle)
  const now = new Date();
  const fileCreationDate = scrOverrides.file_creation_date || isoDate(now);
  const fileCreationTime = scrOverrides.file_creation_time || hhmm(now);
  const salaryMonthYear = scrOverrides.salary_month_year || formatMonthYear(payStartDate);

  const scrRow = ws.addRow([
    'SCR',
    String(company.employer_id),
    String(company.employer_routing_code),
    String(fileCreationDate),
    String(fileCreationTime),
    String(salaryMonthYear),
    String(employeeCount),
    stringifyMoney(totalSalaries),
    String(company.currency || 'AED')
  ]);
  // Colonne J laissée vide (pas de cellule créée, identique au modèle)
  void scrRow;

  // Largeurs de colonnes pour lisibilité
  const widths = [8, 18, 14, 26, 14, 14, 10, 14, 16, 12];
  ws.columns.forEach((col, i) => { col.width = widths[i] || 14; });

  // Format texte "@" appliqué uniquement aux cellules ayant une valeur
  for (let r = 2; r <= ws.rowCount; r++) {
    for (let c = 1; c <= 10; c++) {
      const cell = ws.getCell(r, c);
      if (cell.value != null && cell.value !== '') cell.numFmt = '@';
    }
  }

  return {
    workbook: wb,
    summary: {
      employeeCount,
      totalSalaries: Number(totalSalaries.toFixed(2)),
      salaryMonthYear,
      fileCreationDate,
      fileCreationTime
    }
  };
}

// Convertit un montant en chaîne sans zéros inutiles (ex: 17000, 0, 1234.5)
function stringifyMoney(v) {
  const n = Number(v) || 0;
  if (Number.isInteger(n)) return String(n);
  // max 2 décimales, sans trailing zeros
  return String(parseFloat(n.toFixed(2)));
}

// Congés: le modèle utilise "0.0" — on garde une décimale
function stringifyLeave(v) {
  const n = Number(v) || 0;
  return n.toFixed(1);
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function hhmm(d) {
  return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatMonthYear(isoDateStr) {
  if (!isoDateStr) return '';
  const m = String(isoDateStr).match(/^(\d{4})-(\d{2})/);
  if (!m) return '';
  return `${m[2]}${m[1]}`;
}

export function computeDaysInPeriod(startISO, endISO) {
  const s = new Date(startISO + 'T00:00:00Z');
  const e = new Date(endISO + 'T00:00:00Z');
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}
