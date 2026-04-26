"""
Scheduled Tasks for DataLife Account
- Daily coupon expiry check (9 AM)
- Weekly sales report (Sunday)
- Monthly sales report (1st of month)
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timezone, timedelta
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from io import BytesIO
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv(Path(__file__).parent / '.env')

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')

# SMTP Configuration
SMTP_CONFIG = {
    "host": os.environ.get('SMTP_HOST', ''),
    "port": int(os.environ.get('SMTP_PORT', 465)),
    "email": os.environ.get('SMTP_EMAIL', ''),
    "password": os.environ.get('SMTP_PASSWORD', ''),
    "use_ssl": os.environ.get('SMTP_USE_SSL', 'true').lower() == 'true'
}

ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'info@datalifeai.com')

scheduler = AsyncIOScheduler()


async def check_expiring_coupons():
    """Check for expiring coupons and send notifications"""
    print(f"[{datetime.now()}] Running daily coupon expiry check...")
    
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        
        now = datetime.now(timezone.utc)
        
        # Find coupons expiring within 7 days
        coupons = await db.coupons.find({"is_active": True}, {"_id": 0}).to_list(1000)
        
        expiring_coupons = []
        for coupon in coupons:
            if coupon.get("expiry_date"):
                try:
                    expiry = datetime.fromisoformat(coupon["expiry_date"].replace("Z", "+00:00"))
                    days_left = (expiry - now).days
                    if 0 <= days_left <= 7:
                        # Check if we already notified in last 24 hours
                        existing = await db.coupon_notifications.find_one({
                            "coupon_code": coupon["code"],
                            "notification_type": "expiring_soon",
                            "sent_at": {"$gte": (now - timedelta(days=1)).isoformat()}
                        })
                        if not existing:
                            expiring_coupons.append({**coupon, "days_left": days_left})
                except:
                    pass
        
        if not expiring_coupons:
            print(f"[{datetime.now()}] No expiring coupons to notify")
            client.close()
            return
        
        # Send notification email
        coupon_rows = ""
        for coupon in expiring_coupons:
            days_text = f"{coupon['days_left']} days" if coupon['days_left'] > 0 else "Today!"
            discount_text = f"{coupon['discount_value']}%" if coupon['discount_type'] == 'percentage' else f"${coupon['discount_value']}"
            coupon_rows += f"""
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">{coupon['code']}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">{coupon['name_en']}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">{discount_text}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; color: {'#dc3545' if coupon['days_left'] <= 1 else '#ffc107'}; font-weight: bold;">{days_text}</td>
            </tr>
            """
        
        email_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #ff9800 0%, #f44336 100%); padding: 25px; border-radius: 10px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">Coupon Expiration Alert</h1>
            </div>
            <div style="padding: 25px; background: #fff; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
                <p>The following {len(expiring_coupons)} coupons are expiring soon:</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 12px; text-align: left;">Code</th>
                            <th style="padding: 12px; text-align: left;">Name</th>
                            <th style="padding: 12px; text-align: left;">Discount</th>
                            <th style="padding: 12px; text-align: left;">Expires In</th>
                        </tr>
                    </thead>
                    <tbody>{coupon_rows}</tbody>
                </table>
            </div>
        </div>
        """
        
        if SMTP_CONFIG["host"] and SMTP_CONFIG["email"]:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"{len(expiring_coupons)} Coupons Expiring Soon"
            msg['From'] = SMTP_CONFIG["email"]
            msg['To'] = ADMIN_EMAIL
            msg.attach(MIMEText(email_html, 'html', 'utf-8'))
            
            if SMTP_CONFIG["use_ssl"]:
                import ssl
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(SMTP_CONFIG["host"], SMTP_CONFIG["port"], context=context) as server:
                    server.login(SMTP_CONFIG["email"], SMTP_CONFIG["password"])
                    server.send_message(msg)
            
            # Log notifications
            for coupon in expiring_coupons:
                await db.coupon_notifications.insert_one({
                    "coupon_code": coupon["code"],
                    "notification_type": "expiring_soon",
                    "days_left": coupon["days_left"],
                    "sent_at": now.isoformat(),
                    "status": "sent"
                })
            
            print(f"[{datetime.now()}] Sent expiry notifications for {len(expiring_coupons)} coupons")
        
        client.close()
        
    except Exception as e:
        print(f"[{datetime.now()}] Error in coupon expiry check: {e}")


