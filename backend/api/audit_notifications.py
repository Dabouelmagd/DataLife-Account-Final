"""
Audit Email Notifications
إشعارات البريد الإلكتروني لسجل التدقيق
"""

import os
import smtplib
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from database import db

logger = logging.getLogger(__name__)

# SMTP Configuration
SMTP_HOST = os.environ.get("SMTP_HOST", "gtxm1001.siteground.biz")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "info@datalifeai.com")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")


def send_email_smtp(to_email: str, subject: str, html_content: str) -> bool:
    """Send email using SMTP"""
    try:
        if not SMTP_PASSWORD:
            logger.warning("SMTP_PASSWORD not configured")
            return False
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_EMAIL
        msg["To"] = to_email
        
        html_part = MIMEText(html_content, "html", "utf-8")
        msg.attach(html_part)
        
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        
        logger.info(f"Audit email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send audit email to {to_email}: {e}")
        return False


def get_audit_email_template(title: str, content: str, alert_type: str = "info") -> str:
    """قالب البريد الإلكتروني لتنبيهات التدقيق"""
    
    colors = {
        "danger": {"bg": "#dc3545", "light": "#f8d7da", "icon": "🚨"},
        "warning": {"bg": "#ffc107", "light": "#fff3cd", "icon": "⚠️"},
        "info": {"bg": "#17a2b8", "light": "#d1ecf1", "icon": "ℹ️"},
        "success": {"bg": "#28a745", "light": "#d4edda", "icon": "✅"}
    }
    
    color = colors.get(alert_type, colors["info"])
    
    return f"""
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background-color: #f4f4f4; direction: rtl;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: {color['bg']}; padding: 25px; text-align: center;">
                                <span style="font-size: 40px;">{color['icon']}</span>
                                <h1 style="color: #ffffff; margin: 10px 0 0 0; font-size: 22px;">{title}</h1>
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td style="padding: 30px; text-align: right; line-height: 1.8; color: #333333;">
                                {content}
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                                <p style="margin: 0; color: #6c757d; font-size: 14px;">DataLife Account - نظام التدقيق</p>
                                <p style="margin: 5px 0 0 0; color: #adb5bd; font-size: 12px;">هذا البريد آلي من نظام سجل التدقيق</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def get_user_deleted_template(deleted_user_name: str, deleted_user_email: str, 
                               deleted_by_name: str, deleted_by_email: str,
                               company_name: str, timestamp: str) -> str:
    """قالب تنبيه حذف مستخدم"""
    
    content = f"""
    <div style="background-color: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <p style="margin: 0; font-weight: bold; color: #721c24; font-size: 16px;">
            تم حذف مستخدم من النظام
        </p>
    </div>
    
    <h3 style="color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">بيانات المستخدم المحذوف</h3>
    <table width="100%" style="border-collapse: collapse; margin-bottom: 20px;">
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: bold; width: 40%;">الاسم:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">{deleted_user_name}</td>
        </tr>
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: bold;">البريد الإلكتروني:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">{deleted_user_email}</td>
        </tr>
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: bold;">الشركة:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">{company_name or 'غير محدد'}</td>
        </tr>
    </table>
    
    <h3 style="color: #6c757d; border-bottom: 2px solid #6c757d; padding-bottom: 10px;">تم الحذف بواسطة</h3>
    <table width="100%" style="border-collapse: collapse;">
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: bold; width: 40%;">الاسم:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">{deleted_by_name}</td>
        </tr>
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: bold;">البريد الإلكتروني:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">{deleted_by_email}</td>
        </tr>
        <tr>
            <td style="padding: 12px; font-weight: bold;">التاريخ والوقت:</td>
            <td style="padding: 12px;">{timestamp}</td>
        </tr>
    </table>
    """
    
    return get_audit_email_template("تنبيه: تم حذف مستخدم", content, "danger")


def get_permissions_changed_template(user_name: str, user_email: str,
                                     old_permissions: List[str], new_permissions: List[str],
                                     changed_by_name: str, changed_by_email: str,
                                     timestamp: str) -> str:
    """قالب تنبيه تغيير الصلاحيات"""
    
    # Determine if this is sensitive (full access or admin permissions)
    sensitive_permissions = ['settings', 'users', 'financial', 'approvals']
    added = set(new_permissions) - set(old_permissions)
    removed = set(old_permissions) - set(new_permissions)
    
    is_sensitive = any(p in added for p in sensitive_permissions) or len(new_permissions) >= 10
    alert_type = "warning" if is_sensitive else "info"
    
    permission_labels = {
        'dashboard': 'لوحة التحكم',
        'hr': 'الموارد البشرية',
        'financial': 'الإدارة المالية',
        'invoices': 'الفواتير',
        'purchases': 'المشتريات',
        'projects': 'المشاريع',
        'analytics': 'التحليلات',
        'settings': 'الإعدادات',
        'users': 'إدارة المستخدمين',
        'approvals': 'الموافقات',
        'inventory': 'المخزون',
        'reports': 'التقارير'
    }
    
    added_html = ""
    if added:
        added_list = ", ".join([permission_labels.get(p, p) for p in added])
        added_html = f"""
        <div style="background-color: #d4edda; border-radius: 5px; padding: 10px; margin: 10px 0;">
            <strong style="color: #155724;">✅ صلاحيات مضافة:</strong> {added_list}
        </div>
        """
    
    removed_html = ""
    if removed:
        removed_list = ", ".join([permission_labels.get(p, p) for p in removed])
        removed_html = f"""
        <div style="background-color: #f8d7da; border-radius: 5px; padding: 10px; margin: 10px 0;">
            <strong style="color: #721c24;">❌ صلاحيات محذوفة:</strong> {removed_list}
        </div>
        """
    
    sensitivity_badge = ""
    if is_sensitive:
        sensitivity_badge = """
        <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 10px; margin-bottom: 15px;">
            <strong style="color: #856404;">⚠️ تنبيه: تم منح صلاحيات حساسة</strong>
        </div>
        """
    
    content = f"""
    {sensitivity_badge}
    
    <h3 style="color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 10px;">تفاصيل التغيير</h3>
    <table width="100%" style="border-collapse: collapse; margin-bottom: 20px;">
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: bold; width: 40%;">المستخدم:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">{user_name}</td>
        </tr>
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: bold;">البريد الإلكتروني:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">{user_email}</td>
        </tr>
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: bold;">عدد الصلاحيات:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">{len(old_permissions)} ← {len(new_permissions)}</td>
        </tr>
    </table>
    
    {added_html}
    {removed_html}
    
    <h3 style="color: #6c757d; border-bottom: 2px solid #6c757d; padding-bottom: 10px; margin-top: 20px;">تم التغيير بواسطة</h3>
    <table width="100%" style="border-collapse: collapse;">
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: bold; width: 40%;">الاسم:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">{changed_by_name}</td>
        </tr>
        <tr>
            <td style="padding: 12px; font-weight: bold;">التاريخ والوقت:</td>
            <td style="padding: 12px;">{timestamp}</td>
        </tr>
    </table>
    """
    
    title = "تنبيه: تغيير صلاحيات حساسة" if is_sensitive else "إشعار: تم تغيير صلاحيات مستخدم"
    return get_audit_email_template(title, content, alert_type)


def get_daily_audit_report_template(date: str, stats: dict, recent_logs: List[dict]) -> str:
    """قالب التقرير اليومي لسجل التدقيق"""
    
    # Build recent logs table
    logs_html = ""
    for log in recent_logs[:10]:
        action_colors = {
            'delete': '#dc3545',
            'create': '#28a745',
            'activate': '#17a2b8',
            'deactivate': '#ffc107',
            'change_permissions': '#6f42c1',
            'change_role': '#fd7e14'
        }
        color = action_colors.get(log.get('action'), '#6c757d')
        
        logs_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">
                <span style="background-color: {color}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px;">
                    {log.get('action_ar', log.get('action'))}
                </span>
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">{log.get('entity_name', '-')}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">{log.get('performed_by_name', '-')}</td>
        </tr>
        """
    
    content = f"""
    <div style="background-color: #e7f3ff; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #0056b3;">تقرير يوم</p>
        <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #004085;">{date}</p>
    </div>
    
    <h3 style="color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 10px;">ملخص العمليات</h3>
    <table width="100%" style="border-collapse: collapse; margin-bottom: 20px;">
        <tr>
            <td style="padding: 15px; text-align: center; background-color: #f8f9fa; border-radius: 5px; margin: 5px;">
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #495057;">{stats.get('total', 0)}</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #6c757d;">إجمالي العمليات</p>
            </td>
            <td style="padding: 15px; text-align: center; background-color: #d4edda; border-radius: 5px; margin: 5px;">
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #155724;">{stats.get('activations', 0)}</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #155724;">تفعيل</p>
            </td>
            <td style="padding: 15px; text-align: center; background-color: #f8d7da; border-radius: 5px; margin: 5px;">
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #721c24;">{stats.get('deletions', 0)}</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #721c24;">حذف</p>
            </td>
            <td style="padding: 15px; text-align: center; background-color: #e2d5f1; border-radius: 5px; margin: 5px;">
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #6f42c1;">{stats.get('permission_changes', 0)}</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #6f42c1;">تغيير صلاحيات</p>
            </td>
        </tr>
    </table>
    
    <h3 style="color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 10px;">آخر العمليات</h3>
    <table width="100%" style="border-collapse: collapse;">
        <thead>
            <tr style="background-color: #f8f9fa;">
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">العملية</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">الكيان</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">بواسطة</th>
            </tr>
        </thead>
        <tbody>
            {logs_html if logs_html else '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #6c757d;">لا توجد عمليات اليوم</td></tr>'}
        </tbody>
    </table>
    """
    
    return get_audit_email_template(f"التقرير اليومي - سجل التدقيق", content, "info")


