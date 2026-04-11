import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Bell, X, Check, CheckCheck, Trash2, AlertCircle, 
  CheckCircle, XCircle, Package, DollarSign, Calendar,
  UserPlus, FileText, Settings, BellRing
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

const NotificationCenter = () => {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const dropdownRef = useRef(null);

  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

  const t = {
    notifications: isRTL ? 'الإشعارات' : 'Notifications',
    markAllRead: isRTL ? 'تعليم الكل كمقروء' : 'Mark all as read',
    clearAll: isRTL ? 'مسح الكل' : 'Clear all',
    noNotifications: isRTL ? 'لا توجد إشعارات' : 'No notifications',
    justNow: isRTL ? 'الآن' : 'Just now',
    minutesAgo: isRTL ? 'دقائق مضت' : 'minutes ago',
    hoursAgo: isRTL ? 'ساعات مضت' : 'hours ago',
    daysAgo: isRTL ? 'أيام مضت' : 'days ago'
  };

  const iconMap = {
    'alert-circle': AlertCircle,
    'check-circle': CheckCircle,
    'x-circle': XCircle,
    'package': Package,
    'dollar-sign': DollarSign,
    'calendar': Calendar,
    'user-plus': UserPlus,
    'file-text': FileText,
    'bell': Bell,
    'check': Check,
    'x': X
  };

  const colorMap = {
    'amber': 'bg-amber-100 text-amber-600',
    'red': 'bg-red-100 text-red-600',
    'green': 'bg-green-100 text-green-600',
    'orange': 'bg-orange-100 text-orange-600',
    'blue': 'bg-blue-100 text-blue-600',
    'purple': 'bg-purple-100 text-purple-600',
    'gray': 'bg-gray-100 text-gray-600'
  };

  useEffect(() => {
    fetchNotifications();
    checkPushSupport();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearInterval(interval);
    };
  }, []);

  const checkPushSupport = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      try {
        const reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          setPushEnabled(!!sub);
        }
      } catch (e) {
        // silent
      }
    }
  };

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
      
      await axios.post(`${API_URL}/api/push/subscribe`, { endpoint: subscription.endpoint, keys }, config);
      setPushEnabled(true);
      
      // Send test notification
      await axios.post(`${API_URL}/api/push/send-test`, {}, config);
    } catch (e) {
      console.error('Push subscription error:', e);
    }
  };

  const fetchNotifications = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/push/notifications?limit=15`, config);
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread || 0);
    } catch (error) {
      // Error fetching notifications
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${API_URL}/api/push/notifications/${notificationId}/read`, {}, config);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {}
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API_URL}/api/push/notifications/read`, {}, config);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {}
  };

  const deleteNotification = async (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const clearAllRead = async () => {
    setNotifications(prev => prev.filter(n => !n.read));
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return t.justNow;
    if (diffMins < 60) return `${diffMins} ${t.minutesAgo}`;
    if (diffHours < 24) return `${diffHours} ${t.hoursAgo}`;
    return `${diffDays} ${t.daysAgo}`;
  };

  const getIcon = (iconName) => {
    const Icon = iconMap[iconName] || Bell;
    return Icon;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="sm"
        className="relative p-2 hover:bg-white/10"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="notification-bell"
      >
        <Bell className="h-5 w-5 text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between">
            <h3 className="font-semibold">{t.notifications}</h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2"
                  title={t.markAllRead}
                >
                  <CheckCheck className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllRead}
                className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2"
                title={t.clearAll}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{t.noNotifications}</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = getIcon(notification.icon);
                const colorClass = colorMap[notification.color] || colorMap.gray;
                
                return (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm text-gray-900">
                            {notification.title || (isRTL ? notification.title_ar : notification.title_en)}
                          </p>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                          {notification.body || (isRTL ? notification.message_ar : notification.message_en)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Push Status Footer */}
          {pushSupported && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className={`w-2 h-2 rounded-full ${pushEnabled ? 'bg-green-400' : 'bg-gray-300'}`} />
                {pushEnabled 
                  ? (isRTL ? 'إشعارات Push مفعّلة' : 'Push enabled')
                  : (isRTL ? 'إشعارات Push غير مفعّلة' : 'Push disabled')
                }
              </div>
              {!pushEnabled && (
                <button
                  onClick={subscribePush}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                  data-testid="enable-push-btn"
                >
                  <BellRing className="h-3 w-3" />
                  {isRTL ? 'تفعيل' : 'Enable'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
