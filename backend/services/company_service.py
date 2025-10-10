from motor.motor_asyncio import AsyncIOMotorClient
from models.company import Company, CompanyCreate
from typing import Optional
import uuid

async def create_company(db: AsyncIOMotorClient, company_data: CompanyCreate) -> Company:
    """Create a new company"""
    company_dict = company_data.dict()
    company = Company(**company_dict)
    
    await db.companies.insert_one(company.dict())
    return company

async def get_company_by_id(db: AsyncIOMotorClient, company_id: str) -> Optional[Company]:
    """Get a company by ID"""
    company_data = await db.companies.find_one({"id": company_id})
    if company_data:
        return Company(**company_data)
    return None

async def get_company_by_email(db: AsyncIOMotorClient, email: str) -> Optional[Company]:
    """Get a company by contact email"""
    company_data = await db.companies.find_one({"contact_email": email})
    if company_data:
        return Company(**company_data)
    return None

async def update_company(db: AsyncIOMotorClient, company_id: str, update_data: dict) -> Optional[Company]:
    """Update a company"""
    result = await db.companies.update_one(
        {"id": company_id},
        {"$set": update_data}
    )
    
    if result.modified_count > 0:
        return await get_company_by_id(db, company_id)
    return None

async def list_companies(db: AsyncIOMotorClient, skip: int = 0, limit: int = 100):
    """List all companies"""
    companies = await db.companies.find().skip(skip).limit(limit).to_list(length=limit)
    return [Company(**company) for company in companies]