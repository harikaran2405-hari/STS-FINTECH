import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  X, 
  ShieldAlert, 
  Clock, 
  Save, 
  AlertCircle,
  FileText,
  UserCheck
} from 'lucide-react';

export default function ManualEditModal({ isOpen, onClose, record, onSuccess }) {
  if (!isOpen || !record) return null;

  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [status, setStatus] = useState('PRESENT');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      // Format ISO string to datetime-local input format: YYYY-MM-DDTHH:MM
      const formatForInput = (isoStr) => {
        if (!isoStr) return '';
        try {
          const d = new Date(isoStr);
          // Format in local timezone or IST
          const pad = (n) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch {
          return '';
        }
      };

      setTimeIn(formatForInput(record.time_in) || `${record.attendance_date}T09:00`);
      setTimeOut(formatForInput(record.time_out));
      setStatus(record.attendance_status || 'PRESENT');
      setReason('');
      setError('');
    }
  }, [record]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) {
      setError('A justification / reason is strictly mandatory for corporate audit compliance.');
      return;
    }

    if (!timeIn) {
      setError('Time In timestamp is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Append timezone offset (+05:30) for IST if not present
      const toIstIso = (val) => {
        if (!val) return null;
        if (val.includes('+')) return val;
        return `${val}:00+05:30`;
      };

      const payload = {
        attendance_id: record.attendance_id,
        time_in: toIstIso(timeIn),
        time_out: timeOut ? toIstIso(timeOut) : null,
        status: status,
        reason: reason.trim()
      };

      const res = await api.manualEdit(payload);
      if (res.success) {
        onSuccess(res.message);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to update attendance record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Authorized Attendance Correction</h3>
              <p className="text-[11px] text-slate-400">Manager override with compliance audit log</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Worker Summary Banner */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200/80 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-slate-800">{record.full_name}</span>
            <span className="text-slate-500 ml-2">({record.worker_code} &bull; {record.department})</span>
          </div>
          <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            {record.attendance_date}
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Time In (IST) <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={timeIn}
                onChange={(e) => setTimeIn(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400">Official IST arrival timestamp</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Time Out (IST) <span className="text-slate-400">(Optional)</span>
              </label>
              <input
                type="datetime-local"
                value={timeOut}
                onChange={(e) => setTimeOut(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400">Leave blank if worker still active</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Attendance Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="PRESENT">PRESENT - Full Shift</option>
              <option value="HALF_DAY">HALF_DAY - Half Day Approved</option>
              <option value="LEAVE">LEAVE - Excused Absence</option>
              <option value="OVERTIME">OVERTIME - Extended Shift</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Audit Reason / Correction Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Corrected entry: Worker arrived at 08:45 AM per security gate register, biometric sensor was rebooting."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
            <p className="text-[11px] text-slate-500 mt-1">
              <span className="font-semibold text-amber-700">Audit Compliance:</span> This reason and your manager identity will be permanently recorded in the system audit trail.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center space-x-1.5 transition-all disabled:opacity-70"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving Correction...' : 'Commit Audit Correction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
