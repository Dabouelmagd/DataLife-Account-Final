"""
Professional Email Service
خدمة البريد الإلكتروني الاحترافية
"""

import os
import smtplib
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class ProfessionalEmailService:
    """خدمة إرسال البريد الإلكتروني الاحترافية"""
    
    def __init__(self):
        self.smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.environ.get('SMTP_PORT', '465'))
        self.smtp_email = os.environ.get('SMTP_EMAIL', '')
        self.smtp_password = os.environ.get('SMTP_PASSWORD', '')
        self.use_ssl = os.environ.get('SMTP_USE_SSL', 'true').lower() == 'true'
        self.company_name = "DataLife Account"
        self.company_logo = "https://datalifeaccount.com/logo.png"
    
    def _get_base_template(self, title: str, content: str, accent_color: str = "#1e40af") -> str:
        """قالب البريد الإلكتروني الأساسي الاحترافي - اللون الأزرق"""
        # Always use blue theme
        accent_color = "#1e40af"
        return f'''
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <!--[if mso]>
    <style type="text/css">
        table {{border-collapse: collapse;}}
        .content {{width: 600px;}}
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8; direction: rtl;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" class="content" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
                    
                    <!-- Header with Logo -->
                    <tr>
                        <td style="background: linear-gradient(135deg, {accent_color} 0%, #1e3a5f 100%); padding: 40px 30px; text-align: center;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <div style="width: 80px; height: 80px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: inline-block; line-height: 80px; margin-bottom: 15px;">
                                            <span style="font-size: 36px; color: #ffffff;">📊</span>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">{title}</h1>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px 35px;">
                            {content}
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 30px; border-top: 1px solid #e2e8f0;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <p style="margin: 0 0 10px 0; color: #1e3a5f; font-weight: 700; font-size: 18px;">
                                            DataLife Account
                                        </p>
                                        <p style="margin: 0 0 5px 0; color: #64748b; font-size: 14px;">
                                            نظام إدارة موارد المؤسسات المتكامل
                                        </p>
                                        <p style="margin: 15px 0 0 0; color: #94a3b8; font-size: 12px;">
                                            © {datetime.now().year} DataLife AI Services. جميع الحقوق محفوظة
                                        </p>
                                        <p style="margin: 5px 0 0 0; color: #cbd5e1; font-size: 11px;">
                                            هذا البريد آلي، يرجى عدم الرد عليه مباشرة
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
'''

    def _create_info_box(self, text: str, box_type: str = "info") -> str:
        """إنشاء مربع معلومات"""
        colors = {
            "info": {"bg": "#eff6ff", "border": "#3b82f6", "icon": "ℹ️", "text": "#1e40af"},
            "success": {"bg": "#f0fdf4", "border": "#22c55e", "icon": "✅", "text": "#166534"},
            "warning": {"bg": "#fffbeb", "border": "#f59e0b", "icon": "⚠️", "text": "#92400e"},
            "error": {"bg": "#fef2f2", "border": "#ef4444", "icon": "❌", "text": "#991b1b"},
        }
        c = colors.get(box_type, colors["info"])
        return f'''
        <div style="background-color: {c['bg']}; border-right: 4px solid {c['border']}; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
            <p style="margin: 0; color: {c['text']}; font-size: 14px;">
                <span style="font-size: 18px; margin-left: 8px;">{c['icon']}</span>
                {text}
            </p>
        </div>
        '''

    def _create_data_table(self, rows: List[Dict[str, Any]], highlight_last: bool = True) -> str:
        """إنشاء جدول بيانات احترافي"""
        # Filter out None rows
        rows = [r for r in rows if r is not None]
        if not rows:
            return ''
        html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 20px 0; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">'
        
        for i, row in enumerate(rows):
            is_last = i == len(rows) - 1 and highlight_last
            bg_color = "#1e3a5f" if is_last else ("#f8fafc" if i % 2 == 0 else "#ffffff")
            text_color = "#ffffff" if is_last else "#334155"
            label_weight = "700" if is_last else "600"
            value_size = "20px" if is_last else "15px"
            
            html += f'''
            <tr style="background-color: {bg_color};">
                <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-weight: {label_weight}; color: {text_color}; width: 40%;">
                    {row.get('label', '')}
                </td>
                <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; text-align: left; color: {row.get('color', text_color)}; font-size: {value_size}; font-weight: {'700' if is_last else '500'};">
                    {row.get('value', '')}
                </td>
            </tr>
            '''
        
        html += '</table>'
        return html

    def _create_button(self, text: str, url: str, color: str = "#1e40af") -> str:
        """إنشاء زر احترافي"""
        return f'''
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 25px auto;">
            <tr>
                <td align="center" style="background: linear-gradient(135deg, {color} 0%, #1e3a5f 100%); border-radius: 8px;">
                    <a href="{url}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">
                        {text}
                    </a>
                </td>
            </tr>
        </table>
        '''

    def _create_stats_row(self, stats: List[Dict[str, Any]]) -> str:
        """إنشاء صف إحصائيات"""
        width = 100 // len(stats) if stats else 100
        html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;"><tr>'
        
        for stat in stats:
            html += f'''
            <td align="center" width="{width}%" style="padding: 15px;">
                <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: {stat.get('color', '#1e40af')};">
                        {stat.get('value', '0')}
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #64748b;">
                        {stat.get('label', '')}
                    </p>
                </div>
            </td>
            '''
        
        html += '</tr></table>'
        return html

    # ===========================================
    # Email Templates
    # ===========================================
    
    def get_welcome_email(self, employee_name: str, company_name: str, email: str, temp_password: str = None) -> str:
        """بريد الترحيب بالموظف الجديد"""
        content = f'''
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 0 0 20px 0;">
            مرحباً <strong style="color: #1e40af;">{employee_name}</strong>،
        </p>
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 0 0 20px 0;">
            يسعدنا انضمامك إلى فريق <strong>{company_name}</strong>! 🎉
        </p>
        
        {self._create_info_box("تم إنشاء حسابك بنجاح على نظام DataLife Account", "success")}
        
        <p style="font-size: 15px; color: #475569; line-height: 1.7; margin: 20px 0;">
            بيانات الدخول الخاصة بك:
        </p>
        
        {self._create_data_table([
            {"label": "البريد الإلكتروني", "value": email},
            {"label": "كلمة المرور المؤقتة", "value": temp_password if temp_password else "********"} if temp_password else None,
        ], highlight_last=False)}
        
        {self._create_button("الدخول إلى النظام", "https://datalifeaccount.com/login")}
        
        <p style="font-size: 14px; color: #64748b; line-height: 1.7; margin: 20px 0 0 0;">
            يرجى تغيير كلمة المرور عند أول تسجيل دخول للحفاظ على أمان حسابك.
        </p>
        '''
        return self._get_base_template("مرحباً بك في الفريق! 🎉", content, "#22c55e")

    def get_payslip_email(self, employee_name: str, month: str, year: str,
                          basic_salary: float, allowances: float, deductions: float, 
                          net_salary: float, allowance_details: List[Dict] = None,
                          deduction_details: List[Dict] = None) -> str:
        """بريد كشف الراتب الاحترافي"""
        
        stats = [
            {"value": f"{basic_salary:,.0f}", "label": "الراتب الأساسي", "color": "#1e40af"},
            {"value": f"+{allowances:,.0f}", "label": "البدلات", "color": "#22c55e"},
            {"value": f"-{deductions:,.0f}", "label": "الاستقطاعات", "color": "#ef4444"},
        ]
        
        rows = [
            {"label": "الراتب الأساسي", "value": f"{basic_salary:,.2f} ج.م"},
            {"label": "إجمالي البدلات", "value": f"+{allowances:,.2f} ج.م", "color": "#22c55e"},
            {"label": "إجمالي الاستقطاعات", "value": f"-{deductions:,.2f} ج.م", "color": "#ef4444"},
            {"label": "صافي الراتب", "value": f"{net_salary:,.2f} ج.م"},
        ]
        
        content = f'''
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 0 0 20px 0;">
            مرحباً <strong style="color: #1e40af;">{employee_name}</strong>،
        </p>
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 0 0 10px 0;">
            نرفق لك كشف راتبك عن شهر <strong>{month} {year}</strong>
        </p>
        
        {self._create_stats_row(stats)}
        
        <h3 style="color: #1e3a5f; font-size: 18px; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">
            📋 تفاصيل الراتب
        </h3>
        
        {self._create_data_table(rows)}
        
        {self._create_info_box("تم إيداع المبلغ في حسابك البنكي المسجل", "success")}
        
        <p style="font-size: 14px; color: #64748b; line-height: 1.7; margin: 20px 0 0 0;">
            في حالة وجود أي استفسار، يرجى التواصل مع قسم الموارد البشرية.
        </p>
        '''
        return self._get_base_template(f"كشف راتب - {month} {year}", content, "#1e40af")

    def get_leave_approval_email(self, employee_name: str, leave_type: str, 
                                  start_date: str, end_date: str, days: int,
                                  status: str, approver_name: str = None, 
                                  rejection_reason: str = None) -> str:
        """بريد الموافقة/الرفض على الإجازة"""
        
        is_approved = status.lower() in ['approved', 'موافق', 'مقبول']
        status_text = "تمت الموافقة ✅" if is_approved else "تم الرفض ❌"
        accent_color = "#22c55e" if is_approved else "#ef4444"
        
        rows = [
            {"label": "نوع الإجازة", "value": leave_type},
            {"label": "تاريخ البداية", "value": start_date},
            {"label": "تاريخ النهاية", "value": end_date},
            {"label": "عدد الأيام", "value": f"{days} يوم"},
            {"label": "الحالة", "value": status_text, "color": accent_color},
        ]
        
        if approver_name:
            rows.insert(-1, {"label": "المعتمد", "value": approver_name})
        
        content = f'''
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 0 0 20px 0;">
            مرحباً <strong style="color: #1e40af;">{employee_name}</strong>،
        </p>
        
        {self._create_info_box(f"تم {'الموافقة على' if is_approved else 'رفض'} طلب إجازتك", "success" if is_approved else "error")}
        
        <h3 style="color: #1e3a5f; font-size: 18px; margin: 25px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">
            📅 تفاصيل الإجازة
        </h3>
        
        {self._create_data_table(rows, highlight_last=False)}
        '''
        
        if rejection_reason and not is_approved:
            content += f'''
            <div style="background-color: #fef2f2; border-radius: 8px; padding: 15px 20px; margin: 20px 0;">
                <p style="margin: 0 0 5px 0; color: #991b1b; font-weight: 600;">سبب الرفض:</p>
                <p style="margin: 0; color: #7f1d1d;">{rejection_reason}</p>
            </div>
            '''
        
        content += f'''
        <p style="font-size: 14px; color: #64748b; line-height: 1.7; margin: 20px 0 0 0;">
            للاستفسار، يرجى التواصل مع قسم الموارد البشرية.
        </p>
        '''
        
        return self._get_base_template(
            "الموافقة على الإجازة" if is_approved else "رفض طلب الإجازة", 
            content, 
            accent_color
        )

    def get_invoice_email(self, customer_name: str, invoice_number: str, 
                          amount: float, due_date: str, items: List[Dict] = None,
                          company_name: str = "DataLife") -> str:
        """بريد الفاتورة الاحترافي"""
        
        content = f'''
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 0 0 20px 0;">
            عزيزي/عزيزتي <strong style="color: #1e40af;">{customer_name}</strong>،
        </p>
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 0 0 20px 0;">
            نرفق لك فاتورة رقم <strong>#{invoice_number}</strong>
        </p>
        
        <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a5f 100%); border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0;">
            <p style="margin: 0 0 5px 0; color: rgba(255,255,255,0.8); font-size: 14px;">المبلغ المستحق</p>
            <p style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 700;">{amount:,.2f} ج.م</p>
            <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.7); font-size: 13px;">تاريخ الاستحقاق: {due_date}</p>
        </div>
        
        {self._create_info_box(f"يرجى السداد قبل تاريخ الاستحقاق لتجنب أي رسوم تأخير", "warning")}
        
        {self._create_button("عرض الفاتورة", f"https://datalifeaccount.com/invoices/{invoice_number}")}
        
        <p style="font-size: 14px; color: #64748b; line-height: 1.7; margin: 20px 0 0 0;">
            شكراً لتعاملكم مع <strong>{company_name}</strong>
        </p>
        '''
        return self._get_base_template(f"فاتورة #{invoice_number}", content, "#f59e0b")

    def get_transaction_alert_email(self, transaction_type: str, amount: float, 
                                     bank_name: str, description: str, 
                                     account_number: str = None) -> str:
        """بريد تنبيه المعاملة البنكية"""
        
        type_info = {
            "deposit": {"label": "إيداع", "icon": "💰", "color": "#22c55e"},
            "withdrawal": {"label": "سحب", "icon": "💸", "color": "#ef4444"},
            "transfer_in": {"label": "تحويل وارد", "icon": "📥", "color": "#22c55e"},
            "transfer_out": {"label": "تحويل صادر", "icon": "📤", "color": "#f59e0b"},
        }
        
        info = type_info.get(transaction_type, {"label": transaction_type, "icon": "💳", "color": "#64748b"})
        
        content = f'''
        {self._create_info_box("تم تسجيل معاملة بنكية كبيرة على حسابك", "warning")}
        
        <div style="background-color: #f8fafc; border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; font-size: 40px;">{info['icon']}</p>
            <p style="margin: 0 0 5px 0; color: #64748b; font-size: 14px;">{info['label']}</p>
            <p style="margin: 0; color: {info['color']}; font-size: 32px; font-weight: 700;">{amount:,.2f} ج.م</p>
        </div>
        
        {self._create_data_table([
            {"label": "نوع المعاملة", "value": info['label']},
            {"label": "البنك", "value": bank_name},
            {"label": "الوصف", "value": description},
            {"label": "التاريخ", "value": datetime.now().strftime('%Y-%m-%d %H:%M')},
        ], highlight_last=False)}
        
        <p style="font-size: 14px; color: #64748b; line-height: 1.7; margin: 20px 0 0 0;">
            إذا لم تقم بهذه المعاملة، يرجى التواصل فوراً مع الإدارة المالية.
        </p>
        '''
        return self._get_base_template("تنبيه معاملة بنكية ⚠️", content, "#f59e0b")

    def get_subscription_expiry_email(self, company_name: str, plan_name: str, 
                                       expiry_date: str, days_remaining: int) -> str:
        """بريد انتهاء الاشتراك"""
        
        urgency = "error" if days_remaining <= 7 else "warning"
        
        content = f'''
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 0 0 20px 0;">
            مرحباً،
        </p>
        
        {self._create_info_box(f"اشتراكك سينتهي خلال {days_remaining} يوم", urgency)}
        
        {self._create_data_table([
            {"label": "الشركة", "value": company_name},
            {"label": "الخطة الحالية", "value": plan_name},
            {"label": "تاريخ الانتهاء", "value": expiry_date},
            {"label": "الأيام المتبقية", "value": f"{days_remaining} يوم", "color": "#ef4444" if days_remaining <= 7 else "#f59e0b"},
        ], highlight_last=False)}
        
        <p style="font-size: 15px; color: #475569; line-height: 1.7; margin: 20px 0;">
            لضمان استمرار الخدمة دون انقطاع، يرجى تجديد اشتراكك قبل تاريخ الانتهاء.
        </p>
        
        {self._create_button("تجديد الاشتراك الآن", "https://datalifeaccount.com/subscription", "#22c55e")}
        '''
        return self._get_base_template("تذكير: اشتراكك على وشك الانتهاء ⏰", content, "#f59e0b")

    def get_password_reset_email(self, user_name: str, otp_code: str) -> str:
        """بريد إعادة تعيين كلمة المرور"""
        
        content = f'''
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 0 0 20px 0;">
            مرحباً <strong style="color: #1e40af;">{user_name}</strong>،
        </p>
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 0 0 20px 0;">
            تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.
        </p>
        
        <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a5f 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 25px 0;">
            <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.8); font-size: 14px;">رمز التحقق الخاص بك</p>
            <p style="margin: 0; color: #ffffff; font-size: 42px; font-weight: 700; letter-spacing: 8px;">{otp_code}</p>
            <p style="margin: 15px 0 0 0; color: rgba(255,255,255,0.6); font-size: 12px;">صالح لمدة 10 دقائق فقط</p>
        </div>
        
        {self._create_info_box("إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد", "warning")}
        
        <p style="font-size: 14px; color: #64748b; line-height: 1.7; margin: 20px 0 0 0;">
            لأسباب أمنية، لا تشارك هذا الرمز مع أي شخص.
        </p>
        '''
        return self._get_base_template("إعادة تعيين كلمة المرور 🔐", content, "#1e40af")

    def get_new_user_notification_email(self, admin_name: str, new_user_name: str,
                                         new_user_email: str, new_user_role: str,
                                         company_name: str) -> str:
        """بريد إشعار المدير بإضافة موظف جديد"""
        
        content = f'''
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 0 0 20px 0;">
            مرحباً <strong style="color: #1e40af;">{admin_name}</strong>،
        </p>
        
        {self._create_info_box("تم إضافة موظف جديد إلى النظام", "info")}
        
        <h3 style="color: #1e3a5f; font-size: 18px; margin: 25px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">
            👤 بيانات الموظف الجديد
        </h3>
        
        {self._create_data_table([
            {"label": "الاسم", "value": new_user_name},
            {"label": "البريد الإلكتروني", "value": new_user_email},
            {"label": "الوظيفة", "value": new_user_role},
            {"label": "الشركة", "value": company_name},
        ], highlight_last=False)}
        
        {self._create_button("عرض الملف الشخصي", f"https://datalifeaccount.com/employees")}
        '''
        return self._get_base_template("موظف جديد تمت إضافته 👋", content, "#22c55e")

    # ===========================================
    # Send Email Function
    # ===========================================
    
    async def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """إرسال البريد الإلكتروني"""
        try:
            if not self.smtp_email or not self.smtp_password:
                logger.warning("SMTP credentials not configured")
                return False
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"DataLife Account <{self.smtp_email}>"
            msg['To'] = to_email
            
            # Add HTML content
            html_part = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)
            
            # Send email
            if self.use_ssl:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, context=context) as server:
                    server.login(self.smtp_email, self.smtp_password)
                    server.sendmail(self.smtp_email, to_email, msg.as_string())
            else:
                with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                    server.starttls()
                    server.login(self.smtp_email, self.smtp_password)
                    server.sendmail(self.smtp_email, to_email, msg.as_string())
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    async def send_bulk_email(self, recipients: List[str], subject: str, html_content: str) -> Dict[str, int]:
        """إرسال بريد جماعي"""
        results = {"success": 0, "failed": 0}
        
        for email in recipients:
            if await self.send_email(email, subject, html_content):
                results["success"] += 1
            else:
                results["failed"] += 1
        
        return results


