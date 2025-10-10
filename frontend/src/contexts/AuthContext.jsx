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

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

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