# ==========================================
# Notification Functions
# ==========================================

async def notify_user_deleted(deleted_user: dict, deleted_by: dict, company_name: str = None):
    """إرسال إشعار عند حذف مستخدم"""
    try:
        # Get admin emails
        admin_emails = await get_admin_emails()
        
        if not admin_emails:
            logger.warning("No admin emails configured for audit notifications")
            return
        
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        
        html_content = get_user_deleted_template(
            deleted_user_name=deleted_user.get('full_name', 'Unknown'),
            deleted_user_email=deleted_user.get('email', 'Unknown'),
            deleted_by_name=deleted_by.get('full_name', 'Unknown'),
            deleted_by_email=deleted_by.get('email', 'Unknown'),
            company_name=company_name,
            timestamp=timestamp
        )
        
        subject = f"🚨 تنبيه: تم حذف المستخدم {deleted_user.get('full_name', '')}"
        
        for email in admin_emails:
            await asyncio.to_thread(send_email_smtp, email, subject, html_content)
            
    except Exception as e:
        logger.error(f"Error sending user deletion notification: {e}")


async def notify_permissions_changed(user: dict, old_permissions: List[str], 
                                     new_permissions: List[str], changed_by: dict):
    """إرسال إشعار عند تغيير الصلاحيات"""
    try:
        # Check if it's a sensitive change
        sensitive_permissions = ['settings', 'users', 'financial', 'approvals']
        added = set(new_permissions) - set(old_permissions)
        
        is_sensitive = any(p in added for p in sensitive_permissions) or len(new_permissions) >= 10
        
        if not is_sensitive:
            # Only notify for sensitive changes
            return
        
        admin_emails = await get_admin_emails()
        
        if not admin_emails:
            return
        
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        
        html_content = get_permissions_changed_template(
            user_name=user.get('full_name', 'Unknown'),
            user_email=user.get('email', 'Unknown'),
            old_permissions=old_permissions,
            new_permissions=new_permissions,
            changed_by_name=changed_by.get('full_name', 'Unknown'),
            changed_by_email=changed_by.get('email', 'Unknown'),
            timestamp=timestamp
        )
        
        subject = f"⚠️ تنبيه: تغيير صلاحيات حساسة - {user.get('full_name', '')}"
        
        for email in admin_emails:
            await asyncio.to_thread(send_email_smtp, email, subject, html_content)
            
    except Exception as e:
        logger.error(f"Error sending permissions change notification: {e}")


