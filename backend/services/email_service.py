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

resend.api_key = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "noreply@datalifeaccount.com")

ARABIC_MONTHS = {
    1:"يناير",2:"فبراير",3:"مارس",4:"أبريل",5:"مايو",6:"يونيو",
    7:"يوليو",8:"أغسطس",9:"سبتمبر",10:"أكتوبر",11:"نوفمبر",12:"ديسمبر"
}

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
    allowances_breakdown: list = None,
    company_name: str = "DataLife Account",
    employee_id: str = "",
    department: str = "",
    position: str = "",
    social_insurance: float = 0,
    income_tax: float = 0,
    stamp_duty: float = 0,
    approved_by: str = "",
    payment_method: str = "bank_transfer",
) -> dict:
    """إرسال قسيمة راتب مفصلة للموظف"""

    if not resend.api_key:
        logger.warning("Resend API key not configured")
        return {"status": "skipped", "message": "Email service not configured"}

    try:
        month_date = datetime.strptime(month, "%Y-%m")
        month_ar = f"{ARABIC_MONTHS[month_date.month]} {month_date.year}"
        month_en = month_date.strftime("%B %Y")
    except:
        month_ar = month
        month_en = month

    send_date = datetime.now().strftime("%Y-%m-%d")

    # Allowances rows
    allow_rows = ""
    if allowances_breakdown:
        for a in allowances_breakdown:
            allow_rows += f"""
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151;">{a.get('name','بدل')}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#059669;font-weight:600;text-align:left;">+ {float(a.get('amount',0)):,.2f} ج.م</td>
            </tr>"""

    # Deductions rows
    ded_rows = ""
    if deductions_breakdown:
        for d in deductions_breakdown:
            ded_rows += f"""
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151;">{d.get('name','خصم')}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:600;text-align:left;">- {float(d.get('amount',0)):,.2f} ج.م</td>
            </tr>"""

    # Standard deductions
    if social_insurance > 0:
        ded_rows += f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151;">التأمينات الاجتماعية (11%)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:600;text-align:left;">- {social_insurance:,.2f} ج.م</td>
        </tr>"""
    if income_tax > 0:
        ded_rows += f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151;">ضريبة الدخل</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:600;text-align:left;">- {income_tax:,.2f} ج.م</td>
        </tr>"""
    if stamp_duty > 0:
        ded_rows += f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151;">دمغة المرتبات (2.5‰)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:600;text-align:left;">- {stamp_duty:,.2f} ج.م</td>
        </tr>"""

    payment_method_ar = {
        "bank_transfer": "تحويل بنكي", "cash": "نقدي", "check": "شيك"
    }.get(payment_method, payment_method)

    html = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>قسيمة الراتب - {month_ar}</title>
</head>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
<div style="max-width:620px;margin:0 auto;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);border-radius:12px 12px 0 0;padding:32px 28px;text-align:center;">
    <div style="width:56px;height:56px;background:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;">
      <span style="color:#fff;font-weight:900;font-size:24px;">D</span>
    </div>
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">قسيمة الراتب الشهرية</h1>
    <p style="color:#bfdbfe;margin:6px 0 0;font-size:13px;">Monthly Payslip — {month_en}</p>
    <div style="margin-top:12px;background:rgba(255,255,255,0.15);border-radius:8px;padding:8px 16px;display:inline-block;">
      <span style="color:#e0f2fe;font-size:13px;font-weight:600;">{company_name}</span>
    </div>
  </div>

  <!-- Body -->
  <div style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-top:none;">

    <!-- Employee Info -->
    <div style="background:#f8fafc;border-radius:10px;padding:18px;margin-bottom:24px;border-right:4px solid #2563eb;">
      <h2 style="margin:0 0 14px;color:#1e3a8a;font-size:15px;">بيانات الموظف</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;width:40%;">الاسم:</td>
          <td style="padding:5px 0;color:#111827;font-weight:600;font-size:13px;">{employee_name}</td>
        </tr>
        {'<tr><td style="padding:5px 0;color:#6b7280;font-size:13px;">كود الموظف:</td><td style="padding:5px 0;color:#111827;font-size:13px;">' + employee_id + '</td></tr>' if employee_id else ''}
        {'<tr><td style="padding:5px 0;color:#6b7280;font-size:13px;">القسم:</td><td style="padding:5px 0;color:#111827;font-size:13px;">' + department + '</td></tr>' if department else ''}
        {'<tr><td style="padding:5px 0;color:#6b7280;font-size:13px;">الوظيفة:</td><td style="padding:5px 0;color:#111827;font-size:13px;">' + position + '</td></tr>' if position else ''}
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;">شهر الصرف:</td>
          <td style="padding:5px 0;color:#111827;font-weight:600;font-size:13px;">{month_ar}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;">تاريخ الإصدار:</td>
          <td style="padding:5px 0;color:#111827;font-size:13px;">{send_date}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;">طريقة الصرف:</td>
          <td style="padding:5px 0;color:#111827;font-size:13px;">{payment_method_ar}</td>
        </tr>
      </table>
    </div>

    <!-- Earnings -->
    <h3 style="color:#065f46;font-size:14px;margin:0 0 10px;padding-right:8px;border-right:3px solid #10b981;">المستحقات</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr style="background:#f0fdf4;">
        <td style="padding:10px 12px;color:#374151;font-weight:600;">الراتب الأساسي</td>
        <td style="padding:10px 12px;color:#059669;font-weight:700;text-align:left;">{basic_salary:,.2f} ج.م</td>
      </tr>
      {allow_rows if allow_rows else f'<tr><td style="padding:8px 12px;color:#374151;">البدلات</td><td style="padding:8px 12px;color:#059669;font-weight:600;text-align:left;">+ {total_allowances:,.2f} ج.م</td></tr>'}
      <tr style="background:#ecfdf5;">
        <td style="padding:12px;color:#065f46;font-weight:700;">إجمالي المستحقات</td>
        <td style="padding:12px;color:#065f46;font-weight:700;font-size:15px;text-align:left;">{gross_salary:,.2f} ج.م</td>
      </tr>
    </table>

    <!-- Deductions -->
    <h3 style="color:#991b1b;font-size:14px;margin:0 0 10px;padding-right:8px;border-right:3px solid #ef4444;">الخصومات</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      {ded_rows if ded_rows else f'<tr><td style="padding:8px 12px;color:#374151;">إجمالي الخصومات</td><td style="padding:8px 12px;color:#dc2626;font-weight:600;text-align:left;">- {total_deductions:,.2f} ج.م</td></tr>'}
      <tr style="background:#fef2f2;">
        <td style="padding:12px;color:#991b1b;font-weight:700;">إجمالي الخصومات</td>
        <td style="padding:12px;color:#991b1b;font-weight:700;font-size:15px;text-align:left;">- {total_deductions:,.2f} ج.م</td>
      </tr>
    </table>

    <!-- Net Salary -->
    <div style="background:linear-gradient(135deg,#059669,#047857);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <p style="color:#d1fae5;margin:0;font-size:13px;">صافي الراتب المستحق</p>
      <p style="color:#fff;margin:8px 0 0;font-size:36px;font-weight:900;">{net_salary:,.2f} <span style="font-size:18px;">ج.م</span></p>
      <p style="color:#a7f3d0;margin:4px 0 0;font-size:12px;">Net Salary — {month_en}</p>
    </div>

    <!-- Summary Table -->
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:24px;">
      <tr>
        <td style="padding:10px 14px;color:#6b7280;font-size:13px;border-bottom:1px solid #e5e7eb;">إجمالي المستحقات</td>
        <td style="padding:10px 14px;color:#059669;font-weight:600;text-align:left;border-bottom:1px solid #e5e7eb;">{gross_salary:,.2f} ج.م</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;color:#6b7280;font-size:13px;border-bottom:1px solid #e5e7eb;">إجمالي الخصومات</td>
        <td style="padding:10px 14px;color:#dc2626;font-weight:600;text-align:left;border-bottom:1px solid #e5e7eb;">- {total_deductions:,.2f} ج.م</td>
      </tr>
      <tr style="background:#1e3a8a;">
        <td style="padding:12px 14px;color:#fff;font-weight:700;">صافي الراتب</td>
        <td style="padding:12px 14px;color:#fbbf24;font-weight:800;font-size:16px;text-align:left;">{net_salary:,.2f} ج.م</td>
      </tr>
    </table>

    {'<!-- Approved By --><div style="background:#f0f9ff;border-radius:8px;padding:14px;border:1px solid #bae6fd;margin-bottom:20px;"><p style="margin:0;color:#0369a1;font-size:13px;"><strong>اعتُمد بواسطة:</strong> ' + approved_by + '</p><p style="margin:4px 0 0;color:#64748b;font-size:12px;">Approved by: ' + approved_by + '</p></div>' if approved_by else ''}

    <!-- Note -->
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px;">
      <p style="margin:0;color:#92400e;font-size:12px;">
        ⚠️ هذه القسيمة وثيقة رسمية صادرة من نظام {company_name}. يُرجى الاحتفاظ بها للرجوع إليها.
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#1e3a8a;border-radius:0 0 12px 12px;padding:20px;text-align:center;">
    <p style="color:#bfdbfe;margin:0;font-size:12px;">{company_name} — نظام إدارة الموارد البشرية</p>
    <p style="color:#64748b;margin:6px 0 0;font-size:11px;">هذا البريد الإلكتروني تم إرساله تلقائياً — لا تقم بالرد عليه</p>
    <p style="color:#64748b;margin:4px 0 0;font-size:11px;">This is an automated email from {company_name} ERP System</p>
  </div>

</div>
</body>
</html>"""

    params = {
        "from": SENDER_EMAIL,
        "to": [employee_email],
        "subject": f"قسيمة الراتب — {month_ar} | {company_name}",
        "html": html
    }

    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Payslip sent to {employee_email}")
        return {"status": "success", "message": f"Sent to {employee_email}", "email_id": email.get("id")}
    except Exception as e:
        logger.error(f"Failed to send payslip to {employee_email}: {e}")
        return {"status": "error", "message": str(e)}


