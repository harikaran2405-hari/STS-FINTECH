import React, { useState } from 'react';
import { api } from '../services/api';
import { AlertTriangle, X, ShieldCheck } from 'lucide-react';

export default function DeactivateModal({ isOpen, onClose, worker, onSuccess }) {
  if (!isOpen || !worker) return null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleDeactivate = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const res = await api.deactivateWorker(worker.id);
      if (res.success) {
        onSuccess(res.message);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to deactivate worker.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-5 h-5 text-white" />
            <h3 className="font-bold text-sm">Confirm Worker Deactivation</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-rose-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="text-xs text-slate-600 space-y-2">
            <p>
              Are you sure you want to deactivate <strong className="text-slate-900 font-bold">{worker.full_name}</strong> ({worker.worker_code})?
            </p>
            
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
              <p className="font-bold flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <span>Attendance History Preserved</span>
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Deactivating a worker removes them from future daily attendance check-ins, but <strong>all historical attendance and audit records remain completely intact</strong>. You can reactivate this worker at any time.
              </p>
            </div>
          </div>

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
              type="button"
              onClick={handleDeactivate}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all disabled:opacity-70"
            >
              {isSubmitting ? 'Deactivating...' : 'Confirm Deactivation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
