"""
Email Notifications API
نظام إشعارات البريد الإلكتروني
"""

import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, EmailStr
from bson import ObjectId
import resend
from dotenv import load_dotenv

from api.users import get_current_user
from database import db

load_dotenv()

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

# Resend Configuration
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# ==========================================
# Models
# ==========================================

class EmailRequest(BaseModel):
    recipient_email: EmailStr
    subject: str
    html_content: str

class NotificationSettings(BaseModel):
    """إعدادات الإشعارات للشركة"""
    email_notifications_enabled: bool = True
    # إشعارات البنك
    notify_large_transactions: bool = True
    large_transaction_threshold: float = 100000
    # إشعارات الرواتب
    notify_payroll_ready: bool = True
    notify_employees_payslip: bool = True
    # إشعارات العقود والإجازات
    notify_contract_expiry: bool = True
    contract_expiry_days: int = 30
    notify_leave_expiry: bool = True
    leave_expiry_days: int = 30
    # إشعارات الفواتير
    notify_invoice_due: bool = True
    invoice_due_days: int = 7
    notify_new_invoice: bool = True
    # إشعارات الموافقات
    notify_pending_approvals: bool = True
    # قائمة المستلمين الإداريين
    admin_emails: List[str] = []

class BulkEmailRequest(BaseModel):
    """إرسال بريد جماعي"""
    recipient_emails: List[EmailStr]
    subject: str
    html_content: str

# ==========================================
# Email Templates
# ==========================================

def get_email_template(title: str, content: str, footer_text: str = "DataLife Account") -> str:
    """قالب البريد الإلكتروني الأساسي مع دعم RTL"""
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
                            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">{title}</h1>
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
                                <p style="margin: 0; color: #6c757d; font-size: 14px;">{footer_text}</p>
                                <p style="margin: 5px 0 0 0; color: #adb5bd; font-size: 12px;">هذا البريد آلي، يرجى عدم الرد عليه</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

def get_transaction_alert_template(transaction_type: str, amount: float, bank_name: str, description: str) -> str:
    """قالب تنبيه المعاملة البنكية"""
    type_labels = {
        "deposit": "إيداع",
        "withdrawal": "سحب",
        "check_deposit": "شيك وارد",
        "check_issued": "شيك صادر",
        "transfer_in": "تحويل وارد",
        "transfer_out": "تحويل صادر"
    }
    type_colors = {
        "deposit": "#28a745",
        "withdrawal": "#dc3545",
        "check_deposit": "#17a2b8",
        "check_issued": "#fd7e14"
    }
    
    type_label = type_labels.get(transaction_type, transaction_type)
    type_color = type_colors.get(transaction_type, "#6c757d")
    
    content = f"""
    <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <p style="margin: 0; color: #856404; font-weight: bold;">⚠️ تنبيه: معاملة بنكية كبيرة</p>
    </div>
    
    <table width="100%" style="border-collapse: collapse;">
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold;">نوع المعاملة:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">
                <span style="background-color: {type_color}; color: white; padding: 5px 15px; border-radius: 20px;">{type_label}</span>
            </td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold;">المبلغ:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-size: 20px; color: {type_color}; font-weight: bold;">{amount:,.2f} ج.م</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold;">البنك:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">{bank_name}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold;">الوصف:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">{description}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">التاريخ:</td>
            <td style="padding: 10px;">{datetime.now().strftime('%Y-%m-%d %H:%M')}</td>
        </tr>
    </table>
    """
    
    return get_email_template("تنبيه معاملة بنكية", content)

def get_payslip_template(employee_name: str, month: str, basic_salary: float, 
                         allowances: float, deductions: float, net_salary: float) -> str:
    """قالب كشف الراتب"""
    content = f"""
    <p style="font-size: 18px;">مرحباً <strong>{employee_name}</strong>،</p>
    <p>نرفق لك كشف راتبك عن شهر <strong>{month}</strong>:</p>
    
    <table width="100%" style="border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">الراتب الأساسي</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: left;">{basic_salary:,.2f} ج.م</td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; color: #28a745;">+ البدلات</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: left; color: #28a745;">{allowances:,.2f} ج.م</td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; color: #dc3545;">- الاستقطاعات</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: left; color: #dc3545;">{deductions:,.2f} ج.م</td>
        </tr>
        <tr style="background-color: #1e3a5f;">
            <td style="padding: 15px; border: 1px solid #dee2e6; font-weight: bold; color: white; font-size: 16px;">صافي الراتب</td>
            <td style="padding: 15px; border: 1px solid #dee2e6; text-align: left; color: white; font-size: 20px; font-weight: bold;">{net_salary:,.2f} ج.م</td>
        </tr>
    </table>
    
    <p style="color: #6c757d; font-size: 14px;">في حالة وجود أي استفسار، يرجى التواصل مع قسم الموارد البشرية.</p>
    """
    
    return get_email_template(f"كشف راتب - {month}", content)