async def send_weekly_report():
    """Send weekly sales report every Sunday"""
    print(f"[{datetime.now()}] Generating weekly sales report...")
    
    try:
        # Import here to avoid circular imports
        from api.reports import get_report_data, generate_pdf_report, send_report_email
        
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=7)
        end_date = now
        
        data = await get_report_data(start_date, end_date)
        pdf_buffer = generate_pdf_report(data, "weekly")
        
        await send_report_email(pdf_buffer, "weekly", ADMIN_EMAIL, data["period"])
        
        # Log
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await db.report_logs.insert_one({
            "report_type": "weekly",
            "period": data["period"],
            "sent_to": ADMIN_EMAIL,
            "generated_at": now.isoformat(),
            "status": "sent",
            "automated": True
        })
        client.close()
        
        print(f"[{datetime.now()}] Weekly report sent to {ADMIN_EMAIL}")
        
    except Exception as e:
        print(f"[{datetime.now()}] Error sending weekly report: {e}")


async def send_monthly_report():
    """Send monthly sales report on the 1st of each month"""
    print(f"[{datetime.now()}] Generating monthly sales report...")
    
    try:
        from api.reports import get_report_data, generate_pdf_report, send_report_email
        
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=30)
        end_date = now
        
        data = await get_report_data(start_date, end_date)
        pdf_buffer = generate_pdf_report(data, "monthly")
        
        await send_report_email(pdf_buffer, "monthly", ADMIN_EMAIL, data["period"])
        
        # Log
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await db.report_logs.insert_one({
            "report_type": "monthly",
            "period": data["period"],
            "sent_to": ADMIN_EMAIL,
            "generated_at": now.isoformat(),
            "status": "sent",
            "automated": True
        })
        client.close()
        
        print(f"[{datetime.now()}] Monthly report sent to {ADMIN_EMAIL}")
        
    except Exception as e:
        print(f"[{datetime.now()}] Error sending monthly report: {e}")


async def send_daily_audit_report():
    """Send daily audit log report"""
    print(f"[{datetime.now()}] Running daily audit report...")
    
    try:
        from api.audit_notifications import send_daily_audit_report as send_audit_report
        await send_audit_report()
    except Exception as e:
        print(f"[{datetime.now()}] Error sending daily audit report: {e}")


async def check_subscription_expiry():
    """Check for expiring subscriptions and send notifications"""
    print(f"[{datetime.now()}] Running subscription expiry check...")
    
    try:
        from api.audit_notifications import check_expiring_subscriptions
        await check_expiring_subscriptions()
    except Exception as e:
        print(f"[{datetime.now()}] Error checking subscription expiry: {e}")


async def check_contract_expiry():
    """Check for expiring employee contracts and send notifications"""
    print(f"[{datetime.now()}] Running contract expiry check...")
    
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        
        now = datetime.now(timezone.utc)
        expiry_threshold = now + timedelta(days=30)
        
        # Find employees with contracts expiring within 30 days
        employees = await db.employees.find({
            "contract_end": {"$lte": expiry_threshold.isoformat(), "$gte": now.isoformat()},
            "is_active": True
        }, {"_id": 0}).to_list(1000)
        
        for emp in employees:
            company_id = emp.get("company_id")
            if company_id:
                # Get admin emails for this company
                admins = await db.users.find({
                    "company_id": company_id,
                    "role": {"$in": ["HR Manager", "General Manager", "CEO", "مدير الموارد البشرية", "مدير عام"]}
                }, {"email": 1}).to_list(10)
                
                admin_emails = [a.get("email") for a in admins if a.get("email")]
                
                if admin_emails:
                    try:
                        from services.professional_email_service import email_service
                        contract_end = emp.get("contract_end", "")
                        days_remaining = (datetime.fromisoformat(contract_end.replace('Z', '+00:00')) - now).days
                        
                        for email in admin_emails:
                            html = email_service.get_contract_expiry_template(
                                emp.get("name", ""),
                                contract_end[:10],
                                days_remaining
                            ) if hasattr(email_service, 'get_contract_expiry_template') else None
                            
                            if html:
                                await email_service.send_email(
                                    to_email=email,
                                    subject=f"تنبيه: انتهاء عقد {emp.get('name', '')} خلال {days_remaining} يوم",
                                    html_content=html
                                )
                    except Exception as e:
                        print(f"Error sending contract expiry email: {e}")
        
        client.close()
        print(f"[{datetime.now()}] Contract expiry check completed. Found {len(employees)} expiring contracts.")
        
    except Exception as e:
        print(f"[{datetime.now()}] Error checking contract expiry: {e}")


