import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, ShieldAlert, Clock, User, FileText, ArrowRight } from 'lucide-react';

export default function AuditHistoryModal({ isOpen, onClose, attendanceId, workerName }) {
  if (!isOpen) return null;

  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      setIsLoading(true);
      try {
        const res = await api.getAuditLogs({ attendance_id: attendanceId });
        if (res.success) {
          setLogs(res.logs || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    if (attendanceId) {
      loadLogs();
    }
  }, [attendanceId]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Record Audit Trail</h3>
              <p className="text-[11px] text-slate-400">Historical modification log for {workerName || 'Worker'}</p>
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
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading audit history...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No manual corrections recorded for this attendance entry. Official automated check-in/out timestamps are intact.
            </div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id} 
                className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
                      {log.action}
                    </span>
                    <span className="text-slate-500">by</span>
                    <span className="font-semibold text-slate-900">{log.manager_name}</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200/60">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Manager Justification:
                  </p>
                  <p className="text-slate-800 italic">"{log.reason}"</p>
                </div>

                {log.old_values && log.new_values && (
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 rounded bg-red-50 border border-red-100 text-red-800">
                      <p className="font-bold text-red-600 mb-0.5">Previous Values</p>
                      <p>In: {log.old_values.time_in ? new Date(log.old_values.time_in).toLocaleTimeString('en-IN') : '-'}</p>
                      <p>Out: {log.old_values.time_out ? new Date(log.old_values.time_out).toLocaleTimeString('en-IN') : '-'}</p>
                      <p>Status: {log.old_values.status || '-'}</p>
                    </div>
                    <div className="p-2 rounded bg-emerald-50 border border-emerald-100 text-emerald-800">
                      <p className="font-bold text-emerald-600 mb-0.5">Updated Values</p>
                      <p>In: {log.new_values.time_in ? new Date(log.new_values.time_in).toLocaleTimeString('en-IN') : '-'}</p>
                      <p>Out: {log.new_values.time_out ? new Date(log.new_values.time_out).toLocaleTimeString('en-IN') : '-'}</p>
                      <p>Status: {log.new_values.status || '-'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
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
