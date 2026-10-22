const RAW_BASE = import.meta.env.VITE_API_BASE_URL || '';
const API_BASE = RAW_BASE ? (RAW_BASE.endsWith('/api') ? RAW_BASE.replace(/\/$/, '') : `${RAW_BASE.replace(/\/$/, '')}/api`) : '/api';

function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // If not on login page, clear token and notify
    if (!endpoint.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('manager');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  getMe: () => request('/auth/me'),
  getAuthStatus: () => request('/auth/status'),
  setupInitialManager: (payload) => request('/auth/setup', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  changePassword: (oldPassword, newPassword) => request('/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
  }),

  // Server Time (authoritative IST)
  getServerTime: () => request('/time'),

  // Workers
  getWorkers: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.department) query.append('department', params.department);
    if (params.status) query.append('status', params.status);
    return request(`/workers?${query.toString()}`);
  },
  getWorkersByDepartment: (status = 'Active') => {
    const query = new URLSearchParams();
    if (status) query.append('status', status);
    return request(`/workers/by-department?${query.toString()}`);
  },
  getWorker: (id) => request(`/workers/${id}`),
  createWorker: (workerData) => request('/workers', {
    method: 'POST',
    body: JSON.stringify(workerData)
  }),
  updateWorker: (id, workerData) => request(`/workers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(workerData)
  }),
  deactivateWorker: (id) => request(`/workers/${id}/deactivate`, {
    method: 'POST'
  }),
  reactivateWorker: (id) => request(`/workers/${id}/reactivate`, {
    method: 'POST'
  }),
  getDepartments: () => request('/workers/departments'),

  // Attendance
  getDailyAttendance: (date, filters = {}) => {
    const query = new URLSearchParams();
    if (date) query.append('date', date);
    if (filters.filter_status) query.append('filter_status', filters.filter_status);
    if (filters.department) query.append('department', filters.department);
    if (filters.search) query.append('search', filters.search);
    return request(`/attendance?${query.toString()}`);
  },
  getDailyAttendanceByDepartment: (date, search = '') => {
    const query = new URLSearchParams();
    if (date) query.append('date', date);
    if (search) query.append('search', search);
    return request(`/attendance/by-department?${query.toString()}`);
  },
  checkIn: (workerId, date) => request('/attendance/check-in', {
    method: 'POST',
    body: JSON.stringify({ worker_id: workerId, date })
  }),
  checkOut: (attendanceId, workerId, date) => request('/attendance/check-out', {
    method: 'POST',
    body: JSON.stringify({ attendance_id: attendanceId, worker_id: workerId, date })
  }),
  manualEdit: (payload) => request('/attendance/manual-edit', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  markLeave: (workerId, date, reason) => request('/attendance/mark-leave', {
    method: 'POST',
    body: JSON.stringify({ worker_id: workerId, date, reason })
  }),
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams();
    if (params.attendance_id) query.append('attendance_id', params.attendance_id);
    if (params.limit) query.append('limit', params.limit);
    return request(`/attendance/audit-logs?${query.toString()}`);
  },

  // Dashboard
  getDashboardSummary: (date) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return request(`/dashboard/summary${query}`);
  },

  // Reports
  getAttendanceReport: (params = {}) => {
    const query = new URLSearchParams();
    if (params.start_date) query.append('start_date', params.start_date);
    if (params.end_date) query.append('end_date', params.end_date);
    if (params.department) query.append('department', params.department);
    if (params.worker_id) query.append('worker_id', params.worker_id);
    if (params.status) query.append('status', params.status);
    return request(`/reports/attendance?${query.toString()}`);
  },
  getExportCsvDetailedUrl: (params = {}) => {
    const query = new URLSearchParams();
    if (params.start_date) query.append('start_date', params.start_date);
    if (params.end_date) query.append('end_date', params.end_date);
    if (params.department) query.append('department', params.department);
    if (params.worker_id) query.append('worker_id', params.worker_id);
    const token = localStorage.getItem('token');
    return `${API_BASE}/reports/export-csv-detailed?${query.toString()}&token=${encodeURIComponent(token || '')}`;
  },
  getExportCsvSummaryUrl: (params = {}) => {
    const query = new URLSearchParams();
    if (params.start_date) query.append('start_date', params.start_date);
    if (params.end_date) query.append('end_date', params.end_date);
    if (params.department) query.append('department', params.department);
    if (params.worker_id) query.append('worker_id', params.worker_id);
    const token = localStorage.getItem('token');
    return `${API_BASE}/reports/export-csv-summary?${query.toString()}&token=${encodeURIComponent(token || '')}`;
  },
  getExportCsvUrl: (params = {}) => {
    const query = new URLSearchParams();
    if (params.start_date) query.append('start_date', params.start_date);
    if (params.end_date) query.append('end_date', params.end_date);
    if (params.department) query.append('department', params.department);
    if (params.worker_id) query.append('worker_id', params.worker_id);
    const token = localStorage.getItem('token');
    return `${API_BASE}/reports/export-csv-detailed?${query.toString()}&token=${encodeURIComponent(token || '')}`;
  }
};
