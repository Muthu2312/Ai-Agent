from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.observability import get_langsmith_status
from app.models.user import User
from app.models.document import Document, DocumentChunk
from app.models.session import AgentSession, AgentMessage
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics & Observability"])


@router.get("/stats")
async def get_platform_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves document statistics, chunk distribution, vector storage, and LangSmith status."""
    # Document count
    doc_res = await db.execute(select(func.count(Document.id)).where(Document.user_id == current_user.id))
    total_docs = doc_res.scalar() or 0

    # Chunks count
    chunk_res = await db.execute(
        select(func.count(DocumentChunk.id))
        .join(Document, DocumentChunk.document_id == Document.id)
        .where(Document.user_id == current_user.id)
    )
    total_chunks = chunk_res.scalar() or 0

    # Sessions count
    sess_res = await db.execute(select(func.count(AgentSession.id)).where(AgentSession.user_id == current_user.id))
    total_sessions = sess_res.scalar() or 0

    # Messages count
    msg_res = await db.execute(
        select(func.count(AgentMessage.id))
        .join(AgentSession, AgentMessage.session_id == AgentSession.id)
        .where(AgentSession.user_id == current_user.id)
    )
    total_messages = msg_res.scalar() or 0

    # Formats breakdown
    format_res = await db.execute(
        select(Document.file_type, func.count(Document.id))
        .where(Document.user_id == current_user.id)
        .group_by(Document.file_type)
    )
    format_breakdown = {row[0]: row[1] for row in format_res.all()}

    langsmith_info = get_langsmith_status()

    return {
        "total_documents": total_docs,
        "total_chunks": total_chunks,
        "total_sessions": total_sessions,
        "total_messages": total_messages,
        "file_formats": format_breakdown,
        "vector_db": {
            "engine": "PostgreSQL + pgvector",
            "indexed_vectors": total_chunks,
            "status": "online",
        },
        "observability": langsmith_info,
    }
