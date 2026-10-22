import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  LayoutDashboard, 
  Clock, 
  Users, 
  FileBarChart, 
  ShieldAlert, 
  LogOut, 
  User, 
  Calendar,
  ChevronDown
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { manager, logout, formattedTimeDisplay, formattedDateDisplay } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'Daily Attendance', icon: Clock },
    { id: 'workers', label: 'Worker Management', icon: Users },
    { id: 'reports', label: 'Reports & Analytics', icon: FileBarChart },
    { id: 'audit', label: 'Audit Trail', icon: ShieldAlert },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">STS Fintech</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded">
                  Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Company Attendance Management</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Side: Authoritative IST Clock & Manager Profile */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Live IST Clock */}
            <div className="hidden lg:flex flex-col items-end px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow" title="Server Synced"></span>
                <span className="text-xs font-mono font-bold text-emerald-400">{formattedTimeDisplay}</span>
                <span className="text-[10px] bg-slate-700 text-slate-300 px-1 py-0.2 rounded font-medium">IST</span>
              </div>
              <span className="text-[11px] text-slate-400">{formattedDateDisplay}</span>
            </div>

            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center space-x-2.5 p-1.5 rounded-lg hover:bg-slate-800 transition-colors focus:outline-none"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 font-semibold text-sm">
                  {manager?.name ? manager.name.charAt(0).toUpperCase() : 'M'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-white leading-tight">{manager?.name || 'Manager'}</p>
                  <p className="text-[11px] text-slate-400 leading-tight">Company Manager</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div 
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-800 border border-slate-700 shadow-xl py-1 text-sm z-50"
                  onMouseLeave={() => setProfileDropdownOpen(false)}
                >
                  <div className="px-4 py-2.5 border-b border-slate-700/80">
                    <p className="text-xs text-slate-400">Signed in as</p>
                    <p className="font-semibold text-white truncate">{manager?.name}</p>
                    <p className="text-xs text-slate-400 truncate">{manager?.email}</p>
                  </div>
                  
                  <div className="px-2 py-1 lg:hidden border-b border-slate-700/80">
                    <div className="px-2 py-1 text-xs text-slate-400 flex items-center justify-between">
                      <span>Server Time (IST):</span>
                      <span className="font-mono text-emerald-400">{formattedTimeDisplay}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden flex overflow-x-auto border-t border-slate-800 px-2 py-1.5 space-x-1 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
