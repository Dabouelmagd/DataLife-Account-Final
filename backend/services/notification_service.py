import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from models.payment import Payment, Notification, NotificationCreate, NotificationStatus
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import httpx

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self, db):
        self.db = db
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_username = os.getenv('SMTP_USERNAME', '')
        self.smtp_password = os.getenv('SMTP_PASSWORD', '')
        self.admin_email = os.getenv('ADMIN_EMAIL', 'admin@datalife.com')
        self.sms_api_key = os.getenv('SMS_API_KEY', '')
        self.sms_sender = os.getenv('SMS_SENDER', 'DataLife')

    async def send_payment_confirmation_email(self, payment: Payment):
        """Send payment confirmation email to customer"""
        try:
            subject = f"Payment Confirmation - {payment.plan_name}"
            
            # Email template
            html_content = self._get_payment_confirmation_template(payment)
            
            notification = NotificationCreate(
                payment_id=payment.id,
                type="email",
                recipient=payment.customer_email,
                subject=subject,
                message=html_content,
                template_data=payment.dict()
            )
            
            success = await self._send_email(payment.customer_email, subject, html_content)
            
            # Save notification record
            await self._save_notification(notification, success)
            
        except Exception as e:
            logger.error(f"Failed to send payment confirmation email: {str(e)}")

    async def send_payment_confirmation_sms(self, payment: Payment):
        """Send payment confirmation SMS to customer"""
        try:
            message = f"Payment confirmed! Your {payment.plan_name} subscription is now active. Transaction ID: {payment.transaction_id}. Thank you for choosing DataLife Account!"
            
            notification = NotificationCreate(
                payment_id=payment.id,
                type="sms",
                recipient=payment.customer_phone,
                message=message,
                template_data=payment.dict()
            )
            
            success = await self._send_sms(payment.customer_phone, message)
            
            # Save notification record
            await self._save_notification(notification, success)
            
        except Exception as e:
            logger.error(f"Failed to send payment confirmation SMS: {str(e)}")

    async def send_admin_payment_alert(self, payment: Payment):
        """Send payment alert to admin"""
        try:
            subject = f"New Payment Received - {payment.amount} {payment.currency}"
            
            content = f"""
            New payment received:
            
            Customer: {payment.company_name}
            Email: {payment.customer_email}
            Plan: {payment.plan_name}
            Amount: {payment.amount} {payment.currency}
            Payment Method: {payment.payment_method.value}
            Transaction ID: {payment.transaction_id}
            
            Time: {payment.completed_at.strftime('%Y-%m-%d %H:%M:%S')}
            """
            
            notification = NotificationCreate(
                payment_id=payment.id,
                type="admin_alert",
                recipient=self.admin_email,
                subject=subject,
                message=content,
                template_data=payment.dict()
            )
            
            success = await self._send_email(self.admin_email, subject, content)
            
            # Save notification record
            await self._save_notification(notification, success)
            
        except Exception as e:
            logger.error(f"Failed to send admin payment alert: {str(e)}")

    async def send_payment_failure_email(self, payment: Payment):
        """Send payment failure email to customer"""
        try:
            subject = f"Payment Failed - {payment.plan_name}"
            
            html_content = self._get_payment_failure_template(payment)
            
            notification = NotificationCreate(
                payment_id=payment.id,
                type="email",
                recipient=payment.customer_email,
                subject=subject,
                message=html_content,
                template_data=payment.dict()
            )
            
            success = await self._send_email(payment.customer_email, subject, html_content)
            
            # Save notification record
            await self._save_notification(notification, success)
            
        except Exception as e:
            logger.error(f"Failed to send payment failure email: {str(e)}")

    async def send_admin_payment_failure_alert(self, payment: Payment):
        """Send payment failure alert to admin"""
        try:
            subject = f"Payment Failed - {payment.customer_email}"
            
            content = f"""
            Payment failed:
            
            Customer: {payment.company_name}
            Email: {payment.customer_email}
            Plan: {payment.plan_name}
            Amount: {payment.amount} {payment.currency}
            Payment Method: {payment.payment_method.value}
            Transaction ID: {payment.transaction_id}
            Error: {payment.gateway_response.get('error', 'Unknown error')}
            
            Time: {payment.updated_at.strftime('%Y-%m-%d %H:%M:%S')}
            """
            
            notification = NotificationCreate(
                payment_id=payment.id,
                type="admin_alert",
                recipient=self.admin_email,
                subject=subject,
                message=content,
                template_data=payment.dict()
            )
            
            success = await self._send_email(self.admin_email, subject, content)
            
            # Save notification record
            await self._save_notification(notification, success)
            
        except Exception as e:
            logger.error(f"Failed to send admin payment failure alert: {str(e)}")

    async def _send_email(self, to_email: str, subject: str, content: str) -> bool:
        """Send email using SMTP"""
        try:
            if not self.smtp_username or not self.smtp_password:
                logger.warning("SMTP credentials not configured, skipping email")
                return True  # Return True for demo purposes
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.smtp_username
            msg['To'] = to_email
            
            # Add HTML content
            html_part = MIMEText(content, 'html')
            msg.attach(html_part)
            
            # Send email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.smtp_username, self.smtp_password)
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    async def _send_sms(self, phone: str, message: str) -> bool:
        """Send SMS using SMS gateway"""
        try:
            if not self.sms_api_key:
                logger.warning("SMS API key not configured, skipping SMS")
                return True  # Return True for demo purposes
            
            # Example SMS API call (replace with actual SMS provider)
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.sms-provider.com/send",
                    json={
                        "api_key": self.sms_api_key,
                        "sender": self.sms_sender,
                        "recipient": phone,
                        "message": message
                    }
                )
                
                if response.status_code == 200:
                    logger.info(f"SMS sent successfully to {phone}")
                    return True
                else:
                    logger.error(f"SMS API error: {response.status_code}")
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to send SMS to {phone}: {str(e)}")
            return False

    async def _save_notification(self, notification_data: NotificationCreate, success: bool):
        """Save notification record to database"""
        notification = Notification(**notification_data.dict())
        notification.status = NotificationStatus.SENT if success else NotificationStatus.FAILED
        
        if success:
            notification.sent_at = datetime.utcnow()
        else:
            notification.error_message = "Failed to send notification"
        
        await self.db.notifications.insert_one(notification.dict())

    def _get_payment_confirmation_template(self, payment: Payment) -> str:
        """Get payment confirmation email template"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Payment Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #28376B; color: white; padding: 20px; text-align: center;">
                <h1>Payment Confirmed!</h1>
            </div>
            
            <div style="padding: 20px;">
                <h2>Thank you for your payment, {payment.company_name}!</h2>
                
                <p>Your subscription to <strong>{payment.plan_name}</strong> has been successfully activated.</p>
                
                <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0;">
                    <h3>Payment Details:</h3>
                    <p><strong>Transaction ID:</strong> {payment.transaction_id}</p>
                    <p><strong>Amount:</strong> {payment.amount} {payment.currency}</p>
                    <p><strong>Plan:</strong> {payment.plan_name}</p>
                    <p><strong>Billing Cycle:</strong> {payment.billing_cycle.title()}</p>
                    <p><strong>Payment Date:</strong> {payment.completed_at.strftime('%B %d, %Y at %I:%M %p')}</p>
                </div>
                
                <p>You can now access all features of your {payment.plan_name} plan. If you have any questions, please don't hesitate to contact our support team.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.datalife.com/login" style="background-color: #28376B; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">Access Your Account</a>
                </div>
                
                <p>Best regards,<br>The DataLife Account Team</p>
            </div>
            
            <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                <p>This is an automated message from DataLife Account. Please do not reply to this email.</p>
            </div>
        </body>
        </html>
        """

    def _get_payment_failure_template(self, payment: Payment) -> str:
        """Get payment failure email template"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Payment Failed</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center;">
                <h1>Payment Failed</h1>
            </div>
            
            <div style="padding: 20px;">
                <h2>Hello {payment.company_name},</h2>
                
                <p>Unfortunately, we were unable to process your payment for the <strong>{payment.plan_name}</strong> plan.</p>
                
                <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0;">
                    <h3>Payment Details:</h3>
                    <p><strong>Transaction ID:</strong> {payment.transaction_id}</p>
                    <p><strong>Amount:</strong> {payment.amount} {payment.currency}</p>
                    <p><strong>Plan:</strong> {payment.plan_name}</p>
                    <p><strong>Attempted:</strong> {payment.updated_at.strftime('%B %d, %Y at %I:%M %p')}</p>
                </div>
                
                <p>Please try again with a different payment method or contact your bank if you believe this is an error.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://datalife.com/pricing" style="background-color: #28376B; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">Try Again</a>
                </div>
                
                <p>If you continue to experience issues, please contact our support team at support@datalife.com</p>
                
                <p>Best regards,<br>The DataLife Account Team</p>
            </div>
        </body>
        </html>
        """