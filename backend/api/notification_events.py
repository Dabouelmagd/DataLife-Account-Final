"""
Notification Events API
نظام أحداث الإشعارات
يتم استدعاء هذه الدوال عند حدوث أحداث معينة في النظام
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient

from services.professional_email_service import email_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notifications", tags=["notifications"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


# ===========================================
# Models
# ===========================================

class NotificationLog(BaseModel):
    """سجل الإشعارات"""
    event_type: str
    recipient_email: str
    subject: str
    status: str  # sent, failed, pending
    company_id: Optional[str] = None
    user_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# ===========================================
# Notification Event Handlers
# ===========================================

async def notify_new_employee(employee_data: Dict, company_id: str, admin_emails: List[str] = None):
    """إشعار بإضافة موظف جديد"""
    try:
        # Get company info
        company = await db.companies.find_one({"company_id": company_id})
        company_name = company.get("name", "الشركة") if company else "الشركة"
        
        # Send welcome email to employee
        if employee_data.get("email"):
            html = email_service.get_welcome_email(
                employee_name=employee_data.get("name", ""),
                company_name=company_name,
                email=employee_data.get("email"),
                temp_password=employee_data.get("temp_password")
            )
            await email_service.send_email(
                to_email=employee_data.get("email"),
                subject=f"مرحباً بك في {company_name}! 🎉",
                html_content=html
            )
        
        # Notify admins
        if admin_emails:
            for admin_email in admin_emails:
                admin = await db.users.find_one({"email": admin_email})
                admin_name = admin.get("name", "المدير") if admin else "المدير"
                
                html = email_service.get_new_user_notification_email(
                    admin_name=admin_name,
                    new_user_name=employee_data.get("name", ""),
                    new_user_email=employee_data.get("email", ""),
                    new_user_role=employee_data.get("role", "موظف"),
                    company_name=company_name
                )
                await email_service.send_email(
                    to_email=admin_email,
                    subject="تمت إضافة موظف جديد 👋",
                    html_content=html
                )
        
        # Log notification
        await db.notification_logs.insert_one({
            "event_type": "new_employee",
            "company_id": company_id,
            "employee_email": employee_data.get("email"),
            "status": "sent",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"New employee notification sent for {employee_data.get('email')}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send new employee notification: {str(e)}")
        return False


async def notify_payroll_processed(payroll_data: Dict, company_id: str):
    """إشعار بمعالجة الرواتب"""
    try:
        employees = payroll_data.get("employees", [])
        month = payroll_data.get("month", "")
        year = payroll_data.get("year", "")
        
        for emp in employees:
            if emp.get("email"):
                html = email_service.get_payslip_email(
                    employee_name=emp.get("name", ""),
                    month=month,
                    year=year,
                    basic_salary=emp.get("basic_salary", 0),
                    allowances=emp.get("total_allowances", 0),
                    deductions=emp.get("total_deductions", 0),
                    net_salary=emp.get("net_salary", 0)
                )
                await email_service.send_email(
                    to_email=emp.get("email"),
                    subject=f"كشف راتب - {month} {year}",
                    html_content=html
                )
        
        logger.info(f"Payroll notifications sent for {len(employees)} employees")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send payroll notifications: {str(e)}")
        return False


async def notify_leave_decision(leave_data: Dict, company_id: str):
    """إشعار بقرار الإجازة"""
    try:
        employee_email = leave_data.get("employee_email")
        if not employee_email:
            return False
        
        html = email_service.get_leave_approval_email(
            employee_name=leave_data.get("employee_name", ""),
            leave_type=leave_data.get("leave_type", "إجازة"),
            start_date=leave_data.get("start_date", ""),
            end_date=leave_data.get("end_date", ""),
            days=leave_data.get("days", 0),
            status=leave_data.get("status", ""),
            approver_name=leave_data.get("approver_name"),
            rejection_reason=leave_data.get("rejection_reason")
        )
        
        status = leave_data.get("status", "").lower()
        is_approved = status in ['approved', 'موافق', 'مقبول']
        
        await email_service.send_email(
            to_email=employee_email,
            subject="تمت الموافقة على إجازتك ✅" if is_approved else "تم رفض طلب الإجازة ❌",
            html_content=html
        )
        
        logger.info(f"Leave decision notification sent to {employee_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send leave notification: {str(e)}")
        return False


async def notify_invoice_created(invoice_data: Dict, company_id: str):
    """إشعار بإنشاء فاتورة"""
    try:
        customer_email = invoice_data.get("customer_email")
        if not customer_email:
            return False
        
        company = await db.companies.find_one({"company_id": company_id})
        company_name = company.get("name", "الشركة") if company else "الشركة"
        
        html = email_service.get_invoice_email(
            customer_name=invoice_data.get("customer_name", ""),
            invoice_number=invoice_data.get("invoice_number", ""),
            amount=invoice_data.get("total", 0),
            due_date=invoice_data.get("due_date", ""),
            company_name=company_name
        )
        
        await email_service.send_email(
            to_email=customer_email,
            subject=f"فاتورة #{invoice_data.get('invoice_number', '')} من {company_name}",
            html_content=html
        )
        
        logger.info(f"Invoice notification sent to {customer_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send invoice notification: {str(e)}")
        return False


async def notify_large_transaction(transaction_data: Dict, company_id: str, admin_emails: List[str]):
    """إشعار بمعاملة بنكية كبيرة"""
    try:
        html = email_service.get_transaction_alert_email(
            transaction_type=transaction_data.get("type", ""),
            amount=transaction_data.get("amount", 0),
            bank_name=transaction_data.get("bank_name", ""),
            description=transaction_data.get("description", "")
        )
        
        for email in admin_emails:
            await email_service.send_email(
                to_email=email,
                subject="تنبيه: معاملة بنكية كبيرة ⚠️",
                html_content=html
            )
        
        logger.info(f"Large transaction alert sent to {len(admin_emails)} admins")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send transaction alert: {str(e)}")
        return False


async def notify_subscription_expiry(company_data: Dict):
    """إشعار بانتهاء الاشتراك"""
    try:
        admin_email = company_data.get("admin_email")
        if not admin_email:
            return False
        
        html = email_service.get_subscription_expiry_email(
            company_name=company_data.get("company_name", ""),
            plan_name=company_data.get("plan_name", ""),
            expiry_date=company_data.get("expiry_date", ""),
            days_remaining=company_data.get("days_remaining", 0)
        )
        
        await email_service.send_email(
            to_email=admin_email,
            subject="تذكير: اشتراكك على وشك الانتهاء ⏰",
            html_content=html
        )
        
        logger.info(f"Subscription expiry notification sent to {admin_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send subscription expiry notification: {str(e)}")
        return False


async def notify_password_reset(user_email: str, user_name: str, otp_code: str):
    """إشعار بإعادة تعيين كلمة المرور"""
    try:
        html = email_service.get_password_reset_email(
            user_name=user_name,
            otp_code=otp_code
        )
        
        await email_service.send_email(
            to_email=user_email,
            subject="إعادة تعيين كلمة المرور 🔐",
            html_content=html
        )
        
        logger.info(f"Password reset notification sent to {user_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send password reset notification: {str(e)}")
        return False


# ===========================================
# API Endpoints
# ===========================================

@router.post("/send-test-email")
async def send_test_email(
    to_email: str,
    template_type: str = "welcome",
    background_tasks: BackgroundTasks = None
):
    """إرسال بريد اختباري"""
    
    templates = {
        "welcome": lambda: email_service.get_welcome_email(
            "أحمد محمد", "DataLife", to_email, "TempPass123"
        ),
        "payslip": lambda: email_service.get_payslip_email(
            "أحمد محمد", "أبريل", "2026", 15000, 3000, 2000, 16000
        ),
        "leave_approved": lambda: email_service.get_leave_approval_email(
            "أحمد محمد", "إجازة سنوية", "2026-04-15", "2026-04-20", 5, "approved", "محمد علي"
        ),
        "leave_rejected": lambda: email_service.get_leave_approval_email(
            "أحمد محمد", "إجازة سنوية", "2026-04-15", "2026-04-20", 5, "rejected", "محمد علي", "لا يوجد رصيد كافي"
        ),
        "invoice": lambda: email_service.get_invoice_email(
            "شركة التقنية", "INV-2026-001", 25000, "2026-04-30"
        ),
        "transaction": lambda: email_service.get_transaction_alert_email(
            "withdrawal", 150000, "البنك الأهلي", "سحب نقدي"
        ),
        "subscription": lambda: email_service.get_subscription_expiry_email(
            "DataLife AI", "Professional", "2026-04-30", 15
        ),
        "password_reset": lambda: email_service.get_password_reset_email(
            "أحمد محمد", "123456"
        ),
    }
    
    if template_type not in templates:
        raise HTTPException(status_code=400, detail=f"Unknown template: {template_type}")
    
    html = templates[template_type]()
    
    success = await email_service.send_email(
        to_email=to_email,
        subject=f"[اختبار] قالب: {template_type}",
        html_content=html
    )
    
    if success:
        return {"status": "success", "message": f"Test email sent to {to_email}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email")


@router.get("/logs")
async def get_notification_logs(
    company_id: str = None,
    event_type: str = None,
    limit: int = 50,
    skip: int = 0
):
    """جلب سجل الإشعارات"""
    
    query = {}
    if company_id:
        query["company_id"] = company_id
    if event_type:
        query["event_type"] = event_type
    
    logs = await db.notification_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    total = await db.notification_logs.count_documents(query)
    
    # Convert ObjectId to string
    for log in logs:
        log["_id"] = str(log["_id"])
    
    return {
        "data": logs,
        "pagination": {
            "total": total,
            "limit": limit,
            "skip": skip
        }
    }


@router.post("/send-payroll-emails")
async def send_payroll_emails(
    company_id: str = None,
    background_tasks: BackgroundTasks = None
):
    """إرسال كشوف الرواتب للموظفين"""
    
    try:
        from scheduler import send_payroll_notifications
        
        if background_tasks:
            background_tasks.add_task(send_payroll_notifications, company_id)
            return {"status": "queued", "message": "Payroll emails are being sent in the background"}
        else:
            count = await send_payroll_notifications(company_id)
            return {"status": "success", "emails_sent": count}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send payroll emails: {str(e)}")
