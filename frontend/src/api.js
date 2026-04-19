const BASE = '/api';

function getToken() { return localStorage.getItem('wps_token'); }
export function setToken(t) { localStorage.setItem('wps_token', t); }
export function clearToken() { localStorage.removeItem('wps_token'); }

async function request(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body instanceof FormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined)
  });

  if (res.status === 401) {
    clearToken();
    if (!path.startsWith('/auth/')) window.location.href = '/login';
  }

  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const err = ct.includes('json') ? await res.json() : { error: await res.text() };
    throw new Error(err.error || 'Erreur');
  }
  if (ct.includes('json')) return res.json();
  return res;
}

function downloadBlob(path) {
  const token = getToken();
  return fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } })
    .then(async r => {
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur');
      const blob = await r.blob();
      const cd = r.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="?([^";]+)"?/);
      return { blob, filename: m ? m[1] : 'file' };
    });
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),
  updateCompany: (body) => request('/auth/company', { method: 'PUT', body }),

  // Employés
  listEmployees: () => request('/employees'),
  getEmployee: (id) => request(`/employees/${id}`),
  createEmployee: (body) => request('/employees', { method: 'POST', body }),
  updateEmployee: (id, body) => request(`/employees/${id}`, { method: 'PUT', body }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),
  importEmployees: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/employees/import', { method: 'POST', body: fd });
  },

  // Paie
  previewPayroll: (body) => request('/payroll/preview', { method: 'POST', body }),
  generatePayroll: async (body) => {
    const token = getToken();
    const res = await fetch(BASE + '/payroll/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: 'Erreur' }));
      throw new Error(j.error || 'Erreur de génération');
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : 'payroll.xlsx';
    return { blob, filename };
  },
  listRuns: () => request('/payroll/runs'),

  // Utilisateurs
  listUsers: () => request('/users'),
  createUser: (body) => request('/users', { method: 'POST', body }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PUT', body }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  resetUserPassword: (id, password) => request(`/users/${id}/password`, { method: 'POST', body: { password } }),
  changeMyPassword: (current_password, new_password) =>
    request('/users/me/password', { method: 'POST', body: { current_password, new_password } }),

  // Congés
  listLeaves: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('/leaves' + (q ? `?${q}` : ''));
  },
  createLeave: (body) => request('/leaves', { method: 'POST', body }),
  cancelLeave: (id) => request(`/leaves/${id}/cancel`, { method: 'POST' }),
  reviewLeave: (id, action, review_comment) =>
    request(`/leaves/${id}/review`, { method: 'POST', body: { action, review_comment } }),
  leaveBalance: (employeeId) => request(`/leaves/balance/${employeeId}`),

  // Notes de frais
  listExpenses: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('/expenses' + (q ? `?${q}` : ''));
  },
  createExpense: (fields, receiptFile) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => { if (v != null) fd.append(k, v); });
    if (receiptFile) fd.append('receipt', receiptFile);
    return request('/expenses', { method: 'POST', body: fd });
  },
  deleteExpense: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
  reviewExpense: (id, action, review_comment) =>
    request(`/expenses/${id}/review`, { method: 'POST', body: { action, review_comment } }),
  markExpensePaid: (id) => request(`/expenses/${id}/mark-paid`, { method: 'POST' }),
  downloadReceipt: (id) => downloadBlob(`/expenses/${id}/receipt`),

  // Documents
  listDocuments: (employeeId) => request(`/documents/employee/${employeeId}`),
  uploadDocument: (employeeId, file, doc_type, label) => {
    const fd = new FormData();
    fd.append('file', file);
    if (doc_type) fd.append('doc_type', doc_type);
    if (label) fd.append('label', label);
    return request(`/documents/employee/${employeeId}`, { method: 'POST', body: fd });
  },
  deleteDocument: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  downloadDocument: (id) => downloadBlob(`/documents/${id}/download`),

  // Dashboard
  dashboard: () => request('/dashboard')
};
