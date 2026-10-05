from typing import TypedDict, List, Dict, Any, Optional


class AgentThoughtItem(TypedDict):
    step: int
    agent_name: str
    thought: str


class AgentState(TypedDict):
    query: str
    document_ids: Optional[List[str]]
    session_id: Optional[str]
    workflow_mode: str  # auto, rag, deep_analysis, fact_check
    user_id: Optional[str]

    # Router decision
    router_intent: str  # simple_qa, deep_analysis, table_analysis, summarize
    requires_retrieval: bool
    requires_critic: bool

    # Agent outputs
    retrieved_chunks: List[Dict[str, Any]]
    document_summaries: List[Dict[str, Any]]
    preliminary_synthesis: str
    critic_notes: str
    confidence_score: float
    citations: List[Dict[str, Any]]
    
    # Execution Tracking
    thoughts: List[Dict[str, Any]]
    agents_executed: List[str]
    final_answer: str
