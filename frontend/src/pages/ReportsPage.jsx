import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  FileBarChart, 
  Download, 
  Calendar, 
  Filter, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Printer,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Building
} from 'lucide-react';

const DEPARTMENTS = [
  { key: 'all', label: 'All Departments' },
  { key: 'interns', label: 'Interns' },
  { key: 'ai_ml_frontend', label: 'AI/ML, Frontend Engineer' },
  { key: 'backend', label: 'Backend Engineer' }
];

export default function ReportsPage() {
  const { todayIstStr } = useAuth();
  
  // Date range defaults: past 7 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(todayIstStr);
  const [department, setDepartment] = useState('all');
  const [selectedWorkerId, setSelectedWorkerId] = useState('all');
  const [status, setStatus] = useState('all');
  
  const [employees, setEmployees] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportNotice, setExportNotice] = useState('');

  // Fetch all employees for the employee filter dropdown
  const fetchEmployees = async () => {
    try {
      const res = await api.getWorkers({ status: 'Active' });
      if (res.success) {
        setEmployees(res.workers || []);
      }
    } catch {
      // ignore
    }
  };

  const fetchReport = async () => {
    if (!startDate || !endDate) {
      setError('Please select both Start Date and End Date.');
      return;
    }
    if (startDate > endDate) {
      setError('Start Date cannot be later than End Date.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const res = await api.getAttendanceReport({
        start_date: startDate,
        end_date: endDate,
        department,
        worker_id: selectedWorkerId,
        status
      });
      if (res.success) {
        setReportData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, department, selectedWorkerId, status]);

  // Quick preset dates
  const handlePreset = (days) => {
    const end = todayIstStr;
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end);
  };

  const handleFullMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(todayIstStr);
  };

  const validateExportDates = () => {
    if (!startDate || !endDate) {
      setError('Start Date and End Date are strictly required for CSV export.');
      return false;
    }
    if (startDate > endDate) {
      setError('Start Date cannot be later than End Date.');
      return false;
    }
    return true;
  };

  // Requirement 12.D: Detailed Daily Attendance CSV
  const handleExportDetailedCsv = () => {
    if (!validateExportDates()) return;
    setError('');
    const url = api.getExportCsvDetailedUrl({
      start_date: startDate,
      end_date: endDate,
      department,
      worker_id: selectedWorkerId
    });
    setExportNotice(`Downloading Detailed Attendance CSV (${startDate} to ${endDate})...`);
    window.open(url, '_blank');
    setTimeout(() => setExportNotice(''), 4000);
  };

  // Requirement 12.D: Employee Attendance Summary CSV
  const handleExportSummaryCsv = () => {
    if (!validateExportDates()) return;
    setError('');
    const url = api.getExportCsvSummaryUrl({
      start_date: startDate,
      end_date: endDate,
      department,
      worker_id: selectedWorkerId
    });
    setExportNotice(`Downloading Employee Summary CSV (${startDate} to ${endDate})...`);
    window.open(url, '_blank');
    setTimeout(() => setExportNotice(''), 4000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter employees matching selected department for the worker dropdown
  const filteredEmployees = employees.filter(emp => {
    if (department === 'all') return true;
    return emp.department === department || emp.department_key === department;
  });

  const summary = reportData?.summary || {
    total_records: 0,
    present_count: 0,
    half_day_count: 0,
    leave_count: 0,
    total_hours_worked: '0h',
    average_daily_hours: '0h'
  };

  const records = reportData?.records || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Reports & Attendance CSV Export
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              CSV Export Ready (UTF-8 BOM)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Export attendance percentage, scheduled days, and daily records with strict date-range filtering.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 flex items-center space-x-1.5 transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Export Feedback Notices */}
      {exportNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2 animate-slide-down">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center space-x-2 animate-slide-down">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Requirement 12.A: Dedicated Export Attendance CSV Control Panel */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/80 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-700/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Export Attendance CSV</h2>
              <p className="text-xs text-slate-300">
                Select a specific date range, department, or individual employee to download verified records
              </p>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Presets:</span>
            <button
              onClick={() => handlePreset(0)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => handlePreset(7)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              Last 7 Days
            </button>
            <button
              onClick={handleFullMonth}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              This Month
            </button>
          </div>
        </div>

        {/* Filter Inputs (Requirement 12.A) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Start Date <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              End Date <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Department Filter</label>
            <div className="relative">
              <Building className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setSelectedWorkerId('all'); // reset worker when department changes
                }}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Employee Filter</label>
            <div className="relative">
              <Users className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Employees</option>
                {filteredEmployees.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name} ({w.worker_code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Download Actions (Requirement 12.D) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-700/80">
          <p className="text-[11px] text-slate-400">
            Export includes Attendance Percentage: <span className="font-mono text-emerald-400">(Present Days ÷ Scheduled Days) × 100</span>
          </p>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {/* Option 1: Detailed Daily CSV */}
            <button
              onClick={handleExportDetailedCsv}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all transform active:scale-95"
              title="Download 1 row per employee per date in range"
            >
              <Download className="w-4 h-4" />
              <span>Detailed Daily Attendance CSV</span>
            </button>

            {/* Option 2: Employee Summary CSV */}
            <button
              onClick={handleExportSummaryCsv}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all transform active:scale-95"
              title="Download 1 row per employee with totals and attendance percentage"
            >
              <Download className="w-4 h-4" />
              <span>Employee Summary CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Records</p>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">{summary.total_records}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm text-center">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase">Present Days</p>
          <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{summary.present_count}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm text-center">
          <p className="text-[11px] font-semibold text-amber-600 uppercase">Half Days</p>
          <p className="text-xl font-extrabold text-amber-600 mt-0.5">{summary.half_day_count}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-sm text-center">
          <p className="text-[11px] font-semibold text-rose-600 uppercase">Leave Days</p>
          <p className="text-xl font-extrabold text-rose-600 mt-0.5">{summary.leave_count}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm text-center">
          <p className="text-[11px] font-semibold text-blue-600 uppercase">Total Hours</p>
          <p className="text-xl font-extrabold text-blue-600 mt-0.5">{summary.total_hours_worked}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-sm text-center">
          <p className="text-[11px] font-semibold text-indigo-600 uppercase">Avg. Daily Shift</p>
          <p className="text-xl font-extrabold text-indigo-600 mt-0.5">{summary.average_daily_hours}</p>
        </div>
      </div>

      {/* Report Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-sm text-slate-800">
              Attendance Records ({startDate} to {endDate})
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              &bull; {records.length} entries
            </span>
          </div>

          <button
            onClick={fetchReport}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Employee ID & Name</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Time In (IST)</th>
                <th className="py-3 px-3">Time Out (IST)</th>
                <th className="py-3 px-3">Duration</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Audited By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-blue-500" />
                    <span>Loading report records...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600 text-sm">No records found for the selected date range</p>
                    <p className="text-xs mt-1">Adjust the date range or filters above.</p>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.attendance_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {r.attendance_date}
                    </td>
                    <td className="py-3 px-3">
                      <div>
                        <p className="font-bold text-slate-900">{r.full_name}</p>
                        <p className="text-[11px] text-blue-600 font-mono">{r.worker_code}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium">
                        {r.department_label || r.department}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-800">
                      {r.time_in_display}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      {r.time_out_display}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">
                      {r.duration_display}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'PRESENT' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : r.status === 'HALF_DAY'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 text-[11px]">
                      {r.updated_by_manager || r.created_by_manager || 'System'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200/80 text-slate-500 text-[11px] flex items-center justify-between">
          <span>Total Records in Period: <strong className="text-slate-700">{records.length}</strong></span>
          <div className="flex items-center space-x-3">
            <button onClick={handleExportDetailedCsv} className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center space-x-1">
              <Download className="w-3.5 h-3.5" />
              <span>Download Detailed CSV</span>
            </button>
            <span>&bull;</span>
            <button onClick={handleExportSummaryCsv} className="text-blue-700 hover:text-blue-800 font-bold flex items-center space-x-1">
              <Download className="w-3.5 h-3.5" />
              <span>Download Summary CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
