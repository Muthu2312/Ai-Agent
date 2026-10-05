import logging
from typing import Dict, Any, List, Optional
from uuid import UUID
from langgraph.graph import StateGraph, END
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.agents.state import AgentState
from app.services.agents.nodes import (
    router_node,
    retrieval_node,
    deep_analyst_node,
    synthesizer_node,
    fact_checker_critic_node,
)
from app.core.config import settings

logger = logging.getLogger(__name__)


def build_agent_graph():
    """Builds and compiles the multi-agent StateGraph workflow."""
    workflow = StateGraph(AgentState)

    # Register nodes
    workflow.add_node("router", router_node)
    workflow.add_node("deep_analyst", deep_analyst_node)
    workflow.add_node("synthesizer", synthesizer_node)
    workflow.add_node("fact_checker", fact_checker_critic_node)

    # Retrieval wrapper node to receive db context via graph state if needed
    async def run_retrieval(state: AgentState):
        # Retrieved chunks are already populated or executed via coordinator
        return await retrieval_node(state, db_session=state.get("_db_session"))

    workflow.add_node("retriever", run_retrieval)

    # Set Entry Point
    workflow.set_entry_point("router")

    # Routing logic
    def route_decision(state: AgentState) -> str:
        intent = state.get("router_intent")
        if intent == "deep_analysis":
            return "deep_analyst"
        return "retriever"

    workflow.add_conditional_edges(
        "router",
        route_decision,
        {
            "retriever": "retriever",
            "deep_analyst": "deep_analyst",
        },
    )

    # Deep analyst branches to retriever
    workflow.add_edge("deep_analyst", "retriever")

    # Retriever to synthesizer
    workflow.add_edge("retriever", "synthesizer")

    # Synthesizer to Fact-Checking Critic
    workflow.add_edge("synthesizer", "fact_checker")

    # Critic to END
    workflow.add_edge("fact_checker", END)

    return workflow.compile()


# Compiled singleton graph
agent_graph = build_agent_graph()


class MultiAgentOrchestrator:
    """Orchestrator executing the LangGraph pipeline with LangSmith tracing."""

    def __init__(self):
        self.graph = agent_graph

    async def execute_query(
        self,
        query: str,
        db: AsyncSession,
        document_ids: Optional[List[UUID]] = None,
        workflow_mode: str = "auto",
        session_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """Runs the multi-agent workflow for a document query."""
        initial_state: AgentState = {
            "query": query,
            "document_ids": [str(d) for d in document_ids] if document_ids else [],
            "session_id": str(session_id) if session_id else None,
            "workflow_mode": workflow_mode,
            "user_id": str(user_id) if user_id else None,
            "router_intent": "simple_qa",
            "requires_retrieval": True,
            "requires_critic": True,
            "retrieved_chunks": [],
            "document_summaries": [],
            "preliminary_synthesis": "",
            "critic_notes": "",
            "confidence_score": 0.0,
            "citations": [],
            "thoughts": [],
            "agents_executed": [],
            "final_answer": "",
        }

        # Step 1: Run router
        router_res = await router_node(initial_state)
        initial_state.update(router_res)

        # Step 2: Run deep analyst if triggered
        if initial_state.get("router_intent") == "deep_analysis":
            analyst_res = await deep_analyst_node(initial_state)
            initial_state.update(analyst_res)

        # Step 3: Run retrieval with active db session
        retrieval_res = await retrieval_node(initial_state, db_session=db)
        initial_state.update(retrieval_res)

        # Step 4: Synthesize answer
        synth_res = await synthesizer_node(initial_state)
        initial_state.update(synth_res)

        # Step 5: Fact check and critic evaluation
        critic_res = await fact_checker_critic_node(initial_state)
        initial_state.update(critic_res)

        return initial_state


orchestrator = MultiAgentOrchestrator()
