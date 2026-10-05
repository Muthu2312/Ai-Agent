import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.core.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()

# SQLAlchemy Async Engine
engine = create_async_engine(
    settings.get_database_url(),
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def init_db() -> None:
    """Initialize database schemas and ensure pgvector extension is enabled."""
    try:
        async with engine.begin() as conn:
            # Enable pgvector extension
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            # Create all registered tables
            await conn.run_sync(Base.metadata.create_all)
            try:
                await conn.execute(text("ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector;"))
            except Exception:
                pass
            logger.info("Database tables & pgvector extension initialized successfully.")
    except Exception as e:
        logger.warning(f"Could not connect to PostgreSQL on startup ({e}). If using local mock/SQLite/Docker, ensure DB is running.")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for obtaining async SQLAlchemy session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Optional MongoDB client configuration
mongo_client = None
mongo_db = None

if settings.PRIMARY_DB_TYPE == "mongodb" or settings.MONGODB_URL:
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=2000)
        mongo_db = mongo_client[settings.MONGODB_DB]
    except Exception as e:
        logger.warning(f"MongoDB driver initialization skipped or failed: {e}")