def get_contract_expiry_template(employee_name: str, contract_end: str, days_remaining: int) -> str:
    """قالب انتهاء العقد"""
    urgency_color = "#dc3545" if days_remaining <= 7 else "#ffc107" if days_remaining <= 14 else "#17a2b8"
    
    content = f"""
    <div style="background-color: {urgency_color}20; border: 2px solid {urgency_color}; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
        <p style="margin: 0; font-size: 48px;">⏰</p>
        <p style="margin: 10px 0 0 0; color: {urgency_color}; font-weight: bold; font-size: 18px;">
            متبقي {days_remaining} يوم على انتهاء العقد
        </p>
    </div>
    
    <table width="100%" style="border-collapse: collapse;">
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold;">الموظف:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">{employee_name}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold;">تاريخ انتهاء العقد:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">{contract_end}</td>
        </tr>
    </table>
    
    <p style="margin-top: 20px;">يرجى اتخاذ الإجراء المناسب (تجديد العقد أو إنهاء الخدمة).</p>
    """
    
    return get_email_template("تنبيه: انتهاء عقد موظف", content)

def get_invoice_due_template(invoice_number: str, customer_name: str, amount: float, 
                             due_date: str, days_overdue: int) -> str:
    """قالب الفاتورة المستحقة"""
    status_text = f"متأخرة {days_overdue} يوم" if days_overdue > 0 else f"مستحقة خلال {abs(days_overdue)} يوم"
    status_color = "#dc3545" if days_overdue > 0 else "#ffc107"
    
    content = f"""
    <div style="background-color: {status_color}20; border: 1px solid {status_color}; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <p style="margin: 0; color: {status_color}; font-weight: bold;">📄 فاتورة {status_text}</p>
    </div>
    
    <table width="100%" style="border-collapse: collapse;">
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold;">رقم الفاتورة:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">{invoice_number}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold;">العميل:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">{customer_name}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold;">المبلغ:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-size: 18px; font-weight: bold; color: {status_color};">{amount:,.2f} ج.م</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">تاريخ الاستحقاق:</td>
            <td style="padding: 10px;">{due_date}</td>
        </tr>
    </table>
    """
    
    return get_email_template("تنبيه: فاتورة مستحقة", content)

def get_approval_needed_template(request_type: str, requester_name: str, 
                                  description: str, amount: Optional[float] = None) -> str:
    """قالب طلب موافقة"""
    amount_row = f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold;">المبلغ:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold; color: #1e3a5f;">{amount:,.2f} ج.م</td>
        </tr>
    """ if amount else ""
    
    content = f"""
    <div style="background-color: #cce5ff; border: 1px solid #0d6efd; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <p style="margin: 0; color: #0d6efd; font-weight: bold;">🔔 طلب موافقة جديد</p>
    </div>
    
    <table width="100%" style="border-collapse: collapse;">
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold;">نوع الطلب:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">{request_type}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-weight: bold;">مقدم الطلب:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">{requester_name}</td>
        </tr>
        {amount_row}
        <tr>
            <td style="padding: 10px; font-weight: bold;">الوصف:</td>
            <td style="padding: 10px;">{description}</td>
        </tr>
    </table>
    
    <p style="margin-top: 20px; text-align: center;">
        <a href="#" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 5px;">الموافقة</a>
        <a href="#" style="display: inline-block; background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 5px;">الرفض</a>
    </p>
    """
    
    return get_email_template("طلب موافقة جديد", content)

# ==========================================
# Core Email Functions
# ==========================================

async def send_email_async(to_email: str, subject: str, html_content: str) -> dict:
    """إرسال بريد إلكتروني (غير متزامن)"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured, skipping email")
        return {"status": "skipped", "message": "Email service not configured"}
    
    params = {
        "from": SENDER_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }
    
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}: {subject}")
        return {"status": "success", "email_id": email.get("id")}
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return {"status": "error", "message": str(e)}

async def send_bulk_emails_async(recipients: List[str], subject: str, html_content: str) -> dict:
    """إرسال بريد جماعي"""
    results = {"sent": 0, "failed": 0, "errors": []}
    
    for email in recipients:
        result = await send_email_async(email, subject, html_content)
        if result.get("status") == "success":
            results["sent"] += 1
        else:
            results["failed"] += 1
            results["errors"].append({"email": email, "error": result.get("message")})
    
    return results

