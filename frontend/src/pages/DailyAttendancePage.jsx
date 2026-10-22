import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import ManualEditModal from '../components/ManualEditModal';
import AuditHistoryModal from '../components/AuditHistoryModal';
import AddWorkerModal from '../components/AddWorkerModal';
import { 
  Calendar, 
  Search, 
  Clock, 
  LogIn, 
  LogOut, 
  Edit3, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  UserPlus,
  Building,
  Coffee,
  CheckCircle,
  HelpCircle,
  Users
} from 'lucide-react';

const DEPARTMENTS_LIST = [
  { key: 'all', label: 'All Departments' },
  { key: 'interns', label: 'Interns' },
  { key: 'ai_ml_frontend', label: 'AI/ML, Frontend Engineer' },
  { key: 'backend', label: 'Backend Engineer' }
];

export default function DailyAttendancePage({ initialDate, initialDepartment }) {
  const { todayIstStr, formattedTimeDisplay } = useAuth();
  const [selectedDate, setSelectedDate] = useState(initialDate || todayIstStr);
  const [activeDeptTab, setActiveDeptTab] = useState(initialDepartment || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentsData, setDepartmentsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentEditRecord, setCurrentEditRecord] = useState(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [currentAuditRecord, setCurrentAuditRecord] = useState(null);

  // Add Employee Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDept, setAddModalDept] = useState('interns');

  const fetchAttendanceByDepartment = async () => {
    setIsLoading(true);
    try {
      const res = await api.getDailyAttendanceByDepartment(selectedDate, searchTerm);
      if (res.success) {
        setDepartmentsData(res.departments || []);
      }
    } catch (err) {
      showNotification('error', err.message || 'Failed to load department attendance.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialDate) setSelectedDate(initialDate);
    if (initialDepartment) setActiveDeptTab(initialDepartment);
  }, [initialDate, initialDepartment]);

  useEffect(() => {
    fetchAttendanceByDepartment();
  }, [selectedDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAttendanceByDepartment();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleCheckIn = async (worker) => {
    setActionLoadingId(worker.worker_id);
    try {
      const res = await api.checkIn(worker.worker_id, selectedDate);
      if (res.success) {
        showNotification('success', res.message);
        fetchAttendanceByDepartment();
      }
    } catch (err) {
      showNotification('error', err.message || 'Failed to record check-in.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCheckOut = async (worker) => {
    setActionLoadingId(worker.worker_id);
    try {
      const res = await api.checkOut(worker.attendance_id, worker.worker_id, selectedDate);
      if (res.success) {
        showNotification('success', res.message);
        fetchAttendanceByDepartment();
      }
    } catch (err) {
      showNotification('error', err.message || 'Failed to record check-out.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkLeave = async (worker) => {
    const reason = window.prompt(`Mark ${worker.full_name} as On Leave for ${selectedDate}. Enter reason:`, 'Approved Leave');
    if (reason === null) return;

    setActionLoadingId(worker.worker_id);
    try {
      const res = await api.markLeave(worker.worker_id, selectedDate, reason || 'Approved Leave');
      if (res.success) {
        showNotification('success', res.message);
        fetchAttendanceByDepartment();
      }
    } catch (err) {
      showNotification('error', err.message || 'Failed to mark leave.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenAddEmployee = (deptKey) => {
    setAddModalDept(deptKey === 'all' ? 'interns' : deptKey);
    setAddModalOpen(true);
  };

  // Date jump helpers
  const handleYesterday = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(todayIstStr);
  };

  // Filter departments to display based on activeDeptTab
  const visibleDepts = departmentsData.filter(d => 
    activeDeptTab === 'all' ? true : d.key === activeDeptTab
  );

  // Totals across all departments
  const totalEmployees = departmentsData.reduce((acc, d) => acc + (d.total_workers || 0), 0);
  const totalWorking = departmentsData.reduce((acc, d) => acc + (d.working_count || 0), 0);
  const totalCompleted = departmentsData.reduce((acc, d) => acc + (d.completed_count || 0), 0);
  const totalNotCheckedIn = departmentsData.reduce((acc, d) => acc + (d.not_checked_in_count || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header & Date Navigation Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Department Daily Attendance
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              IST Server Timestamps
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Separate attendance tables for Interns, AI/ML Frontend Engineer, and Backend Engineer.
          </p>
        </div>

        {/* Date Selector & Jump Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleYesterday}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            Yesterday
          </button>

          {selectedDate !== todayIstStr && (
            <button
              onClick={handleToday}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
            >
              Today
            </button>
          )}

          <button
            onClick={fetchAttendanceByDepartment}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="Refresh sheet"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium animate-slide-down ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center space-x-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Active Employees</p>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">{totalEmployees}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-emerald-600 uppercase">Working Now</p>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          </div>
          <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{totalWorking}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-sm">
          <p className="text-[11px] font-semibold text-indigo-600 uppercase">Checked Out</p>
          <p className="text-xl font-extrabold text-indigo-600 mt-0.5">{totalCompleted}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-sm">
          <p className="text-[11px] font-semibold text-rose-600 uppercase">Not Checked In</p>
          <p className="text-xl font-extrabold text-rose-600 mt-0.5">{totalNotCheckedIn}</p>
        </div>
      </div>

      {/* Department Tabs & Search Filter */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Department Filter Tabs (Requirement 2 & 6) */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {DEPARTMENTS_LIST.map((tab) => {
            const isActive = activeDeptTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveDeptTab(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search employee name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Dedicated Department Attendance Sections & Tables (Requirement 2, 5 & 6) */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200 shadow-sm">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-blue-500" />
            <p className="text-xs font-semibold">Loading department attendance tables...</p>
          </div>
        ) : visibleDepts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">No departments found.</p>
          </div>
        ) : (
          visibleDepts.map((dept) => (
            <div 
              key={dept.key} 
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Department Header with "+ Add Employee" button */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-xs shadow-sm">
                    {dept.label.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">{dept.label}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        {dept.records?.length || 0} Employees
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-0.5">
                      <span>Working: <strong className="text-emerald-600 font-bold">{dept.working_count}</strong></span>
                      <span>&bull;</span>
                      <span>Checked Out: <strong className="text-indigo-600 font-bold">{dept.completed_count}</strong></span>
                      <span>&bull;</span>
                      <span>Not Checked In: <strong className="text-rose-600 font-bold">{dept.not_checked_in_count}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Requirement 5: Department specific Add Employee Button */}
                <button
                  onClick={() => handleOpenAddEmployee(dept.key)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm shadow-blue-500/20 flex items-center justify-center space-x-1.5 transition-all self-start sm:self-auto"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add Employee</span>
                </button>
              </div>

              {/* Department Attendance Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                      <th className="py-3 px-4">Employee ID & Name</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Time In (IST)</th>
                      <th className="py-3 px-3">Time Out (IST)</th>
                      <th className="py-3 px-3">Total Hours</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Attendance Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dept.records && dept.records.length > 0 ? (
                      dept.records.map((worker) => {
                        const isActionBusy = actionLoadingId === worker.worker_id;

                        return (
                          <tr key={worker.worker_id} className="hover:bg-slate-50/70 transition-colors">
                            {/* Employee ID & Name */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-800 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                                  {worker.full_name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900 leading-tight">{worker.full_name}</p>
                                  <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-500">
                                    <span className="font-mono font-semibold text-blue-600">{worker.worker_code}</span>
                                    {worker.employee_code && (
                                      <>
                                        <span>&bull;</span>
                                        <span>{worker.employee_code}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Date */}
                            <td className="py-3.5 px-3 font-semibold text-slate-700">
                              {selectedDate}
                            </td>

                            {/* Time In */}
                            <td className="py-3.5 px-3 font-mono font-semibold text-slate-800">
                              {worker.time_in_display}
                            </td>

                            {/* Time Out */}
                            <td className="py-3.5 px-3 font-mono text-slate-700">
                              {worker.time_out_display || '-'}
                            </td>

                            {/* Working Hours */}
                            <td className="py-3.5 px-3">
                              {worker.state === 'WORKING' ? (
                                <span className="inline-flex items-center space-x-1.5 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                  <span>In Progress</span>
                                </span>
                              ) : worker.state === 'COMPLETED' ? (
                                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                  {worker.duration_display}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">-</span>
                              )}
                            </td>

                            {/* Attendance Status */}
                            <td className="py-3.5 px-3 text-center">
                              {worker.state === 'WORKING' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  Working
                                </span>
                              ) : worker.state === 'COMPLETED' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                  Completed
                                </span>
                              ) : worker.state === 'LEAVE' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  On Leave
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                  Not Checked In
                                </span>
                              )}
                            </td>

                            {/* Attendance Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                {/* Check In */}
                                {worker.state === 'NOT_CHECKED_IN' && (
                                  <>
                                    <button
                                      onClick={() => handleCheckIn(worker)}
                                      disabled={isActionBusy}
                                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 flex items-center space-x-1 transition-all disabled:opacity-50"
                                      title="Record official arrival in IST"
                                    >
                                      <LogIn className="w-3.5 h-3.5" />
                                      <span>Check In</span>
                                    </button>
                                    <button
                                      onClick={() => handleMarkLeave(worker)}
                                      disabled={isActionBusy}
                                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                                      title="Mark worker on approved leave"
                                    >
                                      <Coffee className="w-4 h-4 text-amber-600" />
                                    </button>
                                  </>
                                )}

                                {/* Check Out */}
                                {worker.state === 'WORKING' && (
                                  <button
                                    onClick={() => handleCheckOut(worker)}
                                    disabled={isActionBusy}
                                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm shadow-blue-600/20 flex items-center space-x-1 transition-all disabled:opacity-50"
                                    title="Record official departure in IST"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>Check Out</span>
                                  </button>
                                )}

                                {/* Edit & Audit Trail for completed/existing record */}
                                {worker.attendance_id && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setCurrentEditRecord(worker);
                                        setEditModalOpen(true);
                                      }}
                                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                                      title="Authorized Manual Correction"
                                    >
                                      <Edit3 className="w-4 h-4 text-slate-700" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCurrentAuditRecord(worker);
                                        setAuditModalOpen(true);
                                      }}
                                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                                      title="View Audit Trail"
                                    >
                                      <History className="w-4 h-4 text-slate-500" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-400">
                          <p className="font-semibold text-slate-600 text-xs">No employees found in this department.</p>
                          <p className="text-[11px] mt-0.5">Click <strong>+ Add Employee</strong> to register staff.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Edit Correction Modal */}
      {editModalOpen && (
        <ManualEditModal
          isOpen={editModalOpen}
          record={currentEditRecord}
          onClose={() => setEditModalOpen(false)}
          onSuccess={(msg) => {
            showNotification('success', msg);
            fetchAttendanceByDepartment();
          }}
        />
      )}

      {/* Audit Trail Modal */}
      {auditModalOpen && (
        <AuditHistoryModal
          isOpen={auditModalOpen}
          attendanceId={currentAuditRecord?.attendance_id}
          workerName={currentAuditRecord?.full_name}
          onClose={() => setAuditModalOpen(false)}
        />
      )}

      {/* Add Employee Modal with Department pre-selected */}
      {addModalOpen && (
        <AddWorkerModal
          isOpen={addModalOpen}
          initialDepartment={addModalDept}
          onClose={() => setAddModalOpen(false)}
          onSuccess={(msg) => {
            showNotification('success', msg);
            fetchAttendanceByDepartment();
          }}
        />
      )}
    </div>
  );
}
