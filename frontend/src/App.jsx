import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DailyAttendancePage from './pages/DailyAttendancePage';
import WorkersPage from './pages/WorkersPage';
import ReportsPage from './pages/ReportsPage';
import AuditLogsPage from './pages/AuditLogsPage';

function MainApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [targetAttendanceDate, setTargetAttendanceDate] = useState(null);
  const [targetDepartment, setTargetDepartment] = useState('all');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Loading STS Fintech Attendance System...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleSelectDepartmentFromDashboard = (deptKey, date) => {
    setTargetDepartment(deptKey || 'all');
    if (date) setTargetAttendanceDate(date);
    setActiveTab('attendance');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && (
          <DashboardPage 
            setActiveTab={setActiveTab} 
            onSelectDepartment={handleSelectDepartmentFromDashboard} 
          />
        )}
        {activeTab === 'attendance' && (
          <DailyAttendancePage 
            initialDate={targetAttendanceDate} 
            initialDepartment={targetDepartment}
          />
        )}
        {activeTab === 'workers' && <WorkersPage />}
        {activeTab === 'reports' && <ReportsPage />}
        {activeTab === 'audit' && <AuditLogsPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
