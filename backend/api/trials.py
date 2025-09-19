from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from models.trial import TrialCreate, Trial, TrialProgress
from services.trial_service import TrialService
from services.notification_service import NotificationService
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/trials", tags=["trials"])

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize services
notification_service = NotificationService(db)
trial_service = TrialService(db, notification_service)

@router.post("/", response_model=Trial)
async def create_trial(trial_data: TrialCreate, request: Request):
    """Create a new free trial"""
    try:
        user_agent = request.headers.get("user-agent")
        # Get client IP (considering potential proxy)
        ip_address = request.client.host
        
        trial = await trial_service.create_trial(trial_data, user_agent, ip_address)
        return trial
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create trial")

@router.get("/customer/{email}")
async def get_customer_trial(email: str):
    """Get active trial for customer"""
    trial = await trial_service.get_trial_by_email(email)
    if not trial:
        raise HTTPException(status_code=404, detail="No active trial found")
    return trial

@router.get("/{trial_id}", response_model=Trial)
async def get_trial(trial_id: str):
    """Get trial by ID"""
    trial = await trial_service.get_trial_by_id(trial_id)
    if not trial:
        raise HTTPException(status_code=404, detail="Trial not found")
    return trial

@router.get("/{trial_id}/progress", response_model=TrialProgress)
async def get_trial_progress(trial_id: str):
    """Get trial progress and usage statistics"""
    try:
        progress = await trial_service.get_trial_progress(trial_id)
        return progress
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get trial progress")

@router.post("/{trial_id}/track-usage")
async def track_trial_usage(trial_id: str, action: str, details: dict = None):
    """Track trial usage"""
    try:
        await trial_service.track_usage(trial_id, action, details)
        return {"status": "success", "message": "Usage tracked successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to track usage")

@router.post("/{trial_id}/extend")
async def extend_trial(trial_id: str, additional_days: int, reason: str, extended_by: str = "admin"):
    """Extend trial period (admin only)"""
    try:
        await trial_service.extend_trial(trial_id, additional_days, reason, extended_by)
        return {"status": "success", "message": f"Trial extended by {additional_days} days"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to extend trial")

@router.post("/{trial_id}/convert")
async def convert_trial(trial_id: str, payment_id: str):
    """Convert trial to paid subscription"""
    try:
        await trial_service.convert_trial_to_paid(trial_id, payment_id)
        return {"status": "success", "message": "Trial converted to paid subscription"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to convert trial")

@router.post("/check-expiry")
async def check_trial_expiry():
    """Check and handle expired trials (admin/cron job)"""
    try:
        await trial_service.check_trial_expiry()
        return {"status": "success", "message": "Trial expiry check completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to check trial expiry")

@router.get("/admin/all")
async def get_all_trials(limit: int = 100):
    """Get all trials for admin dashboard"""
    try:
        trials = await trial_service.get_all_trials(limit)
        return trials
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get trials")

@router.get("/admin/statistics")
async def get_trial_statistics():
    """Get trial statistics for admin dashboard"""
    try:
        stats = await trial_service.get_trial_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get trial statistics")