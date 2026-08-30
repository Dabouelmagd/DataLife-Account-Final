import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API_URL}/api/auth/verify`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          setUser(response.data);
        } catch (error) {
          console.error('Token verification failed:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, [token, API_URL]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password
      });

      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      
      return { success: true, user: userData };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  const registerCompany = async (companyData, userData) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/register-company`,
        companyData,
        {
          params: {
            user_email: userData.email,
            user_password: userData.password,
            user_full_name: userData.full_name
          }
        }
      );

      const { access_token, user: userResponse } = response.data;
      setToken(access_token);
      setUser(userResponse);
      localStorage.setItem('token', access_token);
      
      return { success: true, user: userResponse };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Registration failed' 
      };
    }
  };

  // ── Session Security ─────────────────────────────────
  const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  const idleTimerRef = React.useRef(null);

  const resetIdleTimer = React.useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (localStorage.getItem('token')) {
        // Token still in storage = still "logged in" → force logout
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login?reason=idle';
      }
    }, IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!user) return;
    const events = ['mousedown','mousemove','keypress','touchstart','scroll','click'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer(); // start timer on login
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [user, resetIdleTimer]);

  // ── Check JWT expiry on tab focus ────────────────────
  useEffect(() => {
    const checkExpiry = () => {
      const t = localStorage.getItem('token');
      if (!t) return;
      try {
        const payload = JSON.parse(atob(t.split('.')[1]));
        if (payload.exp && Date.now() / 1000 > payload.exp) {
          logout();
          window.location.href = '/login?reason=expired';
        }
      } catch {}
    };
    window.addEventListener('focus', checkExpiry);
    return () => window.removeEventListener('focus', checkExpiry);
  }, []);

  const logout = React.useCallback(() => {
    // Call backend to revoke token
    const t = localStorage.getItem('token');
    if (t) {
      fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` }
      }).catch(() => {});
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, [API_URL]);

  const hasModule = (moduleName) => {
    if (!user) return false;
    
    const roleModules = {
      'General Manager': ['dashboard', 'hr', 'financial', 'inventory', 'reports', 'analytics'],
      'HR Manager': ['dashboard', 'hr', 'reports'],
      'Financial Manager': ['dashboard', 'financial', 'reports', 'analytics'],
      'Accountant': ['dashboard', 'financial', 'reports']
    };
    
    return roleModules[user.role]?.includes(moduleName) || false;
  };

  const value = {
    user,
    token,
    loading,
    login,
    registerCompany,
    logout,
    hasModule,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