async def send_daily_audit_report():
    """إرسال التقرير اليومي لسجل التدقيق"""
    try:
        # Get yesterday's date range
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday = today - timedelta(days=1)
        
        # Get logs from yesterday
        query = {
            "timestamp": {
                "$gte": yesterday.isoformat(),
                "$lt": today.isoformat()
            }
        }
        
        logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(length=50)
        
        # Calculate stats
        stats = {
            "total": len(logs),
            "activations": sum(1 for l in logs if l.get('action') == 'activate'),
            "deletions": sum(1 for l in logs if l.get('action') == 'delete'),
            "permission_changes": sum(1 for l in logs if l.get('action') == 'change_permissions')
        }
        
        # Only send if there are logs
        if stats['total'] == 0:
            logger.info("No audit logs for daily report, skipping")
            return
        
        admin_emails = await get_admin_emails()
        
        if not admin_emails:
            return
        
        date_str = yesterday.strftime("%Y-%m-%d")
        html_content = get_daily_audit_report_template(date_str, stats, logs)
        
        subject = f"📊 التقرير اليومي لسجل التدقيق - {date_str}"
        
        for email in admin_emails:
            await asyncio.to_thread(send_email_smtp, email, subject, html_content)
        
        logger.info(f"Daily audit report sent to {len(admin_emails)} admins")
            
    except Exception as e:
        logger.error(f"Error sending daily audit report: {e}")


