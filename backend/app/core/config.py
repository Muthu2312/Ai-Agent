import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "Multi-Agent Document Intelligence Platform"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    # Authentication & Security
    SECRET_KEY: str = "supersecret-jwt-key-replace-in-production-random-64-bytes-min"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SECURE: bool = False  # Set to True in production (HTTPS)
    COOKIE_SAMESITE: str = "lax"
    COOKIE_NAME_ACCESS: str = "access_token"
    COOKIE_NAME_REFRESH: str = "refresh_token"

    # Database: PostgreSQL + pgvector
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "doc_intelligence"
    DATABASE_URL: Optional[str] = None

    # Optional Mongo DB
    MONGODB_URL: Optional[str] = "mongodb://localhost:27017"
    MONGODB_DB: str = "doc_intelligence"
    PRIMARY_DB_TYPE: str = "postgresql"  # "postgresql" or "mongodb"

    # Vector Storage & Embeddings
    # Options: "fastembed" (100% Free, runs on CPU locally) | "ollama" (local) | "openai"
    EMBEDDING_PROVIDER: str = "fastembed"
    VECTOR_DIMENSION: int = 384  # 384 for fastembed (bge-small-en-v1.5), 1536 for OpenAI
    FASTEMBED_MODEL: str = "BAAI/bge-small-en-v1.5"

    # LLM Settings
    # Options: "groq" (100% Free Cloud Tier, ultra fast) | "ollama" (100% Free Local) | "openai"
    LLM_PROVIDER: str = "groq"
    
    # 1. Groq (Free Cloud Tier: Llama 3.3 70B, Llama 3.1 8B - free api key at console.groq.com)
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # 2. Local Ollama (100% Free, runs offline on your machine)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"

    # 3. OpenAI (Optional paid API)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # LangSmith Observability
    LANGCHAIN_TRACING_V2: bool = True
    LANGCHAIN_ENDPOINT: str = "https://api.smith.langchain.com"
    LANGCHAIN_API_KEY: Optional[str] = None
    LANGCHAIN_PROJECT: str = "document-intelligence-platform"

    # File Storage
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    MAX_FILE_SIZE_MB: int = 50

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            # ensure asyncpg driver is used for async engine
            if self.DATABASE_URL.startswith("postgresql://"):
                return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
            return self.DATABASE_URL
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    def get_sync_database_url(self) -> str:
        if self.DATABASE_URL:
            if self.DATABASE_URL.startswith("postgresql+asyncpg://"):
                return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)
            return self.DATABASE_URL
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"


settings = Settings()
