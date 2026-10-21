/*
 * /staff — the short link to give employees ("datalifeaccount.com/staff").
 * Signed in → straight to the right place (employee portal / dashboard);
 * not signed in → the login page in "employee" mode. It is also the
 * start_url of the installed app, so the home-screen icon opens the portal.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function homeForRole(role) {
  if (role === 'Super Admin' || role === 'مدير النظام') return '/admin';
  if (role === 'Employee' || role === 'موظف') return '/my-portal';
  return '/dashboard';
}

export default function StaffEntry() {
  const navigate = useNavigate();
  useEffect(() => {
    let token = null, role = '';
    try {
      token = localStorage.getItem('token');
      role = (JSON.parse(localStorage.getItem('user') || '{}') || {}).role || '';
    } catch (_) { /* storage blocked */ }
    navigate(token ? homeForRole(role) : '/login?staff=1', { replace: true });
  }, [navigate]);
  return null;
}
