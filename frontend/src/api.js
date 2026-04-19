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

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),
  updateCompany: (body) => request('/auth/company', { method: 'PUT', body }),

  listEmployees: () => request('/employees'),
  createEmployee: (body) => request('/employees', { method: 'POST', body }),
  updateEmployee: (id, body) => request(`/employees/${id}`, { method: 'PUT', body }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),
  importEmployees: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/employees/import', { method: 'POST', body: fd });
  },

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
  listRuns: () => request('/payroll/runs')
};
