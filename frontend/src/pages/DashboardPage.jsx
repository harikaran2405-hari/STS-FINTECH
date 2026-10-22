import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import AddWorkerModal from '../components/AddWorkerModal';
import { 
  Users, 
  UserCheck, 
  Clock, 
  LogOut, 
  UserX, 
  TrendingUp, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Building,
  RefreshCw,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Briefcase
} from 'lucide-react';

export default function DashboardPage({ setActiveTab, onSelectDepartment }) {
  const { todayIstStr, manager } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayIstStr);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Expandable department cards state
  const [expandedDepts, setExpandedDepts] = useState({
    'interns': true,
    'ai_ml_frontend': true,
    'backend': true
  });

  // Add Employee Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDept, setAddModalDept] = useState('interns');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchSummary = async (date) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.getDashboardSummary(date);
      if (res.success) {
        setSummary(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (todayIstStr) {
      setSelectedDate(todayIstStr);
      fetchSummary(todayIstStr);
    }
  }, [todayIstStr]);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    fetchSummary(newDate);
  };

  const handleQuickToday = () => {
    setSelectedDate(todayIstStr);
    fetchSummary(todayIstStr);
  };

  const toggleExpand = (deptKey) => {
    setExpandedDepts(prev => ({
      ...prev,
      [deptKey]: !prev[deptKey]
    }));
  };

  const handleOpenAddEmployee = (deptKey) => {
    setAddModalDept(deptKey);
    setAddModalOpen(true);
  };

  const handleViewDepartmentAttendance = (deptKey) => {
    if (onSelectDepartment) {
      onSelectDepartment(deptKey, selectedDate);
    } else {
      setActiveTab('attendance');
    }
  };

  const kpis = summary?.kpis || {
    total_active_workers: 0,
    checked_in_today: 0,
    checked_out_today: 0,
    currently_working: 0,
    not_checked_in: 0,
    attendance_rate: 0,
    total_working_hours_display: '0h'
  };

  const cards = [
    {
      title: 'Total Active Employees',
      value: kpis.total_active_workers,
      subtext: 'Across 3 corporate departments',
      icon: Users,
      color: 'blue',
      borderColor: 'border-blue-500/20',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-600',
    },
    {
      title: 'Checked In Today',
      value: kpis.checked_in_today,
      subtext: `${kpis.attendance_rate}% workforce attendance`,
      icon: UserCheck,
      color: 'emerald',
      borderColor: 'border-emerald-500/20',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-emerald-600',
    },
    {
      title: 'Currently Working',
      value: kpis.currently_working,
      subtext: 'Active shift in progress',
      icon: Clock,
      color: 'amber',
      borderColor: 'border-amber-500/20',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-600',
      badge: 'Live',
      pulse: true
    },
    {
      title: 'Checked Out Today',
      value: kpis.checked_out_today,
      subtext: 'Completed working shifts',
      icon: LogOut,
      color: 'indigo',
      borderColor: 'border-indigo-500/20',
      bgColor: 'bg-indigo-500/10',
      textColor: 'text-indigo-600',
    },
    {
      title: 'Not Checked In',
      value: kpis.not_checked_in,
      subtext: 'Pending arrival / Absent',
      icon: UserX,
      color: 'rose',
      borderColor: 'border-rose-500/20',
      bgColor: 'bg-rose-500/10',
      textColor: 'text-rose-600',
    },
    {
      title: 'Attendance Rate',
      value: `${kpis.attendance_rate}%`,
      subtext: `Total hours: ${kpis.total_working_hours_display}`,
      icon: TrendingUp,
      color: 'violet',
      borderColor: 'border-violet-500/20',
      bgColor: 'bg-violet-500/10',
      textColor: 'text-violet-600',
    },
  ];

  const departments = summary?.departments || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner with Mahesh Kumar Welcome (Requirement 1) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Good day, Mahesh Kumar
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              Company Manager
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Department-based workforce operations & daily attendance monitoring for {selectedDate}.
          </p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer"
            />
          </div>

          {selectedDate !== todayIstStr && (
            <button
              onClick={handleQuickToday}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
            >
              Back to Today
            </button>
          )}

          <button
            onClick={() => fetchSummary(selectedDate)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between animate-slide-down">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">&times;</button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center space-x-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`bg-white rounded-2xl p-5 border ${card.borderColor} shadow-sm hover:shadow-md transition-shadow relative overflow-hidden`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {card.title}
                  </p>
                  <div className="mt-2 flex items-baseline space-x-2">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                      {card.value}
                    </span>
                    {card.badge && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 animate-ping"></span>
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">{card.subtext}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${card.bgColor} flex items-center justify-center ${card.textColor}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Three Clear Department Sections (Requirement 2 & 8) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <Building className="w-5 h-5 text-blue-600" />
              <span>Department Workforce & Daily Attendance</span>
            </h2>
            <p className="text-xs text-slate-500">
              Organized into three corporate groups: Interns, AI/ML, Frontend Engineer, and Backend Engineer
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {departments.map((dept) => {
            const isExpanded = !!expandedDepts[dept.key];

            return (
              <div 
                key={dept.key}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Department Header Card */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200/70">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Title & Badge */}
                    <div className="flex items-center space-x-3.5">
                      <div className="w-11 h-11 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center shadow-md shadow-blue-500/20 text-sm">
                        {dept.label.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2.5">
                          <h3 className="text-base font-extrabold text-slate-900">{dept.label}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            {dept.total_workers} Employees
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Active team members &bull; Attendance rate: <strong className="text-slate-800 font-bold">{dept.attendance_rate}%</strong>
                        </p>
                      </div>
                    </div>

                    {/* Department Metrics Strip */}
                    <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-xs">
                      <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Checked In</span>
                        <span className="font-extrabold text-emerald-600 text-sm">{dept.checked_in_today}</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-slate-700 shadow-2xs">
                        <span className="text-[10px] text-amber-600 uppercase font-semibold block">Working</span>
                        <span className="font-extrabold text-amber-600 text-sm">{dept.currently_working}</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Checked Out</span>
                        <span className="font-extrabold text-indigo-600 text-sm">{dept.checked_out_today}</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Not In</span>
                        <span className="font-extrabold text-rose-600 text-sm">{dept.not_checked_in}</span>
                      </div>
                    </div>

                    {/* Department Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenAddEmployee(dept.key)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm shadow-blue-500/20 flex items-center space-x-1.5 transition-all"
                        title={`Add employee directly to ${dept.label}`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Add Employee</span>
                      </button>

                      <button
                        onClick={() => handleViewDepartmentAttendance(dept.key)}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center space-x-1"
                        title="Open full attendance sheet for this department"
                      >
                        <span>View Attendance</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => toggleExpand(dept.key)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                  </div>
                </div>

                {/* Expandable Table Area (Requirement 8) */}
                {isExpanded && (
                  <div className="overflow-x-auto p-4 sm:p-5">
                    {dept.workers && dept.workers.length > 0 ? (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                            <th className="py-2.5 px-3">Employee</th>
                            <th className="py-2.5 px-3">Time In (IST)</th>
                            <th className="py-2.5 px-3">Time Out (IST)</th>
                            <th className="py-2.5 px-3">Duration</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-right">Quick Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dept.workers.map((emp) => (
                            <tr key={emp.worker_id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-3">
                                <div className="flex items-center space-x-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                                    {emp.full_name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900">{emp.full_name}</p>
                                    <span className="font-mono text-[10px] text-blue-600">{emp.worker_code}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 font-mono text-slate-800">
                                {emp.time_in_display}
                              </td>

                              <td className="py-2.5 px-3 font-mono text-slate-700">
                                {emp.time_out_display || '-'}
                              </td>

                              <td className="py-2.5 px-3">
                                {emp.state === 'WORKING' ? (
                                  <span className="inline-flex items-center space-x-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span>In Progress</span>
                                  </span>
                                ) : (
                                  <span className="font-mono text-slate-700">{emp.duration_display}</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                {emp.state === 'WORKING' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Working
                                  </span>
                                ) : emp.state === 'COMPLETED' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                    Completed
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                    Not Checked In
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => handleViewDepartmentAttendance(dept.key)}
                                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  Manage &rarr;
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No employees currently in this department. Click <strong>+ Add Employee</strong> to add one.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Employee Modal */}
      {addModalOpen && (
        <AddWorkerModal
          isOpen={addModalOpen}
          initialDepartment={addModalDept}
          onClose={() => setAddModalOpen(false)}
          onSuccess={(msg) => {
            setSuccessMsg(msg);
            fetchSummary(selectedDate);
            setTimeout(() => setSuccessMsg(''), 5000);
          }}
        />
      )}
    </div>
  );
}