async def send_bulk_payslip_notifications(
    employees_data: list,
    month: str,
    company_name: str = "DataLife Account"
) -> dict:
    """إرسال قسائم الرواتب لمجموعة من الموظفين"""
    results = {"sent": 0, "failed": 0, "skipped": 0, "total": len(employees_data), "details": []}

    for emp in employees_data:
        email = emp.get("email")
        if not email:
            results["skipped"] += 1
            results["details"].append({"employee": emp.get("employee_name"), "status": "skipped", "reason": "no email"})
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
            deductions_breakdown=emp.get("deductions_breakdown", []),
            allowances_breakdown=emp.get("allowances_breakdown", []),
            company_name=company_name,
            employee_id=emp.get("employee_id", ""),
            department=emp.get("department", ""),
            position=emp.get("position", ""),
            social_insurance=emp.get("social_insurance", 0),
            income_tax=emp.get("income_tax", 0),
            stamp_duty=emp.get("stamp_duty", 0),
            approved_by=emp.get("approved_by", ""),
            payment_method=emp.get("payment_method", "bank_transfer"),
        )

        if result["status"] == "success":
            results["sent"] += 1
        elif result["status"] == "error":
            results["failed"] += 1
        else:
            results["skipped"] += 1

        results["details"].append({
            "employee": emp.get("employee_name"),
            "email": email,
            **result
        })

        await asyncio.sleep(0.2)  # Rate limiting

    return results