async def check_leave_balance():
    """Check for employees with expiring leave balance"""
    print(f"[{datetime.now()}] Running leave balance check...")
    
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        
        now = datetime.now(timezone.utc)
        
        # Check if it's near end of year (December)
        if now.month == 12 and now.day >= 15:
            # Find employees with remaining annual leave
            employees = await db.employees.find({
                "is_active": True,
                "annual_leave_balance": {"$gt": 5}
            }, {"_id": 0, "name": 1, "email": 1, "annual_leave_balance": 1, "company_id": 1}).to_list(1000)
            
            for emp in employees:
                if emp.get("email"):
                    try:
                        from services.professional_email_service import email_service
                        
                        content = f"""
                        <p>مرحباً {emp.get('name', '')}،</p>
                        <p>نود تذكيرك بأن رصيد إجازتك السنوية المتبقي هو <strong>{emp.get('annual_leave_balance', 0)}</strong> يوم.</p>
                        <p>يرجى التنسيق مع مديرك لاستخدام رصيد إجازتك قبل نهاية العام.</p>
                        """
                        
                        html = email_service._get_base_template("تذكير: رصيد الإجازة السنوية", content, "#f59e0b")
                        
                        await email_service.send_email(
                            to_email=emp.get("email"),
                            subject="تذكير: رصيد إجازتك السنوية",
                            html_content=html
                        )
                    except Exception as e:
                        print(f"Error sending leave balance email: {e}")
        
        client.close()
        print(f"[{datetime.now()}] Leave balance check completed.")
        
    except Exception as e:
        print(f"[{datetime.now()}] Error checking leave balance: {e}")


async def send_payroll_notifications(company_id: str = None):
    """Send payroll notifications to employees (called after payroll processing)"""
    print(f"[{datetime.now()}] Sending payroll notifications...")
    
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        
        from services.professional_email_service import email_service
        
        now = datetime.now(timezone.utc)
        month_name = now.strftime("%B")
        year = now.year
        
        # Arabic month names
        arabic_months = {
            "January": "يناير", "February": "فبراير", "March": "مارس",
            "April": "أبريل", "May": "مايو", "June": "يونيو",
            "July": "يوليو", "August": "أغسطس", "September": "سبتمبر",
            "October": "أكتوبر", "November": "نوفمبر", "December": "ديسمبر"
        }
        month_ar = arabic_months.get(month_name, month_name)
        
        query = {}
        if company_id:
            query["company_id"] = company_id
        
        # Find recent payroll records
        payrolls = await db.payroll.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        
        sent_count = 0
        for payroll in payrolls:
            emp_email = payroll.get("employee_email")
            if emp_email:
                html = email_service.get_payslip_email(
                    employee_name=payroll.get("employee_name", ""),
                    month=month_ar,
                    year=str(year),
                    basic_salary=payroll.get("basic_salary", 0),
                    allowances=payroll.get("total_allowances", 0),
                    deductions=payroll.get("total_deductions", 0),
                    net_salary=payroll.get("net_salary", 0)
                )
                
                success = await email_service.send_email(
                    to_email=emp_email,
                    subject=f"كشف راتب - {month_ar} {year}",
                    html_content=html
                )
                
                if success:
                    sent_count += 1
        
        client.close()
        print(f"[{datetime.now()}] Payroll notifications sent to {sent_count} employees.")
        return sent_count
        
    except Exception as e:
        print(f"[{datetime.now()}] Error sending payroll notifications: {e}")
        return 0


