"""
Email Service for Payroll Notifications
خدمة البريد الإلكتروني لإشعارات الرواتب
"""

import os
import asyncio
import logging
from datetime import datetime
from typing import Optional
import resend
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Initialize Resend
resend.api_key = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "noreply@datalifeaccount.com")


async def send_payslip_notification(
    employee_email: str,
    employee_name: str,
    month: str,
    basic_salary: float,
    total_allowances: float,
    gross_salary: float,
    total_deductions: float,
    net_salary: float,
    deductions_breakdown: list = None,
    company_name: str = "DataLife Account"
) -> dict:
    """إرسال إشعار قسيمة الراتب للموظف"""
    
    if not resend.api_key:
        logger.warning("Resend API key not configured")
        return {"status": "skipped", "message": "Email service not configured"}
    
    # تنسيق الشهر
    try:
        month_date = datetime.strptime(month, "%Y-%m")
        month_formatted = month_date.strftime("%B %Y")
        month_arabic = f"{month_date.month}/{month_date.year}"
    except:
        month_formatted = month
        month_arabic = month
    
    # بناء جدول الخصومات
    deductions_rows = ""
    if deductions_breakdown:
        for ded in deductions_breakdown:
            deductions_rows += f"""
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">{ded.get('name', '-')}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: left;">{ded.get('amount', 0):,.2f}</td>
            </tr>
            """
    
    # بناء قالب البريد الإلكتروني (عربي/إنجليزي)
    html_content = f"""
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">قسيمة الراتب الشهرية</h1>
                <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 14px;">Monthly Payslip</p>
            </div>
            
            <!-- Employee Info -->
            <div style="padding: 25px; border-bottom: 1px solid #eee;">
                <table style="width: 100%;">
                    <tr>
                        <td style="padding: 5px 0;">
                            <strong style="color: #374151;">الموظف:</strong>
                            <span style="color: #6b7280; margin-right: 10px;">{employee_name}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;">
                            <strong style="color: #374151;">الشهر:</strong>
                            <span style="color: #6b7280; margin-right: 10px;">{month_arabic}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;">
                            <strong style="color: #374151;">الشركة:</strong>
                            <span style="color: #6b7280; margin-right: 10px;">{company_name}</span>
                        </td>
                    </tr>
                </table>
            </div>
            
            <!-- Salary Details -->
            <div style="padding: 25px;">
                <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 20px 0; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
                    تفاصيل الراتب
                </h2>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f9fafb;">
                        <td style="padding: 12px; font-weight: bold; color: #374151;">الراتب الأساسي</td>
                        <td style="padding: 12px; text-align: left; color: #374151;">{basic_salary:,.2f} ج.م</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; font-weight: bold; color: #059669;">البدلات</td>
                        <td style="padding: 12px; text-align: left; color: #059669;">+ {total_allowances:,.2f} ج.م</td>
                    </tr>
                    <tr style="background-color: #ecfdf5;">
                        <td style="padding: 12px; font-weight: bold; color: #065f46;">إجمالي الراتب</td>
                        <td style="padding: 12px; text-align: left; color: #065f46; font-weight: bold;">{gross_salary:,.2f} ج.م</td>
                    </tr>
                </table>
                
                <!-- Deductions -->
                <h3 style="color: #dc2626; font-size: 16px; margin: 25px 0 15px 0;">الخصومات</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    {deductions_rows if deductions_rows else f'''
                    <tr>
                        <td style="padding: 8px; color: #6b7280;">إجمالي الخصومات</td>
                        <td style="padding: 8px; text-align: left; color: #dc2626;">- {total_deductions:,.2f} ج.م</td>
                    </tr>
                    '''}
                    <tr style="background-color: #fef2f2;">
                        <td style="padding: 12px; font-weight: bold; color: #991b1b;">إجمالي الخصومات</td>
                        <td style="padding: 12px; text-align: left; color: #991b1b; font-weight: bold;">- {total_deductions:,.2f} ج.م</td>
                    </tr>
                </table>
                
                <!-- Net Salary -->
                <div style="margin-top: 25px; padding: 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px; text-align: center;">
                    <p style="color: #d1fae5; margin: 0; font-size: 14px;">صافي الراتب المستحق</p>
                    <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 32px; font-weight: bold;">{net_salary:,.2f} ج.م</p>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                <p style="color: #6b7280; margin: 0; font-size: 12px;">
                    هذا البريد الإلكتروني تم إرساله تلقائياً من نظام {company_name}
                </p>
                <p style="color: #9ca3af; margin: 10px 0 0 0; font-size: 11px;">
                    This email was sent automatically from {company_name} system
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [employee_email],
        "subject": f"قسيمة الراتب - {month_arabic} | Payslip - {month_formatted}",
        "html": html_content
    }
    
    try:
        # Run sync SDK in thread to keep FastAPI non-blocking
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Payslip email sent to {employee_email}")
        return {
            "status": "success",
            "message": f"Email sent to {employee_email}",
            "email_id": email.get("id")
        }
    except Exception as e:
        logger.error(f"Failed to send payslip email to {employee_email}: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }


async def send_bulk_payslip_notifications(
    employees_data: list,
    month: str,
    company_name: str = "DataLife Account"
) -> dict:
    """إرسال إشعارات قسائم الرواتب لجميع الموظفين"""
    
    results = {
        "total": len(employees_data),
        "sent": 0,
        "failed": 0,
        "skipped": 0,
        "details": []
    }
    
    for emp in employees_data:
        email = emp.get("email")
        if not email:
            results["skipped"] += 1
            results["details"].append({
                "employee_name": emp.get("employee_name"),
                "status": "skipped",
                "reason": "No email address"
            })
            continue
        
        result = await send_payslip_notification(
            employee_email=email,
            employee_name=emp.get("employee_name", ""),
            month=month,
            basic_salary=emp.get("basic_salary", 0),
            total_allowances=emp.get("total_allowances", 0),
            gross_salary=emp.get("gross_salary", 0),
            total_deductions=emp.get("total_deductions", 0),
            net_salary=emp.get("net_salary", 0),
            company_name=company_name
        )
        
        if result["status"] == "success":
            results["sent"] += 1
        else:
            results["failed"] += 1
        
        results["details"].append({
            "employee_name": emp.get("employee_name"),
            "email": email,
            "status": result["status"],
            "message": result.get("message")
        })
        
        # Small delay between emails
        await asyncio.sleep(0.5)
    
    return results


async def send_payroll_approved_notification(
    manager_email: str,
    manager_name: str,
    month: str,
    total_employees: int,
    total_gross: float,
    total_net: float,
    company_name: str = "DataLife Account"
) -> dict:
    """إرسال إشعار اعتماد مسير الرواتب للمدير"""
    
    if not resend.api_key:
        return {"status": "skipped", "message": "Email service not configured"}
    
    html_content = f"""
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 25px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 20px;">✅ تم اعتماد مسير الرواتب</h1>
            </div>
            
            <div style="padding: 25px;">
                <p style="color: #374151; margin: 0 0 20px 0;">مرحباً {manager_name}،</p>
                
                <p style="color: #6b7280; margin: 0 0 20px 0;">
                    تم اعتماد مسير رواتب شهر <strong>{month}</strong> بنجاح.
                </p>
                
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="padding: 5px 0; color: #6b7280;">عدد الموظفين:</td>
                            <td style="padding: 5px 0; text-align: left; font-weight: bold;">{total_employees}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; color: #6b7280;">إجمالي الرواتب:</td>
                            <td style="padding: 5px 0; text-align: left; font-weight: bold;">{total_gross:,.2f} ج.م</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; color: #6b7280;">صافي المستحق:</td>
                            <td style="padding: 5px 0; text-align: left; font-weight: bold; color: #059669;">{total_net:,.2f} ج.م</td>
                        </tr>
                    </table>
                </div>
                
                <p style="color: #6b7280; margin: 0; font-size: 13px;">
                    تم إنشاء القيود المحاسبية تلقائياً في دفتر الأستاذ.
                </p>
            </div>
            
            <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #eee;">
                <p style="color: #9ca3af; margin: 0; font-size: 11px;">{company_name}</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [manager_email],
        "subject": f"تم اعتماد مسير الرواتب - {month}",
        "html": html_content
    }
    
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "success", "email_id": email.get("id")}
    except Exception as e:
        logger.error(f"Failed to send approval notification: {str(e)}")
        return {"status": "error", "message": str(e)}
