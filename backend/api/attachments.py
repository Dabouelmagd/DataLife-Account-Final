from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header
from typing import Optional, List
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import base64
import mimetypes

router = APIRouter(prefix="/api/attachments", tags=["Attachments"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "datalifeaccount")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Configuration
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = None  # None means all files allowed

# Helper function to verify token
async def verify_token(authorization: str):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    from services.auth_service import verify_token as auth_verify
    token = authorization.split(" ")[1]
    user_data = auth_verify(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return user_data


@router.post("/upload")
async def upload_attachment(
    file: UploadFile = File(...),
    entity_type: str = Form(...),  # invoice, purchase_order, approval, etc.
    entity_id: str = Form(...),
    description: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None)
):
    """Upload an attachment to any entity"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    user_id = user_data.get("user_id")
    
    # Read file content
    content = await file.read()
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"File size exceeds maximum allowed ({MAX_FILE_SIZE // (1024*1024)} MB)"
        )
    
    # Get file info
    filename = file.filename
    content_type = file.content_type or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
    file_size = len(content)
    file_extension = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    
    # Generate unique ID
    attachment_id = f"att_{uuid.uuid4().hex[:12]}"
    
    # Store file as base64 in MongoDB (for simplicity)
    # In production, use cloud storage like S3
    file_data = base64.b64encode(content).decode('utf-8')
    
    attachment = {
        "id": attachment_id,
        "company_id": company_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "filename": filename,
        "content_type": content_type,
        "file_size": file_size,
        "file_extension": file_extension,
        "description": description,
        "file_data": file_data,
        "uploaded_by": user_id,
        "uploaded_by_name": user_data.get("name", "Unknown"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.attachments.insert_one(attachment)
    
    # Return response without _id and file_data
    response = {
        "id": attachment_id,
        "company_id": company_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "filename": filename,
        "content_type": content_type,
        "file_size": file_size,
        "file_extension": file_extension,
        "description": description,
        "uploaded_by": user_id,
        "uploaded_by_name": user_data.get("name", "Unknown"),
        "created_at": attachment["created_at"]
    }
    
    return response


@router.get("/entity/{entity_type}/{entity_id}")
async def get_entity_attachments(
    entity_type: str,
    entity_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get all attachments for an entity"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    attachments = await db.attachments.find(
        {
            "company_id": company_id,
            "entity_type": entity_type,
            "entity_id": entity_id
        },
        {"_id": 0, "file_data": 0}  # Exclude file_data for listing
    ).sort("created_at", -1).to_list(length=None)
    
    return attachments


@router.get("/{attachment_id}")
async def get_attachment(
    attachment_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get attachment metadata (without file data)"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    attachment = await db.attachments.find_one(
        {"id": attachment_id, "company_id": company_id},
        {"_id": 0, "file_data": 0}
    )
    
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    return attachment


@router.get("/{attachment_id}/download")
async def download_attachment(
    attachment_id: str,
    authorization: Optional[str] = Header(None)
):
    """Download attachment file"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    attachment = await db.attachments.find_one(
        {"id": attachment_id, "company_id": company_id}
    )
    
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Return file data as base64 with metadata
    return {
        "filename": attachment.get("filename"),
        "content_type": attachment.get("content_type"),
        "file_data": attachment.get("file_data")
    }


@router.delete("/{attachment_id}")
async def delete_attachment(
    attachment_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete an attachment"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    attachment = await db.attachments.find_one(
        {"id": attachment_id, "company_id": company_id}
    )
    
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    await db.attachments.delete_one({"id": attachment_id})
    
    # Broadcast update
    await broadcast_update(company_id, "attachment_deleted", {
        "entity_type": attachment.get("entity_type"),
        "entity_id": attachment.get("entity_id"),
        "attachment_id": attachment_id
    })
    
    return {"success": True, "message": "Attachment deleted"}


# ============ REAL-TIME SYNC ============

from fastapi import WebSocket, WebSocketDisconnect
import json

# Store active WebSocket connections by company
active_connections: dict = {}  # company_id -> list of WebSocket connections


@router.websocket("/ws/sync/{company_id}")
async def websocket_sync(websocket: WebSocket, company_id: str):
    """WebSocket endpoint for real-time data sync across devices"""
    await websocket.accept()
    
    # Add to active connections
    if company_id not in active_connections:
        active_connections[company_id] = []
    active_connections[company_id].append(websocket)
    
    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif message.get("type") == "subscribe":
                # Client subscribing to specific entity updates
                pass
            
    except WebSocketDisconnect:
        # Remove from active connections
        if company_id in active_connections:
            active_connections[company_id].remove(websocket)
            if not active_connections[company_id]:
                del active_connections[company_id]


async def broadcast_update(company_id: str, event_type: str, data: dict):
    """Broadcast update to all connected clients for a company"""
    if company_id not in active_connections:
        return
    
    message = json.dumps({
        "type": event_type,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # Send to all connected clients
    disconnected = []
    for websocket in active_connections[company_id]:
        try:
            await websocket.send_text(message)
        except:
            disconnected.append(websocket)
    
    # Clean up disconnected clients
    for ws in disconnected:
        active_connections[company_id].remove(ws)


# Export broadcast function for use by other modules
def get_broadcast_function():
    return broadcast_update
