import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, User, Phone, Calendar, Building, Clock, CheckCircle2, History } from 'lucide-react';

export default function WorkerProfileModal({ isOpen, onClose, workerId }) {
  if (!isOpen || !workerId) return null;

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDetail() {
      setIsLoading(true);
      try {
        const res = await api.getWorker(workerId);
        if (res.success) {
          setData(res);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDetail();
  }, [workerId]);

  const worker = data?.worker;
  const stats = data?.stats || {};
  const recent = data?.recent_attendance || [];

  const formatHours = (minutes) => {
    if (!minutes) return '0h';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-base shadow-md">
              {worker?.full_name ? worker.full_name.charAt(0) : 'W'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-white">{worker?.full_name || 'Worker Profile'}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  worker?.employment_status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {worker?.employment_status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {worker?.worker_code} {worker?.employee_code && `&bull; ${worker.employee_code}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading worker profile...</div>
          ) : (
            <>
              {/* Meta details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[11px]">Department:</span>
                  <span className="font-bold text-slate-900">{worker?.department}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Phone:</span>
                  <span className="font-semibold text-slate-900">{worker?.phone || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Joining Date:</span>
                  <span className="font-semibold text-slate-900">{worker?.joining_date}</span>
                </div>
              </div>

              {/* Lifetime Attendance Statistics */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Historical Attendance Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-center">
                    <p className="text-[11px] text-blue-700 font-semibold">Total Days</p>
                    <p className="text-xl font-extrabold text-blue-900 mt-1">{stats.total_days_recorded || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                    <p className="text-[11px] text-emerald-700 font-semibold">Present Days</p>
                    <p className="text-xl font-extrabold text-emerald-900 mt-1">{stats.present_days || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-center">
                    <p className="text-[11px] text-amber-700 font-semibold">Leave Days</p>
                    <p className="text-xl font-extrabold text-amber-900 mt-1">{stats.leave_days || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-center">
                    <p className="text-[11px] text-indigo-700 font-semibold">Hours Logged</p>
                    <p className="text-xl font-extrabold text-indigo-900 mt-1">{formatHours(stats.total_minutes_worked)}</p>
                  </div>
                </div>
              </div>

              {/* Recent 10 Attendance Records */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                  <span>Recent Attendance Log</span>
                  <span className="text-[11px] text-slate-400">Past 10 records</span>
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                  {recent.length === 0 ? (
                    <p className="p-4 text-center text-slate-400">No attendance entries recorded yet.</p>
                  ) : (
                    recent.map((rec) => (
                      <div key={rec.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <span className="font-bold text-slate-800">{rec.attendance_date}</span>
                          <span className="ml-2 text-slate-500 font-mono text-[11px]">
                            {rec.time_in ? new Date(rec.time_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                            {' - '}
                            {rec.time_out ? new Date(rec.time_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : (rec.time_in ? 'In Progress' : '-')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-slate-600 font-medium">
                            {formatHours(rec.total_working_minutes)}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
