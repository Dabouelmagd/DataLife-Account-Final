import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Bell, Calendar, UserMinus, AlertTriangle, ChevronRight,
  Clock, RefreshCw
} from 'lucide-react';
import { 
  Warning, CalendarX, UserMinus as UserMinusIcon
} from '@phosphor-icons/react';

const HRAlerts = ({ language, onNavigate }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, high_priority: 0, medium_priority: 0 });

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/notifications/hr-alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
        setStats({
          total: data.total || 0,
          high_priority: data.high_priority || 0,
          medium_priority: data.medium_priority || 0
        });
      }
    } catch (error) {
      console.error('Error fetching HR alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'leave_expiring':
        return CalendarX;
      case 'termination_approaching':
        return UserMinusIcon;
      default:
        return Warning;
    }
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    };
    const labels = {
      high: language === 'ar' ? 'عاجل' : 'Urgent',
      medium: language === 'ar' ? 'متوسط' : 'Medium',
      low: language === 'ar' ? 'منخفض' : 'Low'
    };
    return <Badge className={`${styles[priority]} text-xs`}>{labels[priority]}</Badge>;
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-amber-500" data-testid="hr-alerts">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Bell className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">
                {language === 'ar' ? 'تنبيهات الموارد البشرية' : 'HR Alerts'}
              </CardTitle>
              <p className="text-xs text-slate-500">
                {stats.high_priority > 0 && (
                  <span className="text-red-600 font-medium">
                    {stats.high_priority} {language === 'ar' ? 'عاجل' : 'urgent'}
                  </span>
                )}
                {stats.high_priority > 0 && stats.medium_priority > 0 && ' • '}
                {stats.medium_priority > 0 && (
                  <span className="text-amber-600">
                    {stats.medium_priority} {language === 'ar' ? 'متوسط' : 'medium'}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={fetchAlerts}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {alerts.slice(0, 5).map((alert) => {
            const Icon = getAlertIcon(alert.type);
            const isLeave = alert.type === 'leave_expiring';
            const bgColor = isLeave ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-red-50 dark:bg-red-950/20';
            const iconBg = isLeave ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600';
            
            return (
              <div 
                key={alert.id}
                className={`p-3 rounded-lg ${bgColor} hover:opacity-80 transition-opacity cursor-pointer`}
                onClick={() => {
                  if (alert.type === 'leave_expiring') {
                    onNavigate?.('hr', 'annual-leave');
                  } else {
                    onNavigate?.('hr', 'termination');
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon weight="fill" className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {alert.employee_name}
                      </span>
                      {getPriorityBadge(alert.priority)}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {language === 'ar' ? alert.message_ar : alert.message_en}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>
                        {alert.days_remaining} {language === 'ar' ? 'يوم متبقي' : 'days remaining'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
        
        {alerts.length > 5 && (
          <Button
            variant="ghost"
            className="w-full mt-3 text-sm"
            onClick={() => onNavigate?.('hr', 'hr-overview')}
          >
            {language === 'ar' 
              ? `عرض ${alerts.length - 5} تنبيه إضافي`
              : `View ${alerts.length - 5} more alerts`
            }
            <ChevronRight className="w-4 h-4 ms-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default HRAlerts;
