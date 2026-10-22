import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [manager, setManager] = useState(() => {
    try {
      const saved = localStorage.getItem('manager');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [isLoading, setIsLoading] = useState(true);

  // Authoritative live IST clock
  const [istTime, setIstTime] = useState(() => new Date());
  const [todayIstStr, setTodayIstStr] = useState('');

  // Initial token verification
  useEffect(() => {
    async function verifyAuth() {
      if (token) {
        try {
          const res = await api.getMe();
          if (res.success && res.manager) {
            setManager(res.manager);
            localStorage.setItem('manager', JSON.stringify(res.manager));
          }
        } catch {
          logout();
        }
      }
      setIsLoading(false);
    }
    verifyAuth();

    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [token]);

  // Sync IST clock with server time periodically, and tick every 1000ms
  useEffect(() => {
    let timer;
    async function syncServerTime() {
      try {
        const timeRes = await api.getServerTime();
        if (timeRes && timeRes.iso) {
          const serverDate = new Date(timeRes.iso);
          setIstTime(serverDate);
          setTodayIstStr(timeRes.date);
        }
      } catch {
        // Fallback to local time converted to IST offset (+5:30)
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const ist = new Date(utc + (3600000 * 5.5));
        setIstTime(ist);
        setTodayIstStr(ist.toISOString().split('T')[0]);
      }
    }

    syncServerTime();
    const syncInterval = setInterval(syncServerTime, 60000); // Re-sync every minute

    timer = setInterval(() => {
      setIstTime(prev => new Date(prev.getTime() + 1000));
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(syncInterval);
    };
  }, []);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    if (res.success && res.token) {
      setToken(res.token);
      setManager(res.manager);
      localStorage.setItem('token', res.token);
      localStorage.setItem('manager', JSON.stringify(res.manager));
      return res;
    }
    throw new Error(res.message || 'Login failed');
  };

  const logout = () => {
    setToken(null);
    setManager(null);
    localStorage.removeItem('token');
    localStorage.removeItem('manager');
  };

  const formattedTimeDisplay = istTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });

  const formattedDateDisplay = istTime.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });

  return (
    <AuthContext.Provider value={{
      manager,
      token,
      isAuthenticated: !!token && !!manager,
      isLoading,
      login,
      logout,
      istTime,
      todayIstStr: todayIstStr || new Date().toISOString().split('T')[0],
      formattedTimeDisplay,
      formattedDateDisplay
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
