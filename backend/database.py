from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=50,          # max concurrent connections
    minPoolSize=5,           # keep 5 connections warm
    serverSelectionTimeoutMS=5000,   # fail fast if DB unreachable (5s)
    connectTimeoutMS=10000,          # connection timeout 10s
    socketTimeoutMS=30000,           # socket timeout 30s (for heavy queries)
    retryWrites=True,                # auto-retry on transient errors
    retryReads=True,
)
db = client[os.environ['DB_NAME']]

def get_database():
    """Get database instance"""
    return db
