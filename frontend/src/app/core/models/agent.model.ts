export interface Citation {
  document_id: string;
  document_name: string;
  page_number?: number;
  sheet_name?: string;
  snippet: string;
  relevance_score?: number;
}

export interface AgentThought {
  step: number;
  agent_name: string;
  thought: string;
  timestamp?: string;
}

export interface AgentQueryRequest {
  query: string;
  document_ids?: string[];
  session_id?: string;
  workflow_mode: 'auto' | 'rag' | 'deep_analysis' | 'fact_check';
}

export interface AgentQueryResponse {
  session_id: string;
  query: string;
  answer: string;
  agents_executed: string[];
  thoughts: AgentThought[];
  citations: Citation[];
  confidence_score?: number;
  langsmith_trace_id?: string;
}

export interface AgentSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  agent_name?: string;
  content: string;
  thoughts: AgentThought[];
  citations: Citation[];
  created_at: string;
}
