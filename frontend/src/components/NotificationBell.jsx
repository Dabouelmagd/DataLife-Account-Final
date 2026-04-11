import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Bell, Check, CheckCheck, X, ExternalLink } from 'lucide-react';
import { Badge } from './ui/badge';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

const NotificationBell = () => {
  const { token } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const dropdownRef = useRef(null);

  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/api/push/notifications?limit=15`, config);
      setNotifications(res.data.notifications || []);
      setUnread(res.data.unread || 0);
    } catch (e) {
      // silent
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
          reg.pushManager.getSubscription().then(sub => {
            setPushEnabled(!!sub);
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const subscribePush = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw-push.js');
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const keys = {
        p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
        auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
      };

      await axios.post(`${API_URL}/api/push/subscribe`, {
        endpoint: subscription.endpoint,
        keys
      }, config);

      setPushEnabled(true);

      await axios.post(`${API_URL}/api/push/send-test`, {}, config);
    } catch (e) {
      console.error('Push subscription error:', e);
    }
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API_URL}/api/push/notifications/read`, {}, config);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch (e) {
      // silent
    }
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return isRTL ? 'الآن' : 'now';
    if (diff < 3600) return isRTL ? `${Math.floor(diff / 60)} د` : `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return isRTL ? `${Math.floor(diff / 3600)} س` : `${Math.floor(diff / 3600)}h`;
    return isRTL ? `${Math.floor(diff / 86400)} ي` : `${Math.floor(diff / 86400)}d`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="relative p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        data-testid="notification-bell"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-full mt-2 ${isRTL ? 'right-0' : 'left-0'} w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 overflow-hidden`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
            <h3 className="font-bold text-sm text-gray-800 dark:text-white">
              {isRTL ? 'الإشعارات' : 'Notifications'}
            </h3>
            <div className="flex gap-1">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50">
                  <CheckCheck className="h-3 w-3" />
                  {isRTL ? 'قراءة الكل' : 'Read all'}
                </button>
              )}
              {pushSupported && !pushEnabled && (
                <button onClick={subscribePush} className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-green-50">
                  <Bell className="h-3 w-3" />
                  {isRTL ? 'تفعيل' : 'Enable'}
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{isRTL ? 'لا توجد إشعارات' : 'No notifications'}</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${!n.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {pushSupported && (
            <div className="p-2 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <div className={`w-2 h-2 rounded-full ${pushEnabled ? 'bg-green-400' : 'bg-gray-300'}`} />
                {pushEnabled 
                  ? (isRTL ? 'إشعارات Push مفعّلة' : 'Push enabled')
                  : (isRTL ? 'إشعارات Push غير مفعّلة' : 'Push disabled')
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
