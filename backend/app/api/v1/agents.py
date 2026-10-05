from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.user import User
from app.models.session import AgentSession, AgentMessage
from app.schemas.agent import (
    AgentQueryRequest,
    AgentQueryResponse,
    AgentSessionResponse,
    AgentMessageResponse,
    AgentThought,
    Citation,
)
from app.services.auth_service import get_current_user
from app.services.agents.graph import orchestrator

router = APIRouter(prefix="/agents", tags=["Multi-Agent Intelligence"])


@router.post("/query", response_model=AgentQueryResponse)
async def query_multi_agent(
    request: AgentQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Executes the LangGraph Multi-Agent pipeline (Router -> Retriever -> Analyst -> Synthesizer -> Critic)."""
    # 1. Resolve or create chat session
    session_id = request.session_id
    if not session_id:
        new_session = AgentSession(
            user_id=current_user.id,
            title=request.query[:50] + ("..." if len(request.query) > 50 else ""),
        )
        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)
        session_id = new_session.id
    else:
        # Verify session belongs to user
        stmt = select(AgentSession).where(AgentSession.id == session_id, AgentSession.user_id == current_user.id)
        res = await db.execute(stmt)
        if not res.scalars().first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent session not found")

    # 2. Record user message
    user_msg = AgentMessage(
        session_id=session_id,
        role="user",
        content=request.query,
        thoughts=[],
        citations=[],
    )
    db.add(user_msg)
    await db.commit()

    # 3. Execute LangGraph Multi-Agent Orchestrator
    agent_output = await orchestrator.execute_query(
        query=request.query,
        db=db,
        document_ids=request.document_ids,
        workflow_mode=request.workflow_mode,
        session_id=session_id,
        user_id=current_user.id,
    )

    final_answer = agent_output.get("final_answer", "")
    thoughts_raw = agent_output.get("thoughts", [])
    citations_raw = agent_output.get("citations", [])
    agents_executed = agent_output.get("agents_executed", [])
    confidence_score = agent_output.get("confidence_score", 0.9)

    # 4. Save Assistant response with step-by-step agent thoughts and citations
    assistant_msg = AgentMessage(
        session_id=session_id,
        role="assistant",
        agent_name="MultiAgentCoordinator",
        content=final_answer,
        thoughts=thoughts_raw,
        citations=citations_raw,
    )
    db.add(assistant_msg)
    await db.commit()

    # 5. Format response
    formatted_thoughts = [
        AgentThought(
            step=t.get("step", idx + 1),
            agent_name=t.get("agent_name", "Agent"),
            thought=t.get("thought", ""),
        )
        for idx, t in enumerate(thoughts_raw)
    ]

    formatted_citations = [
        Citation(
            document_id=c.get("document_id", ""),
            document_name=c.get("document_name", "Document"),
            page_number=c.get("page_number"),
            sheet_name=c.get("sheet_name"),
            snippet=c.get("snippet", ""),
            relevance_score=c.get("relevance_score"),
        )
        for c in citations_raw
    ]

    return AgentQueryResponse(
        session_id=session_id,
        query=request.query,
        answer=final_answer,
        agents_executed=agents_executed,
        thoughts=formatted_thoughts,
        citations=formatted_citations,
        confidence_score=confidence_score,
    )


@router.post("/sessions", response_model=AgentSessionResponse)
async def create_session(
    title: str = "New Analysis Session",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new agent session for conversation tracking."""
    session = AgentSession(user_id=current_user.id, title=title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return AgentSessionResponse.model_validate(session)


@router.get("/sessions", response_model=List[AgentSessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all active agent sessions for current user."""
    stmt = (
        select(AgentSession)
        .where(AgentSession.user_id == current_user.id)
        .order_by(AgentSession.updated_at.desc())
    )
    result = await db.execute(stmt)
    return [AgentSessionResponse.model_validate(s) for s in result.scalars().all()]


@router.get("/sessions/{session_id}/messages", response_model=List[AgentMessageResponse])
async def get_session_messages(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves full conversation history and agent reasoning traces for a session."""
    stmt = (
        select(AgentMessage)
        .join(AgentSession, AgentMessage.session_id == AgentSession.id)
        .where(AgentMessage.session_id == session_id, AgentSession.user_id == current_user.id)
        .order_by(AgentMessage.created_at.asc())
    )
    result = await db.execute(stmt)
    return [AgentMessageResponse.model_validate(m) for m in result.scalars().all()]
