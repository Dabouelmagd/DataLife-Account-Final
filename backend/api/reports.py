from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
from typing import Optional, List
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env')

router = APIRouter(prefix="/api/reports", tags=["reports"])

# Configuration from environment
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://datalifeaccount.com")

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# SMTP Configuration
SMTP_CONFIG = {
    "host": os.environ.get('SMTP_HOST', ''),
    "port": int(os.environ.get('SMTP_PORT', 465)),
    "email": os.environ.get('SMTP_EMAIL', ''),
    "password": os.environ.get('SMTP_PASSWORD', ''),
    "use_ssl": os.environ.get('SMTP_USE_SSL', 'true').lower() == 'true'
}

# Colors
PRIMARY_COLOR = colors.HexColor('#28376B')
SECONDARY_COLOR = colors.HexColor('#4A5568')
SUCCESS_COLOR = colors.HexColor('#48BB78')
WARNING_COLOR = colors.HexColor('#ECC94B')
DANGER_COLOR = colors.HexColor('#F56565')


class ReportRequest(BaseModel):
    report_type: str = Field(..., description="weekly or monthly")
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    send_email: bool = Field(False, description="Send report via email")
    email_to: Optional[str] = Field(None, description="Email recipient")


async def get_report_data(start_date: datetime, end_date: datetime):
    """Gather all data needed for the report"""
    
    # Payment transactions
    transactions = await db.payment_transactions.find({
        "created_at": {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    # Coupon usage
    coupons = await db.coupons.find({}, {"_id": 0}).to_list(1000)
    
    # Calculate metrics
    total_revenue = sum(t.get("amount_usd", 0) for t in transactions if t.get("payment_status") == "paid")
    total_discounts = sum(t.get("discount_amount_usd", 0) for t in transactions if t.get("payment_status") == "paid")
    total_transactions = len([t for t in transactions if t.get("payment_status") == "paid"])
    
    # Plan breakdown
    plan_breakdown = {}
    for t in transactions:
        if t.get("payment_status") == "paid":
            plan = t.get("plan", "unknown")
            if plan not in plan_breakdown:
                plan_breakdown[plan] = {"count": 0, "revenue": 0}
            plan_breakdown[plan]["count"] += 1
            plan_breakdown[plan]["revenue"] += t.get("amount_usd", 0)
    
    # Payment method breakdown
    payment_methods = {}
    for t in transactions:
        if t.get("payment_status") == "paid":
            method = t.get("payment_gateway", "unknown")
            if method not in payment_methods:
                payment_methods[method] = {"count": 0, "revenue": 0}
            payment_methods[method]["count"] += 1
            payment_methods[method]["revenue"] += t.get("amount_usd", 0)
    
    # Top coupons
    coupon_usage = {}
    for t in transactions:
        if t.get("coupon_code") and t.get("payment_status") == "paid":
            code = t["coupon_code"]
            if code not in coupon_usage:
                coupon_usage[code] = {"count": 0, "discount": 0}
            coupon_usage[code]["count"] += 1
            coupon_usage[code]["discount"] += t.get("discount_amount_usd", 0)
    
    top_coupons = sorted(coupon_usage.items(), key=lambda x: x[1]["count"], reverse=True)[:5]
    
    # Daily breakdown
    daily_data = {}
    for t in transactions:
        if t.get("payment_status") == "paid" and t.get("created_at"):
            try:
                date = t["created_at"][:10]
                if date not in daily_data:
                    daily_data[date] = {"count": 0, "revenue": 0}
                daily_data[date]["count"] += 1
                daily_data[date]["revenue"] += t.get("amount_usd", 0)
            except:
                pass
    
    return {
        "period": {
            "start": start_date.strftime("%Y-%m-%d"),
            "end": end_date.strftime("%Y-%m-%d")
        },
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_discounts": round(total_discounts, 2),
            "net_revenue": round(total_revenue, 2),  # Discounts already applied
            "total_transactions": total_transactions,
            "avg_transaction": round(total_revenue / total_transactions, 2) if total_transactions > 0 else 0
        },
        "plan_breakdown": plan_breakdown,
        "payment_methods": payment_methods,
        "top_coupons": top_coupons,
        "daily_data": daily_data,
        "active_coupons": len([c for c in coupons if c.get("is_active", True)])
    }


def generate_pdf_report(data: dict, report_type: str) -> BytesIO:
    """Generate PDF report from data"""
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1*cm)
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=PRIMARY_COLOR,
        spaceAfter=20,
        alignment=1  # Center
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=PRIMARY_COLOR,
        spaceBefore=15,
        spaceAfter=10
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=SECONDARY_COLOR
    )
    
    elements = []
    
    # Header
    period_text = f"{data['period']['start']} to {data['period']['end']}"
    report_title = "Weekly Sales Report" if report_type == "weekly" else "Monthly Sales Report"
    
    elements.append(Paragraph("DataLife Account", title_style))
    elements.append(Paragraph(report_title, heading_style))
    elements.append(Paragraph(f"Period: {period_text}", normal_style))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", normal_style))
    elements.append(Spacer(1, 20))
    
    # Summary Section
    elements.append(Paragraph("Executive Summary", heading_style))
    
    summary = data["summary"]
    summary_data = [
        ["Metric", "Value"],
        ["Total Revenue", f"${summary['total_revenue']:,.2f}"],
        ["Total Discounts Applied", f"${summary['total_discounts']:,.2f}"],
        ["Total Transactions", str(summary['total_transactions'])],
        ["Average Transaction", f"${summary['avg_transaction']:,.2f}"],
        ["Active Coupons", str(data['active_coupons'])]
    ]
    
    summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F7FAFC')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 20))
    
    # Plan Breakdown
    if data["plan_breakdown"]:
        elements.append(Paragraph("Sales by Plan", heading_style))
        
        plan_data = [["Plan", "Transactions", "Revenue"]]
        for plan, info in sorted(data["plan_breakdown"].items(), key=lambda x: x[1]["revenue"], reverse=True):
            plan_data.append([
                plan.capitalize(),
                str(info["count"]),
                f"${info['revenue']:,.2f}"
            ])
        
        plan_table = Table(plan_data, colWidths=[2*inch, 1.5*inch, 1.5*inch])
        plan_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_COLOR),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(plan_table)
        elements.append(Spacer(1, 20))
    
    # Payment Methods
    if data["payment_methods"]:
        elements.append(Paragraph("Payment Methods", heading_style))
        
        method_data = [["Method", "Transactions", "Revenue"]]
        for method, info in data["payment_methods"].items():
            method_data.append([
                method.upper(),
                str(info["count"]),
                f"${info['revenue']:,.2f}"
            ])
        
        method_table = Table(method_data, colWidths=[2*inch, 1.5*inch, 1.5*inch])
        method_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_COLOR),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(method_table)
        elements.append(Spacer(1, 20))
    
    # Top Coupons
    if data["top_coupons"]:
        elements.append(Paragraph("Top Used Coupons", heading_style))
        
        coupon_data = [["Rank", "Code", "Uses", "Total Discount"]]
        for idx, (code, info) in enumerate(data["top_coupons"], 1):
            coupon_data.append([
                f"#{idx}",
                code,
                str(info["count"]),
                f"${info['discount']:,.2f}"
            ])
        
        coupon_table = Table(coupon_data, colWidths=[0.7*inch, 1.5*inch, 1*inch, 1.5*inch])
        coupon_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_COLOR),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(coupon_table)
        elements.append(Spacer(1, 20))
    
    # Footer
    elements.append(Spacer(1, 30))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.gray,
        alignment=1
    )
    elements.append(Paragraph("© 2026 DataLife AI Services - Confidential Report", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


async def send_report_email(pdf_buffer: BytesIO, report_type: str, recipient: str, period: dict):
    """Send PDF report via email"""
    
    if not SMTP_CONFIG["host"] or not SMTP_CONFIG["email"]:
        raise HTTPException(status_code=500, detail="SMTP not configured")
    
    report_title = "Weekly" if report_type == "weekly" else "Monthly"
    
    msg = MIMEMultipart()
    msg['Subject'] = f"📊 DataLife Account {report_title} Report - {period['start']} to {period['end']}"
    msg['From'] = SMTP_CONFIG["email"]
    msg['To'] = recipient
    
    # Email body
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28376B 0%, #1e2a52 100%); padding: 25px; border-radius: 10px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">📊 {report_title} Sales Report</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">تقرير المبيعات {"الأسبوعي" if report_type == "weekly" else "الشهري"}</p>
        </div>
        
        <div style="padding: 25px; background: #fff; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333;">
                Please find attached the {report_title.lower()} sales report for the period:<br>
                <strong>{period['start']} to {period['end']}</strong>
            </p>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #1565c0; font-size: 14px;">
                    <strong>📎 Attachment:</strong> {report_type}_report_{period['start']}.pdf
                </p>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{FRONTEND_URL}/dashboard" 
                   style="display: inline-block; background: #28376B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    View Dashboard →
                </a>
            </div>
        </div>
        
        <p style="margin-top: 20px; font-size: 12px; color: #999; text-align: center;">
            This is an automated report from DataLife Account
        </p>
    </div>
    """
    
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))
    
    # Attach PDF
    pdf_attachment = MIMEApplication(pdf_buffer.read(), _subtype='pdf')
    pdf_attachment.add_header('Content-Disposition', 'attachment', 
                              filename=f"{report_type}_report_{period['start']}.pdf")
    msg.attach(pdf_attachment)
    
    # Send email
    try:
        if SMTP_CONFIG["use_ssl"] or SMTP_CONFIG["port"] == 465:
            import ssl
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(SMTP_CONFIG["host"], SMTP_CONFIG["port"], context=context) as server:
                server.login(SMTP_CONFIG["email"], SMTP_CONFIG["password"])
                server.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_CONFIG["host"], SMTP_CONFIG["port"]) as server:
                server.starttls()
                server.login(SMTP_CONFIG["email"], SMTP_CONFIG["password"])
                server.send_message(msg)
        
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


@router.post("/generate")
async def generate_report(request: ReportRequest):
    """Generate a sales report (PDF)"""
    
    now = datetime.now(timezone.utc)
    
    # Calculate date range
    if request.start_date and request.end_date:
        start_date = datetime.fromisoformat(request.start_date.replace("Z", "+00:00"))
        end_date = datetime.fromisoformat(request.end_date.replace("Z", "+00:00"))
    elif request.report_type == "weekly":
        # Last 7 days
        end_date = now
        start_date = now - timedelta(days=7)
    else:
        # Last 30 days (monthly)
        end_date = now
        start_date = now - timedelta(days=30)
    
    # Get data
    data = await get_report_data(start_date, end_date)
    
    # Generate PDF
    pdf_buffer = generate_pdf_report(data, request.report_type)
    
    # Send email if requested
    if request.send_email:
        recipient = request.email_to or SMTP_CONFIG["email"]
        pdf_buffer_copy = BytesIO(pdf_buffer.getvalue())
        await send_report_email(pdf_buffer_copy, request.report_type, recipient, data["period"])
        
        # Log report
        await db.report_logs.insert_one({
            "report_type": request.report_type,
            "period": data["period"],
            "sent_to": recipient,
            "generated_at": now.isoformat(),
            "status": "sent"
        })
        
        return {
            "message": f"Report generated and sent to {recipient}",
            "period": data["period"],
            "summary": data["summary"]
        }
    
    # Log report
    await db.report_logs.insert_one({
        "report_type": request.report_type,
        "period": data["period"],
        "generated_at": now.isoformat(),
        "status": "generated"
    })
    
    return {
        "message": "Report generated successfully",
        "period": data["period"],
        "summary": data["summary"]
    }


@router.get("/download/{report_type}")
async def download_report(report_type: str, days: int = 7):
    """Download PDF report"""
    
    now = datetime.now(timezone.utc)
    
    if report_type == "weekly":
        start_date = now - timedelta(days=7)
    elif report_type == "monthly":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(days=days)
    
    end_date = now
    
    # Get data and generate PDF
    data = await get_report_data(start_date, end_date)
    pdf_buffer = generate_pdf_report(data, report_type)
    
    filename = f"{report_type}_report_{data['period']['start']}.pdf"
    
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/history")
async def get_report_history(limit: int = 20):
    """Get history of generated reports"""
    
    reports = await db.report_logs.find(
        {}, 
        {"_id": 0}
    ).sort("generated_at", -1).limit(limit).to_list(limit)
    
    return {"reports": reports, "total": len(reports)}


@router.post("/send-now/{report_type}")
async def send_report_now(report_type: str, email_to: str = None):
    """Generate and send report immediately"""
    
    now = datetime.now(timezone.utc)
    
    if report_type == "weekly":
        start_date = now - timedelta(days=7)
    else:
        start_date = now - timedelta(days=30)
    
    end_date = now
    recipient = email_to or SMTP_CONFIG["email"]
    
    # Get data and generate PDF
    data = await get_report_data(start_date, end_date)
    pdf_buffer = generate_pdf_report(data, report_type)
    
    # Send email
    await send_report_email(pdf_buffer, report_type, recipient, data["period"])
    
    # Log
    await db.report_logs.insert_one({
        "report_type": report_type,
        "period": data["period"],
        "sent_to": recipient,
        "generated_at": now.isoformat(),
        "status": "sent"
    })
    
    return {
        "message": f"{report_type.capitalize()} report sent to {recipient}",
        "period": data["period"],
        "summary": data["summary"]
    }