# ==========================================
# Notification APIs
# ==========================================

@router.post("/notifications/send-email")
async def send_single_email(
    request: EmailRequest,
    current_user: dict = Depends(get_current_user)
):
    """إرسال بريد إلكتروني واحد"""
    result = await send_email_async(
        request.recipient_email,
        request.subject,
        request.html_content
    )
    
    # Log notification
    await db.notification_logs.insert_one({
        "company_id": current_user["company_id"],
        "type": "email",
        "recipient": request.recipient_email,
        "subject": request.subject,
        "status": result.get("status"),
        "sent_at": datetime.now(timezone.utc),
        "sent_by": current_user["user_id"]
    })
    
    return result

@router.post("/notifications/send-bulk-email")
async def send_bulk_email(
    request: BulkEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """إرسال بريد جماعي (يعمل في الخلفية)"""
    
    async def send_in_background():
        results = await send_bulk_emails_async(
            request.recipient_emails,
            request.subject,
            request.html_content
        )
        
        # Log bulk notification
        await db.notification_logs.insert_one({
            "company_id": current_user["company_id"],
            "type": "bulk_email",
            "recipients_count": len(request.recipient_emails),
            "subject": request.subject,
            "results": results,
            "sent_at": datetime.now(timezone.utc),
            "sent_by": current_user["user_id"]
        })
    
    background_tasks.add_task(asyncio.create_task, send_in_background())
    
    return {
        "status": "queued",
        "message": f"Sending emails to {len(request.recipient_emails)} recipients",
        "recipients_count": len(request.recipient_emails)
    }

@router.get("/notifications/settings")
async def get_notification_settings(current_user: dict = Depends(get_current_user)):
    """جلب إعدادات الإشعارات"""
    company_id = current_user["company_id"]
    
    settings = await db.notification_settings.find_one({"company_id": company_id})
    
    if not settings:
        return NotificationSettings().dict()
    
    # Remove MongoDB _id
    settings.pop("_id", None)
    settings.pop("company_id", None)
    return settings

@router.put("/notifications/settings")
async def update_notification_settings(
    settings: NotificationSettings,
    current_user: dict = Depends(get_current_user)
):
    """تحديث إعدادات الإشعارات"""
    company_id = current_user["company_id"]
    
    settings_dict = settings.dict()
    settings_dict["company_id"] = company_id
    settings_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.notification_settings.update_one(
        {"company_id": company_id},
        {"$set": settings_dict},
        upsert=True
    )
    
    return {"message": "تم تحديث الإعدادات بنجاح"}

@router.get("/notifications/logs")
async def get_notification_logs(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """جلب سجل الإشعارات"""
    company_id = current_user["company_id"]
    
    logs = await db.notification_logs.find(
        {"company_id": company_id}
    ).sort("sent_at", -1).limit(limit).to_list(length=None)
    
    for log in logs:
        log["id"] = str(log["_id"])
        del log["_id"]
    
    return {"logs": logs, "total": len(logs)}

# ==========================================
# Trigger Notifications (Called from other modules)
# ==========================================

@router.post("/notifications/trigger/large-transaction")
async def trigger_large_transaction_notification(
    transaction_type: str,
    amount: float,
    bank_name: str,
    description: str,
    current_user: dict = Depends(get_current_user)
):
    """إرسال إشعار معاملة بنكية كبيرة"""
    company_id = current_user["company_id"]
    
    # Get notification settings
    settings = await db.notification_settings.find_one({"company_id": company_id})
    if not settings or not settings.get("notify_large_transactions", True):
        return {"status": "skipped", "message": "Large transaction notifications disabled"}
    
    threshold = settings.get("large_transaction_threshold", 100000)
    if amount < threshold:
        return {"status": "skipped", "message": f"Amount below threshold ({threshold})"}
    
    # Get admin emails
    admin_emails = settings.get("admin_emails", [])
    if not admin_emails:
        # Get company admin email
        company = await db.companies.find_one({"company_id": company_id})
        if company and company.get("admin_email"):
            admin_emails = [company.get("admin_email")]
    
    if not admin_emails:
        return {"status": "skipped", "message": "No admin emails configured"}
    
    # Send notification
    html_content = get_transaction_alert_template(transaction_type, amount, bank_name, description)
    results = await send_bulk_emails_async(
        admin_emails,
        f"تنبيه: معاملة بنكية بمبلغ {amount:,.0f} ج.م",
        html_content
    )
    
    return {"status": "sent", "results": results}

@router.post("/notifications/trigger/payslips")
async def trigger_payslip_notifications(
    payroll_month: str,
    current_user: dict = Depends(get_current_user)
):
    """إرسال كشوف الرواتب للموظفين"""
    company_id = current_user["company_id"]
    
    # Get notification settings
    settings = await db.notification_settings.find_one({"company_id": company_id})
    if not settings or not settings.get("notify_employees_payslip", True):
        return {"status": "skipped", "message": "Payslip notifications disabled"}
    
    # Get payroll data
    payroll = await db.payroll_runs.find_one({
        "company_id": company_id,
        "month": payroll_month,
        "status": {"$in": ["approved", "paid"]}
    })
    
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found or not approved")
    
    # Get employees with emails
    employees = await db.employees.find({
        "company_id": company_id,
        "email": {"$exists": True, "$ne": ""},
        "is_active": True
    }).to_list(length=None)
    
    sent_count = 0
    for emp in employees:
        # Find employee payroll record
        emp_payroll = None
        for record in payroll.get("employee_records", []):
            if record.get("employee_id") == str(emp.get("_id")):
                emp_payroll = record
                break
        
        if not emp_payroll:
            continue
        
        html_content = get_payslip_template(
            employee_name=emp.get("name", ""),
            month=payroll_month,
            basic_salary=emp_payroll.get("basic_salary", 0),
            allowances=emp_payroll.get("total_allowances", 0),
            deductions=emp_payroll.get("total_deductions", 0),
            net_salary=emp_payroll.get("net_salary", 0)
        )
        
        result = await send_email_async(
            emp.get("email"),
            f"كشف راتب - {payroll_month}",
            html_content
        )
        
        if result.get("status") == "success":
            sent_count += 1
    
    return {"status": "sent", "sent_count": sent_count, "total_employees": len(employees)}

@router.post("/notifications/check-alerts")
async def check_and_send_alerts(
    current_user: dict = Depends(get_current_user)
):
    """فحص وإرسال التنبيهات التلقائية (العقود، الإجازات، الفواتير)"""
    company_id = current_user["company_id"]
    alerts_sent = {"contracts": 0, "invoices": 0, "leaves": 0}
    
    # Get notification settings
    settings = await db.notification_settings.find_one({"company_id": company_id})
    if not settings:
        settings = NotificationSettings().dict()
    
    admin_emails = settings.get("admin_emails", [])
    if not admin_emails:
        company = await db.companies.find_one({"company_id": company_id})
        if company and company.get("admin_email"):
            admin_emails = [company.get("admin_email")]
    
    today = datetime.now(timezone.utc).date()
    
    # Check contract expiries
    if settings.get("notify_contract_expiry", True):
        expiry_days = settings.get("contract_expiry_days", 30)
        check_date = today + timedelta(days=expiry_days)
        
        expiring_contracts = await db.employees.find({
            "company_id": company_id,
            "is_active": True,
            "contract_end_date": {
                "$lte": check_date.isoformat(),
                "$gte": today.isoformat()
            }
        }).to_list(length=None)
        
        for emp in expiring_contracts:
            days_remaining = (datetime.fromisoformat(emp.get("contract_end_date")).date() - today).days
            html_content = get_contract_expiry_template(
                emp.get("name", ""),
                emp.get("contract_end_date", ""),
                days_remaining
            )
            
            if admin_emails:
                await send_bulk_emails_async(
                    admin_emails,
                    f"تنبيه: انتهاء عقد {emp.get('name', '')} خلال {days_remaining} يوم",
                    html_content
                )
                alerts_sent["contracts"] += 1
    
    # Check overdue invoices
    if settings.get("notify_invoice_due", True):
        due_days = settings.get("invoice_due_days", 7)
        check_date = today + timedelta(days=due_days)
        
        due_invoices = await db.invoices.find({
            "company_id": company_id,
            "status": {"$in": ["pending", "sent"]},
            "due_date": {"$lte": check_date.isoformat()}
        }).to_list(length=None)
        
        for inv in due_invoices:
            due_date = datetime.fromisoformat(inv.get("due_date", today.isoformat())).date()
            days_overdue = (today - due_date).days
            
            html_content = get_invoice_due_template(
                inv.get("invoice_number", ""),
                inv.get("customer_name", ""),
                inv.get("total", 0),
                inv.get("due_date", ""),
                days_overdue
            )
            
            if admin_emails:
                await send_bulk_emails_async(
                    admin_emails,
                    f"تنبيه: فاتورة مستحقة #{inv.get('invoice_number', '')}",
                    html_content
                )
                alerts_sent["invoices"] += 1
    
    return {
        "status": "completed",
        "alerts_sent": alerts_sent,
        "total": sum(alerts_sent.values())
    }
