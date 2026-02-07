/**
 * Push Notification Permission Request Component
 * Asks user permission for browser notifications
 */

import React, { useState, useEffect } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const NotificationPermissionRequest = () => {
  const { language, isRTL } = useLanguage();
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [permission, setPermission] = useState('default');

  const t = {
    ar: {
      title: 'تفعيل الإشعارات',
      message: 'اسمح بالإشعارات لتلقي تنبيهات فورية حول المهام والتحديثات الهامة',
      enable: 'تفعيل',
      later: 'لاحقاً',
      enabled: 'تم تفعيل الإشعارات!',
    },
    en: {
      title: 'Enable Notifications',
      message: 'Allow notifications to receive instant alerts about tasks and important updates',
      enable: 'Enable',
      later: 'Later',
      enabled: 'Notifications enabled!',
    }
  };

  const content = t[language] || t.en;

  useEffect(() => {
    // Check if user is logged in and notifications are supported
    if (!user || !('Notification' in window)) return;

    const currentPermission = Notification.permission;
    setPermission(currentPermission);

    // Show banner if permission not yet requested
    const dismissed = localStorage.getItem('notification_banner_dismissed');
    if (currentPermission === 'default' && !dismissed) {
      // Delay showing banner for better UX
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        // Show a test notification
        new Notification(content.enabled, {
          body: language === 'ar' 
            ? 'ستتلقى الآن إشعارات فورية من DataLife ERP' 
            : 'You will now receive instant notifications from DataLife ERP',
          icon: '/logo192.png',
          badge: '/logo192.png'
        });
      }
      
      setShowBanner(false);
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const dismissBanner = () => {
    localStorage.setItem('notification_banner_dismissed', 'true');
    setShowBanner(false);
  };

  if (!showBanner || permission !== 'default') return null;

  return (
    <div 
      className={`fixed bottom-24 ${isRTL ? 'left-6' : 'right-6'} z-40 max-w-sm animate-in slide-in-from-bottom duration-500`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#28376B] to-[#1e2a5a] p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Bell className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold">{content.title}</h3>
          </div>
          <button
            onClick={dismissBanner}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-white/80" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <p className="text-gray-600 text-sm mb-4">
            {content.message}
          </p>
          
          <div className="flex gap-2">
            <Button
              onClick={requestPermission}
              className="flex-1 bg-[#28376B] hover:bg-[#1e2a5a]"
            >
              <Check className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {content.enable}
            </Button>
            <Button
              variant="outline"
              onClick={dismissBanner}
              className="flex-1"
            >
              {content.later}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPermissionRequest;
