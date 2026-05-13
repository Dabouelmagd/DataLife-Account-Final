import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const PlanContext = createContext(null);

const ALL_MODULES = [
  'dashboard', 'hr', 'financial', 'reports', 'settings',
  'inventory', 'invoices', 'purchases', 'analytics', 'projects',
  'approvals', 'users', 'import',
];

export const PlanProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [plan, setPlan] = useState('trial');
  const [planLabelAr, setPlanLabelAr] = useState('تجربة مجانية');
  const [planLabelEn, setPlanLabelEn] = useState('Free Trial');
  const [allowedModules, setAllowedModules] = useState(ALL_MODULES);
  const [trial, setTrial] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPlanModules = useCallback(async () => {
    if (!user?.company_id || !token) {
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/companies/${user.company_id}/plan-modules`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPlan(res.data.plan || 'trial');
      setPlanLabelAr(res.data.plan_label_ar || 'تجربة مجانية');
      setPlanLabelEn(res.data.plan_label_en || 'Free Trial');
      setAllowedModules(res.data.allowed_modules || ALL_MODULES);
      setTrial(res.data.trial || null);
    } catch (err) {
      // Default to trial (full access) on error
      setPlan('trial');
      setAllowedModules(ALL_MODULES);
      setTrial(null);
    } finally {
      setLoading(false);
    }
  }, [user, token]);

  useEffect(() => {
    fetchPlanModules();
  }, [fetchPlanModules]);

  const isUnlocked = (moduleId) => allowedModules.includes(moduleId);

  return (
    <PlanContext.Provider
      value={{
        plan,
        planLabelAr,
        planLabelEn,
        allowedModules,
        trial,
        isUnlocked,
        loading,
        refresh: fetchPlanModules,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
};

export const usePlan = () => {
  const ctx = useContext(PlanContext);
  if (!ctx) {
    // Safe fallback so the app doesn't crash if used outside the provider
    return {
      plan: 'trial',
      planLabelAr: 'تجربة مجانية',
      planLabelEn: 'Free Trial',
      allowedModules: ALL_MODULES,
      trial: null,
      isUnlocked: () => true,
      loading: false,
      refresh: () => {},
    };
  }
  return ctx;
};