def start_scheduler():
    """Start the scheduler with all jobs"""
    
    # Daily coupon check at 9 AM (UTC)
    scheduler.add_job(
        check_expiring_coupons,
        CronTrigger(hour=9, minute=0),
        id='daily_coupon_check',
        name='Daily Coupon Expiry Check',
        replace_existing=True
    )
    
    # Weekly report every Sunday at 8 AM (UTC)
    scheduler.add_job(
        send_weekly_report,
        CronTrigger(day_of_week='sun', hour=8, minute=0),
        id='weekly_report',
        name='Weekly Sales Report',
        replace_existing=True
    )
    
    # Monthly report on 1st of each month at 8 AM (UTC)
    scheduler.add_job(
        send_monthly_report,
        CronTrigger(day=1, hour=8, minute=0),
        id='monthly_report',
        name='Monthly Sales Report',
        replace_existing=True
    )
    
    # Daily audit report at 7 AM (UTC)
    scheduler.add_job(
        send_daily_audit_report,
        CronTrigger(hour=7, minute=0),
        id='daily_audit_report',
        name='Daily Audit Report',
        replace_existing=True
    )
    
    # Subscription expiry check daily at 8 AM (UTC)
    scheduler.add_job(
        check_subscription_expiry,
        CronTrigger(hour=8, minute=0),
        id='subscription_expiry_check',
        name='Subscription Expiry Check',
        replace_existing=True
    )
    
    # Contract expiry check daily at 7:30 AM (UTC)
    scheduler.add_job(
        check_contract_expiry,
        CronTrigger(hour=7, minute=30),
        id='contract_expiry_check',
        name='Contract Expiry Check',
        replace_existing=True
    )
    
    # Leave balance check on 15th of December at 9 AM (UTC)
    scheduler.add_job(
        check_leave_balance,
        CronTrigger(month=12, day=15, hour=9, minute=0),
        id='leave_balance_check',
        name='Leave Balance Reminder',
        replace_existing=True
    )
    
    # Health check every 6 hours
    scheduler.add_job(
        run_health_check,
        CronTrigger(hour='*/6', minute=0),
        id='health_check',
        name='System Health Check',
        replace_existing=True
    )
    
    scheduler.start()
    print(f"[{datetime.now()}] Scheduler started with {len(scheduler.get_jobs())} jobs")
    for job in scheduler.get_jobs():
        print(f"  - {job.name}: {job.trigger}")


async def run_health_check():
    """Periodic health check - tests system + routes and logs results"""
    try:
        import httpx
        mongo_client = AsyncIOMotorClient(MONGO_URL)
        health_db = mongo_client[DB_NAME]
        
        # System check
        await health_db.command("ping")
        user_count = await health_db.users.count_documents({})
        company_count = await health_db.companies.count_documents({})
        active_subs = await health_db.subscriptions.count_documents({"status": "active"})
        
        # Route test via API
        route_result = None
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get("http://localhost:8001/api/health/test-routes")
                if resp.status_code == 200:
                    route_result = resp.json().get("summary")
        except:
            pass
        
        status = "ok" if user_count > 0 else "warn"
        
        await health_db.health_checks.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": status,
            "type": "scheduled",
            "summary": {
                "database": "ok",
                "users": user_count,
                "companies": company_count,
                "active_subscriptions": active_subs,
                "route_test": route_result
            }
        })
        
        routes_info = f" | Routes: {route_result['passed']}/{route_result['total_tested']}" if route_result else ""
        print(f"[{datetime.now()}] Health check: {status} | Users: {user_count} | Companies: {company_count}{routes_info}")
        mongo_client.close()
    except Exception as e:
        print(f"[{datetime.now()}] Health check FAILED: {e}")


def get_scheduler_status():
    """Get current scheduler status and upcoming jobs"""
    
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "trigger": str(job.trigger),
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None
        })
    
    return {
        "running": scheduler.running,
        "jobs": jobs
    }
