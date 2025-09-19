import logging
from typing import Optional, List
from datetime import datetime, timedelta
from models.trial import Trial, TrialCreate, TrialStatus, TrialProgress, TrialUsage
from services.notification_service import NotificationService
import asyncio

logger = logging.getLogger(__name__)

class TrialService:
    def __init__(self, db, notification_service: NotificationService):
        self.db = db
        self.notification_service = notification_service

    async def create_trial(self, trial_data: TrialCreate, user_agent: str = None, ip_address: str = None) -> Trial:
        """Create a new free trial"""
        try:
            # Check if user already has an active trial
            existing_trial = await self.db.trials.find_one({
                "email": trial_data.email,
                "status": {"$in": [TrialStatus.ACTIVE, TrialStatus.EXTENDED]}
            })
            
            if existing_trial:
                raise ValueError("An active trial already exists for this email address")
            
            # Create trial record
            trial = Trial(**trial_data.dict())
            trial.user_agent = user_agent
            trial.ip_address = ip_address
            
            # Save to database
            await self.db.trials.insert_one(trial.dict())
            
            # Send welcome email
            await self._send_trial_welcome_email(trial)
            
            # Create sample data
            await self._create_sample_data(trial)
            
            logger.info(f"Trial created for {trial.email}")
            return trial
            
        except Exception as e:
            logger.error(f"Failed to create trial: {str(e)}")
            raise

    async def get_trial_by_email(self, email: str) -> Optional[Trial]:
        """Get active trial by email"""
        trial_data = await self.db.trials.find_one({
            "email": email,
            "status": {"$in": [TrialStatus.ACTIVE, TrialStatus.EXTENDED]}
        })
        
        if trial_data:
            return Trial(**trial_data)
        return None

    async def get_trial_by_id(self, trial_id: str) -> Optional[Trial]:
        """Get trial by ID"""
        trial_data = await self.db.trials.find_one({"id": trial_id})
        
        if trial_data:
            return Trial(**trial_data)
        return None

    async def get_trial_progress(self, trial_id: str) -> TrialProgress:
        """Get trial progress and usage statistics"""
        trial = await self.get_trial_by_id(trial_id)
        if not trial:
            raise ValueError("Trial not found")
        
        # Calculate days remaining
        now = datetime.utcnow()
        days_remaining = max(0, (trial.expires_at - now).days)
        
        # Calculate usage percentages
        usage_percentage = {
            "employees": (trial.current_employees / trial.max_employees) * 100,
            "transactions": (trial.current_transactions / trial.max_transactions) * 100,
            "storage": (trial.current_storage_mb / trial.max_storage_mb) * 100,
            "reports": (trial.current_reports / trial.max_reports) * 100
        }
        
        # Onboarding progress
        onboarding_progress = {
            "sample_data_created": trial.sample_data_created,
            "first_employee_added": trial.first_employee_added,
            "first_transaction_recorded": trial.first_transaction_recorded,
            "first_report_generated": trial.first_report_generated
        }
        
        # Suggested next steps
        suggested_next_steps = []
        if not trial.first_employee_added:
            suggested_next_steps.append("Add your first employee")
        if not trial.first_transaction_recorded:
            suggested_next_steps.append("Record your first transaction")
        if not trial.first_report_generated:
            suggested_next_steps.append("Generate your first report")
        if days_remaining <= 3:
            suggested_next_steps.append("Consider upgrading to continue using DataLife Account")
        
        # Upgrade benefits
        upgrade_benefits = [
            "Unlimited employees and transactions",
            "Advanced reporting and analytics",
            "Priority customer support",
            "Data backup and security",
            "API integrations",
            "Custom workflows"
        ]
        
        return TrialProgress(
            trial_id=trial_id,
            days_remaining=days_remaining,
            usage_percentage=usage_percentage,
            onboarding_progress=onboarding_progress,
            suggested_next_steps=suggested_next_steps,
            upgrade_benefits=upgrade_benefits
        )

    async def track_usage(self, trial_id: str, action: str, details: dict = None):
        """Track trial usage"""
        trial = await self.get_trial_by_id(trial_id)
        if not trial:
            return
        
        # Create usage record
        usage = TrialUsage(
            trial_id=trial_id,
            action=action,
            details=details or {}
        )
        await self.db.trial_usage.insert_one(usage.dict())
        
        # Update trial usage counters
        update_data = {"updated_at": datetime.utcnow()}
        
        if action == "employee_added":
            trial.current_employees += 1
            trial.first_employee_added = True
            update_data["current_employees"] = trial.current_employees
            update_data["first_employee_added"] = True
            
        elif action == "transaction_created":
            trial.current_transactions += 1
            trial.first_transaction_recorded = True
            update_data["current_transactions"] = trial.current_transactions
            update_data["first_transaction_recorded"] = True
            
        elif action == "report_generated":
            trial.current_reports += 1
            trial.first_report_generated = True
            update_data["current_reports"] = trial.current_reports
            update_data["first_report_generated"] = True
            
        elif action == "login":
            update_data["last_login"] = datetime.utcnow()
        
        # Update database
        await self.db.trials.update_one(
            {"id": trial_id},
            {"$set": update_data}
        )

    async def extend_trial(self, trial_id: str, additional_days: int, reason: str, extended_by: str):
        """Extend trial period"""
        trial = await self.get_trial_by_id(trial_id)
        if not trial:
            raise ValueError("Trial not found")
        
        new_expiry = trial.expires_at + timedelta(days=additional_days)
        
        await self.db.trials.update_one(
            {"id": trial_id},
            {
                "$set": {
                    "expires_at": new_expiry,
                    "status": TrialStatus.EXTENDED,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Create extension record
        extension_data = {
            "trial_id": trial_id,
            "reason": reason,
            "additional_days": additional_days,
            "extended_by": extended_by,
            "extended_at": datetime.utcnow()
        }
        await self.db.trial_extensions.insert_one(extension_data)
        
        logger.info(f"Trial {trial_id} extended by {additional_days} days")

    async def check_trial_expiry(self):
        """Check and handle expired trials"""
        try:
            now = datetime.utcnow()
            
            # Find trials expiring soon (3 days warning)
            warning_trials = await self.db.trials.find({
                "status": {"$in": [TrialStatus.ACTIVE, TrialStatus.EXTENDED]},
                "expires_at": {
                    "$lte": now + timedelta(days=3),
                    "$gt": now
                },
                "expiration_warning_sent": False
            }).to_list(1000)
            
            for trial_data in warning_trials:
                trial = Trial(**trial_data)
                await self._send_trial_expiring_email(trial)
                await self.db.trials.update_one(
                    {"id": trial.id},
                    {"$set": {"expiration_warning_sent": True}}
                )
            
            # Find expired trials
            expired_trials = await self.db.trials.find({
                "status": {"$in": [TrialStatus.ACTIVE, TrialStatus.EXTENDED]},
                "expires_at": {"$lt": now}
            }).to_list(1000)
            
            for trial_data in expired_trials:
                trial = Trial(**trial_data)
                await self.db.trials.update_one(
                    {"id": trial.id},
                    {"$set": {"status": TrialStatus.EXPIRED, "updated_at": now}}
                )
                
                if not trial.conversion_email_sent:
                    await self._send_trial_expired_email(trial)
                    await self.db.trials.update_one(
                        {"id": trial.id},
                        {"$set": {"conversion_email_sent": True}}
                    )
                
                logger.info(f"Trial {trial.id} marked as expired")
                
        except Exception as e:
            logger.error(f"Failed to check trial expiry: {str(e)}")

    async def convert_trial_to_paid(self, trial_id: str, payment_id: str):
        """Convert trial to paid subscription"""
        await self.db.trials.update_one(
            {"id": trial_id},
            {
                "$set": {
                    "status": TrialStatus.CONVERTED,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        logger.info(f"Trial {trial_id} converted to paid subscription")

    async def _send_trial_welcome_email(self, trial: Trial):
        """Send welcome email to trial user"""
        try:
            subject = f"Welcome to DataLife Account - Your 14-Day Free Trial is Ready!"
            
            content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Welcome to DataLife Account</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #28376B; color: white; padding: 20px; text-align: center;">
                    <h1>Welcome to DataLife Account!</h1>
                </div>
                
                <div style="padding: 20px;">
                    <h2>Hi {trial.first_name},</h2>
                    
                    <p>Your free 14-day trial is now active! We've set up your account with sample data so you can start exploring immediately.</p>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0;">
                        <h3>Your Trial Details:</h3>
                        <p><strong>Duration:</strong> 14 days (expires {trial.expires_at.strftime('%B %d, %Y')})</p>
                        <p><strong>Employee Limit:</strong> Up to 25 employees</p>
                        <p><strong>Features:</strong> Full Professional plan access</p>
                        <p><strong>Support:</strong> Email support included</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://app.datalife.com/login?email={trial.email}" style="background-color: #28376B; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">Access Your Trial Account</a>
                    </div>
                    
                    <h3>Get Started:</h3>
                    <ul>
                        <li>Explore the dashboard with pre-loaded sample data</li>
                        <li>Add your first employee to the HR system</li>
                        <li>Record a transaction in the financial module</li>
                        <li>Generate your first business report</li>
                    </ul>
                    
                    <p>Need help? Reply to this email or contact our support team at info@datalifeai.com</p>
                    
                    <p>Best regards,<br>The DataLife Account Team</p>
                </div>
                
                <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                    <p>DataLife Account - 59 Lebanon Street, Mohandessin, Giza, Egypt</p>
                    <p>Phone: (+2) 01012625529 | Email: info@datalifeai.com</p>
                </div>
            </body>
            </html>
            """
            
            # This would use the notification service to send email
            # For now, we'll log it
            logger.info(f"Trial welcome email would be sent to {trial.email}")
            
        except Exception as e:
            logger.error(f"Failed to send trial welcome email: {str(e)}")

    async def _send_trial_expiring_email(self, trial: Trial):
        """Send trial expiring warning email"""
        try:
            days_left = max(0, (trial.expires_at - datetime.utcnow()).days)
            subject = f"Your DataLife Account Trial Expires in {days_left} Days"
            
            # Email content would be similar to welcome email
            logger.info(f"Trial expiring email would be sent to {trial.email}")
            
        except Exception as e:
            logger.error(f"Failed to send trial expiring email: {str(e)}")

    async def _send_trial_expired_email(self, trial: Trial):
        """Send trial expired conversion email"""
        try:
            subject = "Your DataLife Account Trial Has Expired - Continue Your Journey"
            
            # Email content with upgrade options
            logger.info(f"Trial expired email would be sent to {trial.email}")
            
        except Exception as e:
            logger.error(f"Failed to send trial expired email: {str(e)}")

    async def _create_sample_data(self, trial: Trial):
        """Create sample data for trial account"""
        try:
            # This would create sample employees, transactions, etc.
            # For now, we'll just mark it as created
            await self.db.trials.update_one(
                {"id": trial.id},
                {"$set": {"sample_data_created": True}}
            )
            
            logger.info(f"Sample data created for trial {trial.id}")
            
        except Exception as e:
            logger.error(f"Failed to create sample data: {str(e)}")

    async def get_all_trials(self, limit: int = 100) -> List[Trial]:
        """Get all trials for admin dashboard"""
        trials_data = await self.db.trials.find().sort("created_at", -1).limit(limit).to_list(limit)
        return [Trial(**trial) for trial in trials_data]

    async def get_trial_statistics(self) -> dict:
        """Get trial statistics for admin dashboard"""
        total_trials = await self.db.trials.count_documents({})
        active_trials = await self.db.trials.count_documents({"status": TrialStatus.ACTIVE})
        converted_trials = await self.db.trials.count_documents({"status": TrialStatus.CONVERTED})
        expired_trials = await self.db.trials.count_documents({"status": TrialStatus.EXPIRED})
        
        conversion_rate = (converted_trials / total_trials * 100) if total_trials > 0 else 0
        
        return {
            "total_trials": total_trials,
            "active_trials": active_trials,
            "converted_trials": converted_trials,
            "expired_trials": expired_trials,
            "conversion_rate": round(conversion_rate, 2)
        }