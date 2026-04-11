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
        """قالب البريد الإلكتروني الأساسي الاحترافي"""
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
