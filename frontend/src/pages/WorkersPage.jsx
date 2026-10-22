import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import AddWorkerModal from '../components/AddWorkerModal';
import EditWorkerModal from '../components/EditWorkerModal';
import DeactivateModal from '../components/DeactivateModal';
import WorkerProfileModal from '../components/WorkerProfileModal';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Edit2, 
  UserX, 
  UserCheck, 
  Eye, 
  Phone, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Building
} from 'lucide-react';

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      const res = await api.getWorkers({
        search: searchTerm,
        department: selectedDept,
        status: selectedStatus
      });
      if (res.success) {
        setWorkers(res.workers || []);
      }
    } catch (err) {
      showNotification('error', err.message || 'Failed to fetch workers.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.getDepartments();
      if (res.success) {
        setDepartments(res.departments || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [selectedDept, selectedStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWorkers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleReactivate = async (worker) => {
    try {
      const res = await api.reactivateWorker(worker.id);
      if (res.success) {
        showNotification('success', res.message);
        fetchWorkers();
      }
    } catch (err) {
      showNotification('error', err.message || 'Failed to reactivate worker.');
    }
  };

  const totalRegistered = workers.length;
  const activeCount = workers.filter(w => w.employment_status === 'Active').length;
  const inactiveCount = workers.filter(w => w.employment_status === 'Inactive').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Worker Management
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Corporate Registry
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Register workers once when they join. Reused for all future daily attendance.
          </p>
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 flex items-center justify-center space-x-2 transition-all transform active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Worker</span>
        </button>
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
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Status Tabs */}
        <div className="flex items-center space-x-1">
          {[
            { id: 'all', label: 'All Workers', count: totalRegistered },
            { id: 'Active', label: 'Active', count: activeCount },
            { id: 'Inactive', label: 'Inactive', count: inactiveCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedStatus === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Department and Search */}
        <div className="flex items-center flex-wrap sm:flex-nowrap gap-2.5">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full sm:w-44 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Departments</option>
            <option value="interns">Interns</option>
            <option value="ai_ml_frontend">AI/ML, Frontend Engineer</option>
            <option value="backend">Backend Engineer</option>
          </select>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name, code, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={fetchWorkers}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="Refresh workers"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Workers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3.5 px-4">Worker ID & Name</th>
                <th className="py-3.5 px-3">Employee Code</th>
                <th className="py-3.5 px-3">Department</th>
                <th className="py-3.5 px-3">Phone</th>
                <th className="py-3.5 px-3">Joining Date</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-blue-500" />
                    <span>Loading workforce records...</span>
                  </td>
                </tr>
              ) : workers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600 text-sm">No workers match the filters</p>
                    <p className="text-xs mt-1">Click "Add New Worker" to register a new employee.</p>
                  </td>
                </tr>
              ) : (
                workers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Worker ID & Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm ${
                          worker.employment_status === 'Active'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-slate-200 text-slate-600 border border-slate-300'
                        }`}>
                          {worker.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{worker.full_name}</p>
                          <span className="font-mono text-[11px] font-semibold text-blue-600">
                            {worker.worker_code}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Employee Code */}
                    <td className="py-3.5 px-3 font-mono font-medium text-slate-700">
                      {worker.employee_code || <span className="text-slate-400 italic">None</span>}
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium">
                        {worker.department_label || worker.department}
                      </span>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-3 font-mono text-slate-600">
                      {worker.phone || '-'}
                    </td>

                    {/* Joining Date */}
                    <td className="py-3.5 px-3 text-slate-600 font-medium">
                      {worker.joining_date}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        worker.employment_status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-200 text-slate-700 border border-slate-300'
                      }`}>
                        {worker.employment_status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Profile & History */}
                        <button
                          onClick={() => {
                            setSelectedWorker(worker);
                            setProfileModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          title="View Attendance History"
                        >
                          <Eye className="w-4 h-4 text-slate-700" />
                        </button>

                        {/* Edit details */}
                        <button
                          onClick={() => {
                            setSelectedWorker(worker);
                            setEditModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          title="Edit Worker Details"
                        >
                          <Edit2 className="w-4 h-4 text-slate-700" />
                        </button>

                        {/* Deactivate or Reactivate */}
                        {worker.employment_status === 'Active' ? (
                          <button
                            onClick={() => {
                              setSelectedWorker(worker);
                              setDeactivateModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 transition-colors"
                            title="Deactivate Worker"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(worker)}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 transition-colors"
                            title="Reactivate Worker"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200/80 text-slate-500 text-[11px] flex items-center justify-between">
          <span>Total Registered Workforce: <strong className="text-slate-700">{workers.length}</strong></span>
          <span className="text-slate-400">All registered workers are preserved in database</span>
        </div>
      </div>

      {/* Modals */}
      {addModalOpen && (
        <AddWorkerModal
          isOpen={addModalOpen}
          departments={departments}
          onClose={() => setAddModalOpen(false)}
          onSuccess={(msg) => {
            showNotification('success', msg);
            fetchWorkers();
            fetchDepartments();
          }}
        />
      )}

      {editModalOpen && (
        <EditWorkerModal
          isOpen={editModalOpen}
          worker={selectedWorker}
          departments={departments}
          onClose={() => setEditModalOpen(false)}
          onSuccess={(msg) => {
            showNotification('success', msg);
            fetchWorkers();
          }}
        />
      )}

      {deactivateModalOpen && (
        <DeactivateModal
          isOpen={deactivateModalOpen}
          worker={selectedWorker}
          onClose={() => setDeactivateModalOpen(false)}
          onSuccess={(msg) => {
            showNotification('success', msg);
            fetchWorkers();
          }}
        />
      )}

      {profileModalOpen && (
        <WorkerProfileModal
          isOpen={profileModalOpen}
          workerId={selectedWorker?.id}
          onClose={() => setProfileModalOpen(false)}
        />
      )}
    </div>
  );
}