async def get_admin_emails() -> List[str]:
    """جلب عناوين البريد الإلكتروني للمدراء"""
    try:
        # Get Super Admin users
        super_admins = await db.users.find(
            {"role": {"$in": ["Super Admin", "مدير النظام"]}},
            {"email": 1, "_id": 0}
        ).to_list(length=10)
        
        emails = [admin.get('email') for admin in super_admins if admin.get('email')]
        
        # Also check notification settings for admin emails
        settings = await db.notification_settings.find_one({"type": "audit"})
        if settings and settings.get('admin_emails'):
            emails.extend(settings.get('admin_emails'))
        
        return list(set(emails))  # Remove duplicates
        
    except Exception as e:
        logger.error(f"Error getting admin emails: {e}")
        return []



# ==========================================
# إشعارات الاشتراكات والشركات
# ==========================================

async def send_subscription_notification(
    company_name: str,
    company_email: str,
    plan: str,
    duration: str,
    end_date: str
) -> bool:
    """إرسال إشعار تفعيل الاشتراك"""
    try:
        plan_names = {
            "starter": "المبتدئ",
            "professional": "المحترف", 
            "enterprise": "المؤسسي"
        }
        
        duration_names = {
            "monthly": "شهري",
            "quarterly": "ربع سنوي",
            "yearly": "سنوي",
            "lifetime": "مدى الحياة"
        }
        
        plan_ar = plan_names.get(plan, plan)
        duration_ar = duration_names.get(duration, duration)
        
        content = f"""
        <p style="font-size: 16px; color: #333;">مرحباً <strong>{company_name}</strong>،</p>
        
        <p style="font-size: 16px; color: #333;">
            تم تفعيل اشتراكك في نظام <strong>DataLife Account</strong> بنجاح!
        </p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #28376B; margin-top: 0;">تفاصيل الاشتراك:</h3>
            <table style="width: 100%;">
                <tr><td style="padding: 8px 0;"><strong>الباقة:</strong></td><td>{plan_ar}</td></tr>
                <tr><td style="padding: 8px 0;"><strong>المدة:</strong></td><td>{duration_ar}</td></tr>
                <tr><td style="padding: 8px 0;"><strong>تاريخ الانتهاء:</strong></td><td>{end_date[:10]}</td></tr>
            </table>
        </div>
        
        <p style="font-size: 16px; color: #333;">
            يمكنك الآن الاستمتاع بجميع ميزات الباقة المشترك بها.
        </p>
        
        <p style="color: #666;">شكراً لثقتك في DataLife AI Services</p>
        """
        
        html = get_audit_email_template(
            "تم تفعيل اشتراكك ✅",
            content,
            "success"
        )
        
        if company_email:
            send_email_smtp(company_email, "تم تفعيل اشتراكك في DataLife Account", html)
        
        # إرسال نسخة للـ Admin
        admin_emails = await get_admin_emails()
        for email in admin_emails:
            admin_content = f"""
            <p style="font-size: 16px; color: #333;">تم تفعيل اشتراك جديد:</p>
            <ul>
                <li><strong>الشركة:</strong> {company_name}</li>
                <li><strong>البريد:</strong> {company_email}</li>
                <li><strong>الباقة:</strong> {plan_ar}</li>
                <li><strong>المدة:</strong> {duration_ar}</li>
            </ul>
            """
            admin_html = get_audit_email_template("اشتراك جديد 🎉", admin_content, "info")
            send_email_smtp(email, f"اشتراك جديد: {company_name}", admin_html)
        
        return True
    except Exception as e:
        logger.error(f"Failed to send subscription notification: {e}")
        return False


