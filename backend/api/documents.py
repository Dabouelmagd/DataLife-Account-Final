from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
from typing import Optional, List
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import secrets
import string
import base64

router = APIRouter(prefix="/api/documents", tags=["documents"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# File storage path
UPLOAD_DIR = "/app/uploads/documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def generate_id(prefix=""):
    """Generate unique ID"""
    random_part = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}{random_part}"


async def verify_token(authorization: str):
    """Verify token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    from services.auth_service import verify_token as vt
    token = authorization.split(" ")[1]
    data = vt(token)
    
    if not data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return data


# Document categories
DOCUMENT_CATEGORIES = [
    {"id": "contracts", "name_en": "Contracts", "name_ar": "العقود"},
    {"id": "invoices", "name_en": "Invoices", "name_ar": "الفواتير"},
    {"id": "hr", "name_en": "HR Documents", "name_ar": "مستندات الموارد البشرية"},
    {"id": "financial", "name_en": "Financial", "name_ar": "المالية"},
    {"id": "legal", "name_en": "Legal", "name_ar": "القانونية"},
    {"id": "policies", "name_en": "Policies", "name_ar": "السياسات"},
    {"id": "reports", "name_en": "Reports", "name_ar": "التقارير"},
    {"id": "other", "name_en": "Other", "name_ar": "أخرى"}
]


# ============ FOLDERS ============

@router.post("/folders")
async def create_folder(
    folder_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Create a new folder"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    folder = {
        "id": generate_id("folder_"),
        "company_id": company_id,
        "name": folder_data.get("name"),
        "parent_id": folder_data.get("parent_id"),  # For nested folders
        "category": folder_data.get("category"),
        "description": folder_data.get("description", ""),
        "color": folder_data.get("color", "#6366f1"),
        "is_private": folder_data.get("is_private", False),
        "allowed_users": folder_data.get("allowed_users", []),
        "created_by": user_data.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.document_folders.insert_one(folder)
    if "_id" in folder:
        del folder["_id"]
    
    return folder


@router.get("/folders")
async def get_folders(
    parent_id: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all folders"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    user_id = user_data.get("user_id")
    
    query = {"company_id": company_id}
    if parent_id:
        query["parent_id"] = parent_id
    else:
        query["parent_id"] = {"$in": [None, ""]}
    
    folders = await db.document_folders.find(query, {"_id": 0}).sort("name", 1).to_list(length=None)
    
    # Filter private folders
    accessible_folders = []
    for folder in folders:
        if not folder.get("is_private"):
            accessible_folders.append(folder)
        elif folder.get("created_by") == user_id or user_id in folder.get("allowed_users", []):
            accessible_folders.append(folder)
    
    # Get document count for each folder
    for folder in accessible_folders:
        count = await db.documents.count_documents({"folder_id": folder["id"]})
        folder["document_count"] = count
    
    return accessible_folders


@router.put("/folders/{folder_id}")
async def update_folder(
    folder_id: str,
    update_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update folder"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    allowed_fields = ["name", "description", "color", "is_private", "allowed_users"]
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.document_folders.update_one(
        {"id": folder_id, "company_id": company_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    return {"success": True}


@router.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete folder and move documents to root"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    # Move documents to no folder
    await db.documents.update_many(
        {"folder_id": folder_id},
        {"$set": {"folder_id": None}}
    )
    
    # Delete subfolders
    await db.document_folders.delete_many({"parent_id": folder_id})
    
    # Delete folder
    result = await db.document_folders.delete_one(
        {"id": folder_id, "company_id": company_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    return {"success": True}


# ============ DOCUMENTS ============

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None)
):
    """Upload a document"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check file size (max 50MB)
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    # Get file info
    file_ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    file_type = get_file_type(file_ext)
    
    # Generate unique filename
    doc_id = generate_id("doc_")
    stored_filename = f"{doc_id}.{file_ext}" if file_ext else doc_id
    file_path = os.path.join(UPLOAD_DIR, company_id)
    os.makedirs(file_path, exist_ok=True)
    full_path = os.path.join(file_path, stored_filename)
    
    # Save file
    with open(full_path, "wb") as f:
        f.write(content)
    
    # Create document record
    document = {
        "id": doc_id,
        "company_id": company_id,
        "name": file.filename,
        "stored_name": stored_filename,
        "file_path": full_path,
        "file_type": file_type,
        "file_extension": file_ext,
        "file_size": len(content),
        "mime_type": file.content_type,
        "folder_id": folder_id,
        "category": category or "other",
        "tags": tags.split(",") if tags else [],
        "description": "",
        "version": 1,
        "versions": [{
            "version": 1,
            "file_path": full_path,
            "uploaded_by": user_data.get("user_id"),
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }],
        "shared_with": [],
        "is_archived": False,
        "view_count": 0,
        "download_count": 0,
        "uploaded_by": user_data.get("user_id"),
        "uploaded_by_name": user_data.get("full_name"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.documents.insert_one(document)
    if "_id" in document:
        del document["_id"]
    
    return document


@router.get("/")
async def get_documents(
    folder_id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    file_type: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all documents"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    query = {"company_id": company_id, "is_archived": False}
    
    if folder_id:
        query["folder_id"] = folder_id
    if category:
        query["category"] = category
    if file_type:
        query["file_type"] = file_type
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search]}}
        ]
    
    documents = await db.documents.find(query, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(length=None)
    
    return documents


@router.get("/categories")
async def get_categories():
    """Get document categories"""
    return DOCUMENT_CATEGORIES


@router.get("/stats")
async def get_document_stats(authorization: Optional[str] = Header(None)):
    """Get document statistics"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    documents = await db.documents.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(length=None)
    
    total_docs = len(documents)
    total_size = sum(d.get("file_size", 0) for d in documents)
    
    # By category
    by_category = {}
    for doc in documents:
        cat = doc.get("category", "other")
        if cat not in by_category:
            by_category[cat] = {"count": 0, "size": 0}
        by_category[cat]["count"] += 1
        by_category[cat]["size"] += doc.get("file_size", 0)
    
    # By type
    by_type = {}
    for doc in documents:
        ftype = doc.get("file_type", "other")
        if ftype not in by_type:
            by_type[ftype] = 0
        by_type[ftype] += 1
    
    # Recent uploads
    recent = sorted(documents, key=lambda x: x.get("created_at", ""), reverse=True)[:10]
    
    return {
        "total_documents": total_docs,
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "by_category": by_category,
        "by_type": by_type,
        "recent_uploads": [{"id": d.get("id"), "name": d.get("name"), "created_at": d.get("created_at")} for d in recent]
    }


@router.get("/{document_id}")
async def get_document(
    document_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get single document"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    document = await db.documents.find_one(
        {"id": document_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Increment view count
    await db.documents.update_one(
        {"id": document_id},
        {"$inc": {"view_count": 1}}
    )
    
    return document


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    authorization: Optional[str] = Header(None)
):
    """Download document"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    document = await db.documents.find_one(
        {"id": document_id, "company_id": company_id}
    )
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = document.get("file_path")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
    
    # Increment download count
    await db.documents.update_one(
        {"id": document_id},
        {"$inc": {"download_count": 1}}
    )
    
    # Read and return file as base64
    with open(file_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    
    return {
        "filename": document.get("name"),
        "mime_type": document.get("mime_type"),
        "content": content
    }


@router.put("/{document_id}")
async def update_document(
    document_id: str,
    update_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update document metadata"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    allowed_fields = ["name", "description", "category", "tags", "folder_id"]
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.documents.update_one(
        {"id": document_id, "company_id": company_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"success": True}


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    permanent: bool = False,
    authorization: Optional[str] = Header(None)
):
    """Delete or archive document"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    if permanent:
        # Permanently delete
        document = await db.documents.find_one({"id": document_id, "company_id": company_id})
        if document and document.get("file_path"):
            try:
                os.remove(document.get("file_path"))
            except:
                pass
        
        result = await db.documents.delete_one({"id": document_id, "company_id": company_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Document not found")
    else:
        # Archive
        result = await db.documents.update_one(
            {"id": document_id, "company_id": company_id},
            {"$set": {"is_archived": True, "archived_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Document not found")
    
    return {"success": True}


@router.post("/{document_id}/share")
async def share_document(
    document_id: str,
    share_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Share document with users"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    user_ids = share_data.get("user_ids", [])
    permission = share_data.get("permission", "view")  # view, edit
    
    await db.documents.update_one(
        {"id": document_id, "company_id": company_id},
        {"$set": {
            "shared_with": [{"user_id": uid, "permission": permission} for uid in user_ids]
        }}
    )
    
    return {"success": True}


@router.post("/{document_id}/version")
async def upload_new_version(
    document_id: str,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None)
):
    """Upload new version of document"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    document = await db.documents.find_one({"id": document_id, "company_id": company_id})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    content = await file.read()
    
    # Save new version
    new_version = document.get("version", 1) + 1
    file_ext = document.get("file_extension", "")
    stored_filename = f"{document_id}_v{new_version}.{file_ext}" if file_ext else f"{document_id}_v{new_version}"
    
    file_path = os.path.join(UPLOAD_DIR, company_id)
    full_path = os.path.join(file_path, stored_filename)
    
    with open(full_path, "wb") as f:
        f.write(content)
    
    version_entry = {
        "version": new_version,
        "file_path": full_path,
        "uploaded_by": user_data.get("user_id"),
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.documents.update_one(
        {"id": document_id},
        {
            "$set": {
                "version": new_version,
                "file_path": full_path,
                "file_size": len(content),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"versions": version_entry}
        }
    )
    
    return {"success": True, "version": new_version}


# ============ SEARCH ============

@router.get("/search/advanced")
async def advanced_search(
    q: str,
    category: Optional[str] = None,
    file_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Advanced document search"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    query = {
        "company_id": company_id,
        "is_archived": False,
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$in": [q]}}
        ]
    }
    
    if category:
        query["category"] = category
    if file_type:
        query["file_type"] = file_type
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = to_date
        else:
            query["created_at"] = {"$lte": to_date}
    
    documents = await db.documents.find(query, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(length=None)
    
    return documents


def get_file_type(extension: str) -> str:
    """Get file type from extension"""
    types = {
        "pdf": "pdf",
        "doc": "document", "docx": "document", "odt": "document",
        "xls": "spreadsheet", "xlsx": "spreadsheet", "csv": "spreadsheet",
        "ppt": "presentation", "pptx": "presentation",
        "jpg": "image", "jpeg": "image", "png": "image", "gif": "image", "webp": "image",
        "mp4": "video", "avi": "video", "mov": "video",
        "mp3": "audio", "wav": "audio",
        "zip": "archive", "rar": "archive", "7z": "archive",
        "txt": "text", "md": "text"
    }
    return types.get(extension.lower(), "other")