async def send_payroll_approved_notification(
    manager_email: str,
    manager_name: str,
    month: str,
    total_employees: int,
    total_net: float,
    company_name: str = "DataLife Account"
) -> dict:
    """إشعار المدير باعتماد المسير"""
    if not resend.api_key:
        return {"status": "skipped"}

    try:
        month_date = datetime.strptime(month, "%Y-%m")
        month_ar = f"{ARABIC_MONTHS[month_date.month]} {month_date.year}"
    except:
        month_ar = month

    html = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:20px;">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:20px;">✅ تم اعتماد مسير الرواتب</h1>
    <p style="color:#bfdbfe;margin:8px 0 0;font-size:13px;">{month_ar} — {company_name}</p>
  </div>
  <div style="padding:24px;">
    <p style="color:#374151;">مرحباً {manager_name}،</p>
    <p style="color:#374151;">تم اعتماد مسير رواتب شهر <strong>{month_ar}</strong> بنجاح.</p>
    <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0;border-right:4px solid #10b981;">
      <p style="margin:0;color:#065f46;"><strong>عدد الموظفين:</strong> {total_employees} موظف</p>
      <p style="margin:8px 0 0;color:#065f46;"><strong>إجمالي الرواتب الصافية:</strong> {total_net:,.2f} ج.م</p>
    </div>
    <p style="color:#6b7280;font-size:12px;margin-top:20px;">تم الإرسال تلقائياً من نظام {company_name}</p>
  </div>
</div>
</body>
</html>"""

    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [manager_email],
            "subject": f"✅ تم اعتماد مسير الرواتب — {month_ar}",
            "html": html
        }
        email = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "success", "email_id": email.get("id")}
    except Exception as e:
        return {"status": "error", "message": str(e)}