async def send_company_registration_notification(
    company_name: str,
    company_email: str,
    admin_name: str
) -> bool:
    """إرسال إشعار تسجيل شركة جديدة"""
    try:
        # إشعار للشركة
        company_content = f"""
        <p style="font-size: 16px; color: #333;">مرحباً <strong>{admin_name}</strong>،</p>
        
        <p style="font-size: 16px; color: #333;">
            تم تسجيل شركة <strong>{company_name}</strong> بنجاح في نظام DataLife Account!
        </p>
        
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #2e7d32;">
                ✅ يمكنك الآن تسجيل الدخول والبدء في استخدام النظام.
            </p>
        </div>
        
        <p style="font-size: 14px; color: #666;">
            لأي استفسارات، تواصل معنا على info@datalifeai.com
        </p>
        """
        
        html = get_audit_email_template(
            "مرحباً بك في DataLife Account 🎉",
            company_content,
            "success"
        )
        
        if company_email:
            send_email_smtp(company_email, "مرحباً بك في DataLife Account", html)
        
        # إشعار للـ Admin
        admin_emails = await get_admin_emails()
        admin_content = f"""
        <p style="font-size: 16px; color: #333;">تم تسجيل شركة جديدة:</p>
        <ul>
            <li><strong>الشركة:</strong> {company_name}</li>
            <li><strong>البريد:</strong> {company_email}</li>
            <li><strong>المدير:</strong> {admin_name}</li>
            <li><strong>الوقت:</strong> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}</li>
        </ul>
        """
        admin_html = get_audit_email_template("شركة جديدة مسجلة 🏢", admin_content, "info")
        
        for email in admin_emails:
            send_email_smtp(email, f"شركة جديدة: {company_name}", admin_html)
        
        return True
    except Exception as e:
        logger.error(f"Failed to send registration notification: {e}")
        return False


async def send_subscription_expiry_warning(
    company_name: str,
    company_email: str,
    days_remaining: int,
    end_date: str
) -> bool:
    """إرسال تحذير انتهاء الاشتراك"""
    try:
        if days_remaining <= 3:
            alert_type = "danger"
            title = "⚠️ اشتراكك على وشك الانتهاء!"
        elif days_remaining <= 7:
            alert_type = "warning"
            title = "تذكير: اشتراكك قارب على الانتهاء"
        else:
            alert_type = "info"
            title = "تذكير بتجديد الاشتراك"
        
        content = f"""
        <p style="font-size: 16px; color: #333;">عزيزي <strong>{company_name}</strong>،</p>
        
        <p style="font-size: 16px; color: #333;">
            نود تذكيركم بأن اشتراككم في DataLife Account سينتهي خلال 
            <strong style="color: #dc3545;">{days_remaining} أيام</strong>.
        </p>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #ffc107;">
            <p style="margin: 0;"><strong>تاريخ الانتهاء:</strong> {end_date[:10]}</p>
        </div>
        
        <p style="font-size: 16px; color: #333;">
            للاستمرار في الاستفادة من خدماتنا، يرجى تجديد اشتراككم قبل انتهاء المدة.
        </p>
        
        <p style="color: #666;">شكراً لثقتك في DataLife AI Services</p>
        """
        
        html = get_audit_email_template(title, content, alert_type)
        
        if company_email:
            send_email_smtp(company_email, title, html)
        
        return True
    except Exception as e:
        logger.error(f"Failed to send expiry warning: {e}")
        return False


async def check_expiring_subscriptions():
    """فحص الاشتراكات المنتهية وإرسال التحذيرات"""
    try:
        now = datetime.now(timezone.utc)
        warning_days = [1, 3, 7, 14]  # أيام التحذير
        
        for days in warning_days:
            target_date = now + timedelta(days=days)
            
            # البحث عن الاشتراكات التي ستنتهي في هذا اليوم
            expiring = await db.subscriptions.find({
                "status": "active",
                "end_date": {
                    "$gte": target_date.replace(hour=0, minute=0, second=0),
                    "$lt": target_date.replace(hour=23, minute=59, second=59)
                }
            }).to_list(length=100)
            
            for sub in expiring:
                company = await db.companies.find_one({"id": sub.get("company_id")})
                if company:
                    await send_subscription_expiry_warning(
                        company_name=company.get("name", "Unknown"),
                        company_email=company.get("email"),
                        days_remaining=days,
                        end_date=sub.get("end_date", "").isoformat() if hasattr(sub.get("end_date"), 'isoformat') else str(sub.get("end_date", ""))
                    )
        
        logger.info("Expiring subscriptions check completed")
    except Exception as e:
        logger.error(f"Error checking expiring subscriptions: {e}")
