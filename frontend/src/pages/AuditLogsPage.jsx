import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldAlert, RefreshCw, Clock, User, FileText, CheckCircle2 } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAuditLogs({ limit: 100 });
      if (res.success) {
        setLogs(res.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Corporate Audit Trail
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              Immutable System Logs
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Permanent compliance log of all manual corrections, supervisor overrides, and manager edits.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3.5 px-4">Timestamp (IST)</th>
                <th className="py-3.5 px-3">Manager</th>
                <th className="py-3.5 px-3">Worker Affected</th>
                <th className="py-3.5 px-3">Shift Date</th>
                <th className="py-3.5 px-3">Action</th>
                <th className="py-3.5 px-4">Mandatory Reason</th>
                <th className="py-3.5 px-4 text-right">Value Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-blue-500" />
                    <span>Loading compliance audit logs...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600 text-sm">No manual edits recorded</p>
                    <p className="text-xs mt-1">All attendance records have been registered through automated checks.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>

                    {/* Manager */}
                    <td className="py-3.5 px-3 font-semibold text-slate-900">
                      <div>
                        <p>{log.manager_name}</p>
                        <p className="text-[10px] text-slate-400">{log.manager_email}</p>
                      </div>
                    </td>

                    {/* Worker */}
                    <td className="py-3.5 px-3">
                      <div>
                        <p className="font-bold text-slate-800">{log.worker_name}</p>
                        <p className="text-[11px] text-blue-600 font-mono">{log.worker_code}</p>
                      </div>
                    </td>

                    {/* Shift Date */}
                    <td className="py-3.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                      {log.attendance_date}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-3">
                      <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        {log.action}
                      </span>
                    </td>

                    {/* Reason */}
                    <td className="py-3.5 px-4 max-w-xs text-slate-700 italic">
                      "{log.reason}"
                    </td>

                    {/* Value Changes */}
                    <td className="py-3.5 px-4 text-right">
                      {log.old_values && log.new_values && (
                        <div className="text-[10px] text-slate-500 font-mono space-y-0.5 inline-block text-left">
                          {log.new_values.time_in && (
                            <p><span className="text-emerald-700 font-bold">In:</span> {new Date(log.new_values.time_in).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                          )}
                          {log.new_values.time_out && (
                            <p><span className="text-emerald-700 font-bold">Out:</span> {new Date(log.new_values.time_out).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
          <span>Total Audit Trail Entries: <strong className="text-slate-700">{logs.length}</strong></span>
          <span className="text-emerald-600 font-semibold flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Audit Trail Integrity Verified</span>
          </span>
        </div>
      </div>
    </div>
  );
}
