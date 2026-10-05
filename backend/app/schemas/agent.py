from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class AgentQueryRequest(BaseModel):
    query: str = Field(..., description="The user question, instruction, or analysis task")
    document_ids: Optional[List[UUID]] = Field(default=None, description="Optional list of specific document IDs to restrict RAG retrieval")
    session_id: Optional[UUID] = None
    workflow_mode: str = Field(default="auto", description="auto, rag, deep_analysis, fact_check")


class Citation(BaseModel):
    document_id: str
    document_name: str
    page_number: Optional[int] = None
    sheet_name: Optional[str] = None
    snippet: str
    relevance_score: Optional[float] = None


class AgentThought(BaseModel):
    step: int
    agent_name: str  # Router, IngestAnalyst, VectorRetriever, Synthesizer, FactChecker
    thought: str
    timestamp: Optional[datetime] = None


class AgentQueryResponse(BaseModel):
    session_id: UUID
    query: str
    answer: str
    agents_executed: List[str]
    thoughts: List[AgentThought]
    citations: List[Citation]
    confidence_score: Optional[float] = None
    langsmith_trace_id: Optional[str] = None


class AgentSessionResponse(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentMessageResponse(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    agent_name: Optional[str] = None
    content: str
    thoughts: List[Dict[str, Any]] = []
    citations: List[Dict[str, Any]] = []
    created_at: datetime

    class Config:
        from_attributes = True