# Create singleton instance
email_service = ProfessionalEmailService()


async def send_payment_invoice_email(
    company_name: str,
    company_email: str,
    plan: str,
    duration: str = "monthly",
    amount: float = 0,
    payment_method: str = "",
    reference: str = "",
    payment_date: str = "",
):
    """إرسال فاتورة PDF بعد تأكيد الدفع"""
    try:
        import resend, os
        from datetime import datetime, timezone

        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        if not resend.api_key:
            return False

        PLAN_NAMES = {
            "starter": "المبتدئ / Starter",
            "professional": "المحترف / Professional",
            "enterprise": "المؤسسي / Enterprise",
        }
        DURATION_NAMES = {
            "monthly": "شهري / Monthly",
            "3months": "3 أشهر / 3 Months",
            "6months": "6 أشهر / 6 Months",
            "yearly": "سنوي / Yearly",
            "lifetime": "مدى الحياة / Lifetime",
        }
        PAYMENT_NAMES = {
            "instapay": "InstaPay",
            "vodafone_cash": "فودافون كاش / Vodafone Cash",
            "bank_transfer": "تحويل بنكي / Bank Transfer",
            "cash": "نقدي / Cash",
            "credit_card": "بطاقة ائتمان / Credit Card",
            "activation_code": "كود تفعيل / Activation Code",
        }

        invoice_number = f"DL-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        vat_rate = 0.14
        amount_before_vat = round(amount / (1 + vat_rate), 2)
        vat_amount = round(amount - amount_before_vat, 2)
        paid_date = payment_date[:10] if payment_date else datetime.now(timezone.utc).strftime("%Y-%m-%d")

        html_body = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background:#f5f7fa; margin:0; padding:20px; direction:rtl; }}
  .invoice {{ background:white; max-width:600px; margin:0 auto; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.1); }}
  .header {{ background:linear-gradient(135deg,#0F1729,#28376B); color:white; padding:30px; }}
  .logo {{ font-size:24px; font-weight:900; margin-bottom:4px; }}
  .invoice-title {{ font-size:14px; opacity:0.7; }}
  .body {{ padding:30px; }}
  .row {{ display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f0f0f0; }}
  .row:last-child {{ border:none; }}
  .label {{ color:#6b7280; font-size:13px; }}
  .value {{ color:#111827; font-weight:600; font-size:13px; }}
  .total-row {{ background:#f0f7ff; border-radius:10px; padding:16px; margin-top:20px; }}
  .total-amount {{ font-size:28px; font-weight:900; color:#0F1729; }}
  .badge {{ display:inline-block; background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; border-radius:20px; padding:4px 12px; font-size:12px; font-weight:600; margin:12px 0; }}
  .footer {{ background:#f9fafb; padding:20px 30px; font-size:12px; color:#9ca3af; text-align:center; }}
  .vat-note {{ font-size:11px; color:#6b7280; margin-top:4px; }}
</style></head>
<body>
<div class="invoice">
  <div class="header">
    <div class="logo">🏢 DataLife Account</div>
    <div class="invoice-title">فاتورة ضريبية رسمية | Official Tax Invoice</div>
    <div style="margin-top:16px;font-size:13px;opacity:0.8">رقم الفاتورة: <strong>{invoice_number}</strong></div>
  </div>
  <div class="body">
    <div class="badge">✅ تم تأكيد الدفع | Payment Confirmed</div>
    <div class="row"><span class="label">الشركة | Company</span><span class="value">{company_name}</span></div>
    <div class="row"><span class="label">الخطة | Plan</span><span class="value">{PLAN_NAMES.get(plan, plan)}</span></div>
    <div class="row"><span class="label">مدة الاشتراك | Duration</span><span class="value">{DURATION_NAMES.get(duration, duration)}</span></div>
    <div class="row"><span class="label">طريقة الدفع | Payment Method</span><span class="value">{PAYMENT_NAMES.get(payment_method, payment_method)}</span></div>
    {f'<div class="row"><span class="label">رقم المرجع | Reference</span><span class="value">{reference}</span></div>' if reference else ''}
    <div class="row"><span class="label">تاريخ الدفع | Payment Date</span><span class="value">{paid_date}</span></div>
    
    <div style="margin-top:20px;padding-top:16px;border-top:2px solid #e5e7eb;">
      <div class="row"><span class="label">المبلغ قبل الضريبة</span><span class="value">{amount_before_vat:,.2f} ج.م</span></div>
      <div class="row"><span class="label">ضريبة القيمة المضافة (14%)</span><span class="value">{vat_amount:,.2f} ج.م</span></div>
      <div class="total-row">
        <div class="label" style="margin-bottom:4px">إجمالي المبلغ المدفوع | Total Paid</div>
        <div class="total-amount">{amount:,.2f} ج.م</div>
        <div class="vat-note">✅ السعر شامل ضريبة القيمة المضافة | Price includes VAT (14%)</div>
      </div>
    </div>
  </div>
  <div class="footer">
    DataLife Account — datalifeaccount.com | info@datalifeai.com<br/>
    هذه الفاتورة مُنشأة تلقائياً وصالحة بدون توقيع | Auto-generated invoice, valid without signature
  </div>
</div>
</body></html>"""

        resend.Emails.send({
            "from": "DataLife Account <noreply@datalifeaccount.com>",
            "to": [company_email],
            "subject": f"✅ فاتورة DataLife Account — {invoice_number} | {company_name}",
            "html": html_body,
        })
        return True
    except Exception:
        return False


async def send_welcome_email(
    company_name: str,
    company_email: str,
    user_name: str = "",
    plan: str = "trial",
):
    """إيميل ترحيب عند تسجيل شركة جديدة"""
    try:
        import resend, os
        from datetime import datetime, timezone

        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        if not resend.api_key:
            return False

        PLAN_LABELS = {
            "trial":        "تجريبي مجاني (14 يوم)",
            "starter":      "المبتدئ",
            "professional": "المحترف",
            "enterprise":   "المؤسسي",
        }

        # DataLife Logo SVG (inline)
        LOGO_SVG = """<svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="44" height="44" rx="12" fill="url(#grad)"/>
  <defs><linearGradient id="grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#f59e0b"/>
    <stop offset="100%" stop-color="#f97316"/>
  </linearGradient></defs>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
    font-family="Arial Black, sans-serif" font-size="22" font-weight="900" fill="white">D</text>
</svg>"""

        html_body = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>مرحباً بكم في DataLife Account</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }}
  .wrapper {{ max-width: 600px; margin: 32px auto; padding: 0 16px 40px; }}

  /* Header */
  .header {{ background: linear-gradient(135deg, #0F1729 0%, #1e3a8a 60%, #1d4ed8 100%); border-radius: 20px 20px 0 0; padding: 40px 32px 32px; text-align: center; }}
  .logo-wrap {{ display: inline-flex; align-items: center; gap: 12px; margin-bottom: 24px; }}
  .logo-text {{ font-size: 20px; font-weight: 900; color: white; letter-spacing: -0.5px; }}
  .logo-sub {{ font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 400; display: block; text-align: right; }}
  .header-wave {{ color: rgba(255,255,255,0.15); font-size: 64px; line-height: 1; margin-bottom: 12px; }}
  .header h1 {{ color: white; font-size: 26px; font-weight: 900; margin-bottom: 8px; }}
  .header p {{ color: rgba(255,255,255,0.7); font-size: 15px; }}

  /* Badge */
  .badge-wrap {{ background: linear-gradient(135deg, #0F1729, #1e3a8a); padding: 0 32px; }}
  .plan-badge {{ background: linear-gradient(90deg, #f59e0b, #f97316); color: white; text-align: center; padding: 10px 24px; font-size: 14px; font-weight: 700; border-radius: 0 0 16px 16px; display: inline-block; margin: 0 auto; width: 100%; }}

  /* Body */
  .body {{ background: white; padding: 36px 32px; }}
  .greeting {{ font-size: 16px; color: #1f2937; line-height: 1.7; margin-bottom: 24px; }}
  .greeting strong {{ color: #0F1729; }}

  /* Features */
  .features-title {{ font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 14px; }}
  .feature {{ display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; padding: 14px 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }}
  .feature-icon {{ font-size: 24px; flex-shrink: 0; }}
  .feature-title {{ font-size: 14px; font-weight: 700; color: #0F1729; }}
  .feature-desc {{ font-size: 12px; color: #6b7280; margin-top: 2px; }}

  /* CTA */
  .cta-wrap {{ text-align: center; margin: 32px 0; }}
  .cta {{ display: inline-block; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: white !important; text-decoration: none; padding: 16px 48px; border-radius: 14px; font-size: 16px; font-weight: 800; letter-spacing: 0.3px; box-shadow: 0 4px 15px rgba(30,58,138,0.35); }}

  /* Info box */
  .info-box {{ background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border: 1px solid #bae6fd; border-radius: 14px; padding: 20px 24px; margin-top: 24px; }}
  .info-box h4 {{ font-size: 14px; font-weight: 700; color: #0369a1; margin-bottom: 10px; }}
  .info-row {{ display: flex; justify-content: space-between; font-size: 13px; padding: 5px 0; border-bottom: 1px dashed #bae6fd; }}
  .info-row:last-child {{ border-bottom: none; }}
  .info-label {{ color: #64748b; }}
  .info-value {{ font-weight: 600; color: #0F1729; }}

  /* Support */
  .support {{ text-align: center; margin-top: 28px; padding: 20px; background: #fefce8; border: 1px solid #fde68a; border-radius: 12px; }}
  .support p {{ font-size: 13px; color: #92400e; }}
  .support a {{ color: #1e3a8a; font-weight: 700; text-decoration: none; }}

  /* Footer */
  .footer {{ background: #1e293b; border-radius: 0 0 20px 20px; padding: 28px 32px; text-align: center; }}
  .footer-logo {{ display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 14px; }}
  .footer-logo-text {{ font-size: 16px; font-weight: 900; color: white; }}
  .footer p {{ font-size: 12px; color: #94a3b8; line-height: 1.8; }}
  .footer a {{ color: #60a5fa; text-decoration: none; }}
  .social {{ margin-top: 16px; }}
  .social a {{ display: inline-block; background: rgba(255,255,255,0.08); color: #94a3b8; border-radius: 8px; padding: 6px 14px; font-size: 12px; margin: 0 4px; text-decoration: none; }}
  .divider {{ height: 1px; background: #334155; margin: 16px 0; }}
</style>
</head>
<body>
<div class="wrapper">

  <!-- HEADER -->
  <div class="header">
    <!-- Logo -->
    <div class="logo-wrap">
      {LOGO_SVG}
      <div>
        <span class="logo-text">DataLife Account</span>
        <span class="logo-sub">نظام ERP المصري الأول</span>
      </div>
    </div>
    <div class="header-wave">🎉</div>
    <h1>أهلاً وسهلاً!</h1>
    <p>يسعدنا انضمامك إلى عائلة DataLife Account</p>
  </div>

  <!-- PLAN BADGE -->
  <div class="badge-wrap">
    <div class="plan-badge">
      ⭐ الحساب التجريبي المجاني — 14 يوم كامل بدون قيود
    </div>
  </div>

  <!-- BODY -->
  <div class="body">
    <p class="greeting">
      مرحباً <strong>{user_name or company_name}</strong>،<br><br>
      شكراً لتسجيلك في <strong>DataLife Account</strong> — النظام المحاسبي وإدارة الموارد البشرية
      المصمم خصيصاً للشركات المصرية. سجّلت بنجاح شركة <strong>{company_name}</strong>
      وأصبح حسابك جاهزاً للاستخدام الفوري.
    </p>

    <!-- Features -->
    <p class="features-title">✨ ما يمكنك فعله الآن:</p>

    <div class="feature">
      <span class="feature-icon">👥</span>
      <div>
        <p class="feature-title">إدارة الموارد البشرية</p>
        <p class="feature-desc">أضف موظفيك، حضور GPS، كشف مرتبات تلقائي وفق قانون 148/2019</p>
      </div>
    </div>

    <div class="feature">
      <span class="feature-icon">💰</span>
      <div>
        <p class="feature-title">المحاسبة المالية الكاملة</p>
        <p class="feature-desc">108 حساب وفق الدليل المصري، أستاذ عام، ميزانية، قائمة دخل</p>
      </div>
    </div>

    <div class="feature">
      <span class="feature-icon">📄</span>
      <div>
        <p class="feature-title">الفواتير والمشتريات</p>
        <p class="feature-desc">فواتير إلكترونية ETA، مشتريات، مخزون، عملاء وموردين</p>
      </div>
    </div>

    <div class="feature">
      <span class="feature-icon">🗺️</span>
      <div>
        <p class="feature-title">حضور GPS تلقائي</p>
        <p class="feature-desc">تسجيل حضور الموظفين بالموقع الجغرافي مع نطاق قابل للضبط</p>
      </div>
    </div>

    <!-- CTA -->
    <div class="cta-wrap">
      <a href="https://datalifeaccount.com/dashboard" class="cta">
        🚀 ابدأ الاستخدام الآن
      </a>
    </div>

    <!-- Account Info -->
    <div class="info-box">
      <h4>📋 بيانات حسابك</h4>
      <div class="info-row">
        <span class="info-label">اسم الشركة</span>
        <span class="info-value">{company_name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">البريد الإلكتروني</span>
        <span class="info-value">{company_email}</span>
      </div>
      <div class="info-row">
        <span class="info-label">نوع الحساب</span>
        <span class="info-value">⭐ تجريبي مجاني — 14 يوم</span>
      </div>
      <div class="info-row">
        <span class="info-label">رابط الدخول</span>
        <span class="info-value"><a href="https://datalifeaccount.com" style="color:#1e3a8a;">datalifeaccount.com</a></span>
      </div>
    </div>

    <!-- Support -->
    <div class="support">
      <p>💬 هل تحتاج مساعدة في البداية؟<br>
      تواصل معنا: <a href="mailto:info@datalifeai.com">info@datalifeai.com</a>
      أو زر <a href="https://datalifeaccount.com">دليل الاستخدام</a>
      </p>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-logo">
      {LOGO_SVG}
      <span class="footer-logo-text">DataLife Account</span>
    </div>
    <div class="divider"></div>
    <p>
      © 2026 DataLife Account — جميع الحقوق محفوظة<br>
      <a href="https://datalifeaccount.com">datalifeaccount.com</a> |
      <a href="mailto:info@datalifeai.com">info@datalifeai.com</a>
    </p>
    <div class="social">
      <a href="https://datalifeaccount.com/terms">الشروط والأحكام</a>
      <a href="https://datalifeaccount.com/privacy">الخصوصية</a>
      <a href="https://datalifeaccount.com/contact">تواصل معنا</a>
    </div>
  </div>

</div>
</body>
</html>"""

        resend.Emails.send({
            "from": "DataLife Account <noreply@datalifeaccount.com>",
            "to": [company_email],
            "subject": f"🎉 أهلاً بك في DataLife Account — {company_name}",
            "html": html_body,
        })
        return True
    except Exception:
        return False


# ══════════════════════════════════════════════════════════════
# Shared email helpers
# ══════════════════════════════════════════════════════════════

def _email_base(header_gradient: str, icon: str, title: str, subtitle: str, badge_color: str, badge_text: str, body_html: str, cta_url: str = "", cta_text: str = "") -> str:
    """Base HTML template for all transactional emails"""
    LOGO_SVG = """<svg width="40" height="40" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="44" height="44" rx="12" fill="url(#dg)"/>
  <defs><linearGradient id="dg" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#f97316"/>
  </linearGradient></defs>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
    font-family="Arial Black,sans-serif" font-size="22" font-weight="900" fill="white">D</text>
</svg>"""

    cta_block = f"""<div style="text-align:center;margin:28px 0;">
      <a href="{cta_url}" style="display:inline-block;background:{badge_color};color:white;text-decoration:none;padding:15px 44px;border-radius:12px;font-size:15px;font-weight:800;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(0,0,0,0.2);">{cta_text}</a>
    </div>""" if cta_url else ""

    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#f1f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl}}
.wrap{{max-width:600px;margin:28px auto;padding:0 16px 36px}}
.head{{background:{header_gradient};border-radius:20px 20px 0 0;padding:36px 32px 28px;text-align:center}}
.logo-row{{display:inline-flex;align-items:center;gap:10px;margin-bottom:22px}}
.logo-name{{font-size:18px;font-weight:900;color:white}}
.logo-tag{{font-size:10px;color:rgba(255,255,255,0.45);display:block;text-align:right}}
.big-icon{{font-size:52px;line-height:1;margin-bottom:10px}}
.head h1{{color:white;font-size:24px;font-weight:900;margin-bottom:6px}}
.head p{{color:rgba(255,255,255,0.72);font-size:14px}}
.badge-strip{{background:{badge_color};color:white;text-align:center;padding:9px 24px;font-size:13px;font-weight:700;display:block;border-radius:0 0 14px 14px}}
.body{{background:white;padding:32px}}
.greeting{{font-size:15px;color:#1f2937;line-height:1.75;margin-bottom:22px}}
.info-card{{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin:16px 0}}
.info-row{{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px dashed #e2e8f0}}
.info-row:last-child{{border:none}}
.il{{color:#64748b}}.iv{{font-weight:600;color:#0f172a}}
.alert{{border-radius:12px;padding:16px 18px;margin:18px 0;font-size:13px;line-height:1.7}}
.alert.warn{{background:#fef3c7;border-right:4px solid #f59e0b;color:#92400e}}
.alert.danger{{background:#fef2f2;border-right:4px solid #ef4444;color:#991b1b}}
.alert.info{{background:#f0f9ff;border-right:4px solid #0ea5e9;color:#0c4a6e}}
.alert.success{{background:#f0fdf4;border-right:4px solid #22c55e;color:#14532d}}
.step{{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px}}
.step-num{{width:28px;height:28px;border-radius:50%;background:{badge_color};color:white;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0}}
.step-text{{font-size:13px;color:#374151;padding-top:4px;line-height:1.6}}
.support{{text-align:center;margin-top:24px;padding:18px;background:#fefce8;border:1px solid #fde68a;border-radius:12px;font-size:13px;color:#92400e}}
.support a{{color:#1e3a8a;font-weight:700;text-decoration:none}}
.foot{{background:#1e293b;border-radius:0 0 20px 20px;padding:24px 32px;text-align:center}}
.foot-row{{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px}}
.foot-name{{font-size:15px;font-weight:900;color:white}}
.divider{{height:1px;background:#334155;margin:12px 0}}
.foot p{{font-size:11px;color:#94a3b8;line-height:1.8}}
.foot a{{color:#60a5fa;text-decoration:none}}
.links a{{display:inline-block;background:rgba(255,255,255,0.07);color:#94a3b8;border-radius:6px;padding:5px 12px;font-size:11px;margin:0 3px;text-decoration:none}}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <div class="logo-row">
      {LOGO_SVG}
      <div><span class="logo-name">DataLife Account</span><span class="logo-tag">نظام ERP المصري الأول</span></div>
    </div>
    <div class="big-icon">{icon}</div>
    <h1>{title}</h1>
    <p>{subtitle}</p>
  </div>
  <div style="background:{badge_color};padding:0 32px">
    <div class="badge-strip">{badge_text}</div>
  </div>
  <div class="body">
    {body_html}
    {cta_block}
    <div class="support">
      💬 هل تحتاج مساعدة؟ تواصل معنا:
      <a href="mailto:info@datalifeai.com">info@datalifeai.com</a> |
      <a href="https://datalifeaccount.com">datalifeaccount.com</a>
    </div>
  </div>
  <div class="foot">
    <div class="foot-row">
      {LOGO_SVG}
      <span class="foot-name">DataLife Account</span>
    </div>
    <div class="divider"></div>
    <p>© 2026 DataLife Account — جميع الحقوق محفوظة<br>
       <a href="https://datalifeaccount.com">datalifeaccount.com</a> |
       <a href="mailto:info@datalifeai.com">info@datalifeai.com</a>
    </p>
    <div class="links" style="margin-top:10px">
      <a href="https://datalifeaccount.com/terms">الشروط</a>
      <a href="https://datalifeaccount.com/privacy">الخصوصية</a>
      <a href="https://datalifeaccount.com/contact">تواصل معنا</a>
    </div>
  </div>
</div>
</body></html>"""


# ══════════════════════════════════════════════════════════════
# 1. Password Reset OTP
# ══════════════════════════════════════════════════════════════

async def send_password_reset_email(user_name: str, email: str, otp: str) -> bool:
    """إيميل إعادة تعيين كلمة المرور"""
    try:
        import resend, os
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        if not resend.api_key: return False

        body = f"""
<p class="greeting">مرحباً <strong>{user_name}</strong>،<br><br>
تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في DataLife Account.
استخدم الكود التالي لإتمام العملية:</p>

<div style="text-align:center;margin:28px 0">
  <div style="display:inline-block;background:linear-gradient(135deg,#dc2626,#b91c1c);color:white;font-size:40px;font-weight:900;letter-spacing:12px;padding:20px 40px;border-radius:16px;font-family:monospace;">{otp}</div>
  <p style="font-size:12px;color:#6b7280;margin-top:10px">⏱️ صالح لمدة 15 دقيقة فقط</p>
</div>

<div class="alert danger">
  <strong>⚠️ تحذير أمني:</strong> إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذا الإيميل فوراً.
  حسابك في أمان ولن يتغير شيء.
</div>

<div class="info-card">
  <div class="info-row"><span class="il">البريد الإلكتروني</span><span class="iv">{email}</span></div>
  <div class="info-row"><span class="il">الكود</span><span class="iv" style="font-family:monospace;font-size:18px;color:#dc2626;letter-spacing:4px">{otp}</span></div>
  <div class="info-row"><span class="il">ينتهي خلال</span><span class="iv">15 دقيقة</span></div>
</div>"""

        resend.Emails.send({
            "from": "DataLife Account <noreply@datalifeaccount.com>",
            "to": [email],
            "subject": f"🔐 كود إعادة تعيين كلمة المرور — {otp}",
            "html": _email_base(
                header_gradient="linear-gradient(135deg,#7f1d1d,#dc2626,#ef4444)",
                icon="🔐", title="إعادة تعيين كلمة المرور",
                subtitle="استخدم الكود أدناه لإعادة ضبط كلمة مرورك",
                badge_color="#dc2626", badge_text="🔑 الكود صالح لمدة 15 دقيقة فقط",
                body_html=body,
                cta_url="https://datalifeaccount.com/login", cta_text="🔐 تسجيل الدخول",
            ),
        })
        return True
    except Exception: return False


# ══════════════════════════════════════════════════════════════
# 2. Password Changed Confirmation
# ══════════════════════════════════════════════════════════════

async def send_password_changed_email(user_name: str, email: str) -> bool:
    """تأكيد تغيير كلمة المرور"""
    try:
        import resend, os
        from datetime import datetime, timezone
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        if not resend.api_key: return False

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        body = f"""
<p class="greeting">مرحباً <strong>{user_name}</strong>،<br><br>
تم تغيير كلمة المرور لحسابك في DataLife Account بنجاح.</p>

<div class="alert success">
  ✅ تم تحديث كلمة المرور بنجاح في {now}
</div>

<div class="alert danger">
  <strong>🚨 لم تقم بهذا التغيير؟</strong><br>
  إذا لم تقم أنت بتغيير كلمة المرور، تواصل معنا فوراً على
  <a href="mailto:info@datalifeai.com" style="color:#991b1b;font-weight:700;">info@datalifeai.com</a>
  لتأمين حسابك.
</div>

<div class="info-card">
  <div class="info-row"><span class="il">البريد الإلكتروني</span><span class="iv">{email}</span></div>
  <div class="info-row"><span class="il">وقت التغيير</span><span class="iv">{now}</span></div>
  <div class="info-row"><span class="il">الحالة</span><span class="iv" style="color:#16a34a">✅ تم التغيير بنجاح</span></div>
</div>"""

        resend.Emails.send({
            "from": "DataLife Account <noreply@datalifeaccount.com>",
            "to": [email],
            "subject": "🔒 تم تغيير كلمة المرور بنجاح — DataLife Account",
            "html": _email_base(
                header_gradient="linear-gradient(135deg,#14532d,#16a34a,#22c55e)",
                icon="🔒", title="تم تغيير كلمة المرور",
                subtitle="تم تحديث كلمة مرور حسابك بنجاح",
                badge_color="#16a34a", badge_text="✅ حسابك آمن ومحمي",
                body_html=body,
                cta_url="https://datalifeaccount.com/login", cta_text="🚀 تسجيل الدخول",
            ),
        })
        return True
    except Exception: return False


# ══════════════════════════════════════════════════════════════
# 3. Account Login Alert (new device/location)
# ══════════════════════════════════════════════════════════════

async def send_login_alert_email(user_name: str, email: str, ip: str = "", time_str: str = "") -> bool:
    """تنبيه تسجيل دخول من جهاز/مكان جديد"""
    try:
        import resend, os
        from datetime import datetime, timezone
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        if not resend.api_key: return False

        now = time_str or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        body = f"""
<p class="greeting">مرحباً <strong>{user_name}</strong>،<br><br>
تم تسجيل الدخول إلى حسابك في DataLife Account.</p>

<div class="info-card">
  <div class="info-row"><span class="il">البريد الإلكتروني</span><span class="iv">{email}</span></div>
  <div class="info-row"><span class="il">وقت الدخول</span><span class="iv">{now}</span></div>
  {f'<div class="info-row"><span class="il">عنوان IP</span><span class="iv" style="font-family:monospace">{ip}</span></div>' if ip else ''}
</div>

<div class="alert warn">
  <strong>⚠️ لم تكن أنت؟</strong><br>
  إذا لم تقم بتسجيل الدخول، قم فوراً بتغيير كلمة المرور وتواصل معنا على
  <a href="mailto:info@datalifeai.com" style="color:#92400e;font-weight:700;">info@datalifeai.com</a>
</div>"""

        resend.Emails.send({
            "from": "DataLife Account <noreply@datalifeaccount.com>",
            "to": [email],
            "subject": "🔔 تنبيه: تسجيل دخول جديد — DataLife Account",
            "html": _email_base(
                header_gradient="linear-gradient(135deg,#78350f,#d97706,#fbbf24)",
                icon="🔔", title="تنبيه تسجيل دخول",
                subtitle="تم تسجيل الدخول إلى حسابك",
                badge_color="#d97706", badge_text="⚠️ إذا لم تكن أنت — غيّر كلمة المرور فوراً",
                body_html=body,
                cta_url="https://datalifeaccount.com/settings", cta_text="🔐 تغيير كلمة المرور",
            ),
        })
        return True
    except Exception: return False


# ══════════════════════════════════════════════════════════════
# 4. Subscription Renewal Reminder
# ══════════════════════════════════════════════════════════════

async def send_renewal_reminder_email(
    company_name: str, email: str,
    plan: str, days_left: int, end_date: str
) -> bool:
    """تذكير تجديد الاشتراك"""
    try:
        import resend, os
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        if not resend.api_key: return False

        PLAN_PRICES = {"starter":"299 ج.م/شهر","professional":"799 ج.م/شهر","enterprise":"1,499 ج.م/شهر"}
        urgency = "danger" if days_left <= 3 else ("warn" if days_left <= 7 else "info")
        urgency_icon = "🚨" if days_left <= 3 else ("⚠️" if days_left <= 7 else "📅")

        body = f"""
<p class="greeting">مرحباً <strong>{company_name}</strong>،<br><br>
نود تذكيركم بأن اشتراككم في DataLife Account سينتهي قريباً. جددوا الآن لضمان الاستمرارية بدون انقطاع.</p>

<div class="alert {urgency}">
  {urgency_icon} <strong>متبقي {days_left} {'يوم' if days_left == 1 else 'أيام'} فقط</strong> — ينتهي الاشتراك في {end_date}
</div>

<div class="info-card">
  <div class="info-row"><span class="il">الشركة</span><span class="iv">{company_name}</span></div>
  <div class="info-row"><span class="il">الخطة الحالية</span><span class="iv">{plan}</span></div>
  <div class="info-row"><span class="il">تاريخ الانتهاء</span><span class="iv" style="color:#dc2626">{end_date}</span></div>
  <div class="info-row"><span class="il">السعر</span><span class="iv">{PLAN_PRICES.get(plan,"—")}</span></div>
</div>

<p style="font-size:13px;color:#374151;margin:16px 0">طرق الدفع المتاحة:</p>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
  {''.join(f'<span style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:6px 12px;font-size:12px;color:#0369a1">{m}</span>' for m in ['📱 InstaPay','📲 فودافون كاش','🏦 تحويل بنكي','🔑 كود تفعيل'])}
</div>"""

        resend.Emails.send({
            "from": "DataLife Account <noreply@datalifeaccount.com>",
            "to": [email],
            "subject": f"{'🚨' if days_left<=3 else '⏰'} تذكير تجديد اشتراكك — {days_left} أيام متبقية | DataLife Account",
            "html": _email_base(
                header_gradient="linear-gradient(135deg,#78350f,#b45309,#d97706)",
                icon="⏰", title="تذكير تجديد الاشتراك",
                subtitle=f"اشتراكك ينتهي خلال {days_left} أيام",
                badge_color="#b45309", badge_text=f"📅 تاريخ الانتهاء: {end_date}",
                body_html=body,
                cta_url="https://datalifeaccount.com", cta_text="🔄 جدد الاشتراك الآن",
            ),
        })
        return True
    except Exception: return False


# ══════════════════════════════════════════════════════════════
# 5. Subscription Expired
# ══════════════════════════════════════════════════════════════

async def send_subscription_expired_email(company_name: str, email: str, plan: str) -> bool:
    """إيميل انتهاء الاشتراك"""
    try:
        import resend, os
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        if not resend.api_key: return False

        body = f"""
<p class="greeting">مرحباً <strong>{company_name}</strong>،<br><br>
انتهت صلاحية اشتراكك في DataLife Account. بياناتك محفوظة ومؤمّنة، لكن تم تعليق الوصول مؤقتاً.</p>

<div class="alert danger">
  🚫 <strong>تم تعليق الوصول إلى حسابك</strong><br>
  جدد اشتراكك الآن لاستعادة الوصول الكامل لجميع البيانات والمميزات.
</div>

<div class="info-card">
  <div class="info-row"><span class="il">الشركة</span><span class="iv">{company_name}</span></div>
  <div class="info-row"><span class="il">الخطة المنتهية</span><span class="iv">{plan}</span></div>
  <div class="info-row"><span class="il">حالة البيانات</span><span class="iv" style="color:#16a34a">✅ محفوظة ومؤمّنة</span></div>
  <div class="info-row"><span class="il">مهلة التجديد</span><span class="iv" style="color:#dc2626">30 يوم من تاريخ الانتهاء</span></div>
</div>

<div class="alert warn">
  ⚠️ <strong>تنبيه:</strong> إذا لم يتم التجديد خلال 30 يوماً، سيتم حذف البيانات نهائياً وفق سياسة الخصوصية.
</div>"""

        resend.Emails.send({
            "from": "DataLife Account <noreply@datalifeaccount.com>",
            "to": [email],
            "subject": "🚫 انتهى اشتراكك في DataLife Account — جدد الآن",
            "html": _email_base(
                header_gradient="linear-gradient(135deg,#1c1917,#57534e,#78716c)",
                icon="🚫", title="انتهى الاشتراك",
                subtitle="بياناتك محفوظة — جدد الآن للعودة",
                badge_color="#dc2626", badge_text="⚡ جدد خلال 30 يوم لتجنب حذف البيانات",
                body_html=body,
                cta_url="https://datalifeaccount.com", cta_text="🔄 جدد الاشتراك الآن",
            ),
        })
        return True
    except Exception: return False


# ══════════════════════════════════════════════════════════════
# 6. System Maintenance / Downtime Alert
# ══════════════════════════════════════════════════════════════

async def send_maintenance_email(
    email: str, company_name: str,
    start_time: str, duration: str, reason: str = ""
) -> bool:
    """إيميل صيانة وتوقف مؤقت"""
    try:
        import resend, os
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        if not resend.api_key: return False

        body = f"""
<p class="greeting">مرحباً <strong>{company_name}</strong>،<br><br>
نعلمكم بأنه سيتم إجراء أعمال صيانة مجدولة على نظام DataLife Account. خلال هذه الفترة قد يكون النظام غير متاح مؤقتاً.</p>

<div class="alert warn">
  🔧 <strong>فترة الصيانة المجدولة:</strong><br>
  تبدأ: {start_time} | المدة المتوقعة: {duration}
</div>

<div class="info-card">
  <div class="info-row"><span class="il">وقت البدء</span><span class="iv">{start_time}</span></div>
  <div class="info-row"><span class="il">المدة المتوقعة</span><span class="iv">{duration}</span></div>
  {f'<div class="info-row"><span class="il">السبب</span><span class="iv">{reason}</span></div>' if reason else ''}
  <div class="info-row"><span class="il">الحالة بعد الصيانة</span><span class="iv" style="color:#16a34a">✅ أداء وأمان أفضل</span></div>
</div>

<div class="alert info">
  💡 <strong>نصيحة:</strong> احرص على حفظ أي عمل جارٍ قبل وقت الصيانة. سيعود النظام للعمل تلقائياً بعد انتهاء الصيانة.
</div>

<p style="font-size:13px;color:#374151;margin-top:16px">نعتذر عن أي إزعاج. نسعى دائماً لتحسين تجربتكم.</p>"""

        resend.Emails.send({
            "from": "DataLife Account <noreply@datalifeaccount.com>",
            "to": [email],
            "subject": f"🔧 صيانة مجدولة — {start_time} | DataLife Account",
            "html": _email_base(
                header_gradient="linear-gradient(135deg,#1e3a5f,#1e40af,#3b82f6)",
                icon="🔧", title="صيانة مجدولة للنظام",
                subtitle="توقف مؤقت لتحسين الأداء والأمان",
                badge_color="#2563eb", badge_text=f"🕐 موعد الصيانة: {start_time}",
                body_html=body,
            ),
        })
        return True
    except Exception: return False


# ══════════════════════════════════════════════════════════════
# 7. Account Suspended / Reactivated
# ══════════════════════════════════════════════════════════════

async def send_account_status_email(
    company_name: str, email: str,
    is_suspended: bool, reason: str = ""
) -> bool:
    """إيميل تعليق أو إعادة تفعيل الحساب"""
    try:
        import resend, os
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        if not resend.api_key: return False

        if is_suspended:
            body = f"""
<p class="greeting">مرحباً <strong>{company_name}</strong>،<br><br>
تم تعليق حسابكم في DataLife Account مؤقتاً.</p>

<div class="alert danger">
  🚫 <strong>سبب التعليق:</strong> {reason or 'انتهاء فترة الاشتراك أو مخالفة شروط الاستخدام'}
</div>

<div class="info-card">
  <div class="info-row"><span class="il">الحالة</span><span class="iv" style="color:#dc2626">🚫 موقوف مؤقتاً</span></div>
  <div class="info-row"><span class="il">البيانات</span><span class="iv" style="color:#16a34a">✅ محفوظة ومؤمّنة</span></div>
</div>

<p style="font-size:13px;color:#374151;margin-top:16px">لإعادة تفعيل حسابك، تواصل معنا أو جدد اشتراكك.</p>"""
            subject = "🚫 تم تعليق حسابك مؤقتاً — DataLife Account"
            gradient = "linear-gradient(135deg,#450a0a,#991b1b,#dc2626)"
            icon, badge_color, badge_text = "🚫", "#dc2626", "تواصل معنا لإعادة التفعيل"
            cta_url, cta_text = "mailto:info@datalifeai.com", "📧 تواصل معنا"
        else:
            body = f"""
<p class="greeting">مرحباً <strong>{company_name}</strong>،<br><br>
يسعدنا إعلامكم بأنه تم إعادة تفعيل حسابكم في DataLife Account بنجاح.</p>

<div class="alert success">
  ✅ <strong>حسابك نشط الآن</strong> — يمكنك الوصول لجميع المميزات والبيانات
</div>"""
            subject = "✅ تم إعادة تفعيل حسابك — DataLife Account"
            gradient = "linear-gradient(135deg,#14532d,#16a34a,#22c55e)"
            icon, badge_color, badge_text = "✅", "#16a34a", "حسابك نشط ومفعّل الآن"
            cta_url, cta_text = "https://datalifeaccount.com/dashboard", "🚀 الدخول للحساب"

        resend.Emails.send({
            "from": "DataLife Account <noreply@datalifeaccount.com>",
            "to": [email],
            "subject": subject,
            "html": _email_base(
                header_gradient=gradient, icon=icon,
                title="تعليق الحساب" if is_suspended else "إعادة تفعيل الحساب",
                subtitle="إشعار من DataLife Account",
                badge_color=badge_color, badge_text=badge_text,
                body_html=body, cta_url=cta_url, cta_text=cta_text,
            ),
        })
        return True
    except Exception: return False
