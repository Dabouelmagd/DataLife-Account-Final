from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime, timezone

router = APIRouter(prefix="/api/contact", tags=["contact"])

# Get database
from database import db

class ContactMessage(BaseModel):
    name: str
    email: EmailStr
    message: str


def send_email_smtp(to_email: str, subject: str, html_content: str) -> bool:
    """Send email using SMTP"""
    try:
        smtp_host = os.environ.get("SMTP_HOST", "mail.datalifeai.com")
        smtp_port = int(os.environ.get("SMTP_PORT", "465"))
        smtp_email = os.environ.get("SMTP_EMAIL", "info@datalifeai.com")
        smtp_password = os.environ.get("SMTP_PASSWORD", "")
        
        if not smtp_password:
            return False
        
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_email
        msg["To"] = to_email
        
        # Attach HTML content
        html_part = MIMEText(html_content, "html", "utf-8")
        msg.attach(html_part)
        
        # Send using SSL
        with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
            server.login(smtp_email, smtp_password)
            server.sendmail(smtp_email, to_email, msg.as_string())
        
        return True
    except Exception as e:
        print(f"SMTP Error: {e}")
        return False


@router.post("/send")
async def send_contact_message(contact: ContactMessage):
    """Receive contact form message and send email notification"""
    try:
        # Save message to database
        message_data = {
            "name": contact.name,
            "email": contact.email,
            "message": contact.message,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "new",
            "read": False
        }
        
        result = await db.contact_messages.insert_one(message_data)
        
        # Prepare email to admin
        admin_email = os.environ.get("SMTP_EMAIL", "info@datalifeai.com")
        
        admin_html = f"""
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; direction: rtl; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #28376B, #1e2a5a); color: white; padding: 20px; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }}
                .field {{ margin-bottom: 15px; }}
                .label {{ font-weight: bold; color: #28376B; }}
                .value {{ background: white; padding: 10px; border-radius: 5px; margin-top: 5px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>📩 رسالة جديدة من موقع DataLife</h2>
                </div>
                <div class="content">
                    <div class="field">
                        <div class="label">الاسم:</div>
                        <div class="value">{contact.name}</div>
                    </div>
                    <div class="field">
                        <div class="label">البريد الإلكتروني:</div>
                        <div class="value">{contact.email}</div>
                    </div>
                    <div class="field">
                        <div class="label">الرسالة:</div>
                        <div class="value">{contact.message}</div>
                    </div>
                    <div class="field">
                        <div class="label">التاريخ:</div>
                        <div class="value">{datetime.now().strftime('%Y-%m-%d %H:%M')}</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Send email to admin
        email_sent = send_email_smtp(
            admin_email,
            f"رسالة جديدة من {contact.name} - DataLife",
            admin_html
        )
        
        # Send confirmation email to user
        user_html = f"""
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; direction: rtl; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #28376B, #1e2a5a); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }}
                .content {{ background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }}
                .message {{ background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>شكراً لتواصلك معنا! 🙏</h2>
                </div>
                <div class="content">
                    <p>مرحباً <strong>{contact.name}</strong>،</p>
                    <p>شكراً لتواصلك مع فريق DataLife. لقد استلمنا رسالتك وسنقوم بالرد عليك في أقرب وقت ممكن.</p>
                    
                    <div class="message">
                        <strong>رسالتك:</strong>
                        <p>{contact.message}</p>
                    </div>
                    
                    <p>مع أطيب التحيات،<br>فريق DataLife</p>
                </div>
                <div class="footer">
                    <p>© 2025 DataLife Account. جميع الحقوق محفوظة.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        send_email_smtp(
            contact.email,
            "شكراً لتواصلك مع DataLife",
            user_html
        )
        
        return {
            "success": True,
            "message": "تم إرسال رسالتك بنجاح" if email_sent else "تم حفظ رسالتك وسيتم التواصل معك قريباً",
            "email_sent": email_sent
        }
        
    except Exception as e:
        print(f"Contact form error: {e}")
        raise HTTPException(status_code=500, detail="حدث خطأ في إرسال الرسالة")


@router.get("/messages")
async def get_contact_messages():
    """Get all contact messages (admin only)"""
    messages = await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    return messages


@router.put("/messages/mark-read")
async def mark_messages_as_read():
    """Mark all messages as read"""
    result = await db.contact_messages.update_many(
        {"read": False},
        {"$set": {"read": True}}
    )
    return {
        "success": True,
        "updated_count": result.modified_count
    }
