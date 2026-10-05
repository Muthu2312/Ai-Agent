import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../../core/services/agent.service';
import { DocumentService } from '../../core/services/document.service';
import { AgentSession, AgentMessage, Citation, AgentThought } from '../../core/models/agent.model';
import { DocumentItem } from '../../core/models/document.model';

@Component({
  selector: 'app-agent-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="workspace-container">
      <!-- Left Sidebar: Sessions & Document Filters -->
      <aside class="sidebar glass-panel">
        <div class="sidebar-header">
          <h3>Agent Sessions</h3>
          <button class="btn btn-primary btn-sm" (click)="createNewSession()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Session
          </button>
        </div>

        <!-- Session List -->
        <div class="sessions-list">
          @for (session of sessions(); track session.id) {
            <div 
              class="session-item"
              [class.active]="currentSessionId() === session.id"
              (click)="selectSession(session.id)">
              <div class="session-icon">💬</div>
              <div class="session-title" title="{{ session.title }}">{{ session.title }}</div>
            </div>
          }
        </div>

        <!-- Document Filter Box -->
        <div class="filter-box">
          <label class="filter-label">Target Documents Scope</label>
          <div class="doc-multiselect">
            <label class="checkbox-item">
              <input type="checkbox" [checked]="selectedDocIds().length === 0" (change)="clearDocSelection()" />
              <span>All Indexed Documents ({{ documents().length }})</span>
            </label>
            @for (doc of documents(); track doc.id) {
              <label class="checkbox-item">
                <input 
                  type="checkbox" 
                  [checked]="selectedDocIds().includes(doc.id)"
                  (change)="toggleDocSelection(doc.id)" />
                <span class="truncate-text">{{ doc.filename }}</span>
              </label>
            }
          </div>
        </div>
      </aside>

      <!-- Main Workspace Chat -->
      <main class="chat-area">
        <!-- Top Toolbar: Mode Selection & LangGraph Agent Pipeline Indicator -->
        <div class="pipeline-toolbar glass-panel">
          <div class="pipeline-steps">
            <span class="pipeline-label">Multi-Agent Workflow:</span>
            <div class="agent-step" [class.step-active]="isQuerying()">
              <span class="step-num">1</span>
              <span>Router</span>
            </div>
            <span class="step-arrow">→</span>
            <div class="agent-step" [class.step-active]="isQuerying()">
              <span class="step-num">2</span>
              <span>pgvector RAG</span>
            </div>
            <span class="step-arrow">→</span>
            <div class="agent-step" [class.step-active]="isQuerying()">
              <span class="step-num">3</span>
              <span>Synthesizer</span>
            </div>
            <span class="step-arrow">→</span>
            <div class="agent-step" [class.step-active]="isQuerying()">
              <span class="step-num">4</span>
              <span>Fact Critic</span>
            </div>
          </div>

          <div class="mode-selector">
            <select [(ngModel)]="workflowMode" class="select-input select-mode">
              <option value="auto">🤖 Mode: Auto Routing</option>
              <option value="deep_analysis">🔍 Mode: Deep Analysis</option>
              <option value="fact_check">🛡️ Mode: Fact-Check & Verification</option>
            </select>
          </div>
        </div>

        <!-- Messages Feed -->
        <div class="messages-scroll">
          @if (messages().length === 0) {
            <div class="welcome-banner glass-panel">
              <div class="welcome-icon">⚡</div>
              <h2>Autonomous Document Intelligence</h2>
              <p>Ask complex questions across your contracts, balance sheets, and reports.</p>
              
              <div class="quick-prompts">
                <button class="prompt-pill" (click)="setPrompt('Compare revenue and net income trends across the uploaded financial sheets.')">
                  "Compare revenue and net income trends across sheets"
                </button>
                <button class="prompt-pill" (click)="setPrompt('Extract all compliance obligations and critical deadlines in the documents.')">
                  "Extract compliance obligations and deadlines"
                </button>
                <button class="prompt-pill" (click)="setPrompt('Summarize key risks and cite the exact page numbers from the PDF.')">
                  "Summarize key risks with PDF citations"
                </button>
              </div>
            </div>
          }

          @for (msg of messages(); track msg.id) {
            <div class="message-row" [class.user-row]="msg.role === 'user'">
              <div class="avatar" [class.agent-avatar]="msg.role === 'assistant'">
                @if (msg.role === 'user') {
                  <span>👤</span>
                } @else {
                  <span>🤖</span>
                }
              </div>

              <div class="message-bubble glass-panel">
                <div class="message-meta">
                  <span class="author-name">{{ msg.role === 'user' ? 'You' : 'Document Multi-Agent' }}</span>
                  <span class="time">{{ msg.created_at | date:'shortTime' }}</span>
                </div>

                <!-- Agent Thoughts Accordion -->
                @if (msg.thoughts && msg.thoughts.length > 0) {
                  <details class="thoughts-accordion">
                    <summary class="thoughts-summary">
                      <span class="pulse-indicator"></span>
                      <span>View {{ msg.thoughts.length }} Multi-Agent Reasoning Steps</span>
                    </summary>
                    <div class="thoughts-body">
                      @for (thought of msg.thoughts; track thought.step) {
                        <div class="thought-step">
                          <span class="thought-agent">{{ thought.agent_name }}:</span>
                          <span class="thought-text">{{ thought.thought }}</span>
                        </div>
                      }
                    </div>
                  </details>
                }

                <div class="message-text">
                  {{ msg.content }}
                </div>

                <!-- Source Citations Section -->
                @if (msg.citations && msg.citations.length > 0) {
                  <div class="citations-wrapper">
                    <div class="citations-header">Verified Sources ({{ msg.citations.length }}):</div>
                    <div class="citation-pills">
                      @for (cit of msg.citations; track $index) {
                        <button class="citation-pill" (click)="activeCitation.set(cit)">
                          <span class="doc-icon">📄</span>
                          <span class="cit-name">{{ cit.document_name }}</span>
                          @if (cit.page_number) {
                            <span class="cit-loc">p.{{ cit.page_number }}</span>
                          }
                          @if (cit.sheet_name) {
                            <span class="cit-loc">sheet: {{ cit.sheet_name }}</span>
                          }
                          @if (cit.relevance_score) {
                            <span class="cit-score">{{ (cit.relevance_score * 100).toFixed(0) }}% match</span>
                          }
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          @if (isQuerying()) {
            <div class="message-row">
              <div class="avatar agent-avatar">🤖</div>
              <div class="message-bubble glass-panel loading-bubble">
                <span class="pulse-indicator"></span>
                <span>Agents collaborating: Router → Vector Search → Synthesis → Critic Review...</span>
              </div>
            </div>
          }
        </div>

        <!-- Chat Input Bar -->
        <div class="input-bar-container">
          <form class="input-bar glass-panel" (ngSubmit)="sendQuery()">
            <input 
              type="text" 
              [(ngModel)]="userInput" 
              name="query" 
              placeholder="Ask an analytical question or request a cross-document audit..." 
              class="chat-input"
              [disabled]="isQuerying()" />
            <button type="submit" class="btn btn-primary btn-send" [disabled]="!userInput.trim() || isQuerying()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <span>Analyze</span>
            </button>
          </form>
        </div>
      </main>

      <!-- Active Citation Inspection Drawer -->
      @if (activeCitation(); as cit) {
        <div class="modal-backdrop" (click)="activeCitation.set(null)">
          <div class="citation-drawer glass-panel" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <div class="cit-header-title">
                <span class="badge badge-agent">Source Verification</span>
                <h3>{{ cit.document_name }}</h3>
                <div class="cit-meta-tags">
                  @if (cit.page_number) {
                    <span class="badge badge-pdf">Page {{ cit.page_number }}</span>
                  }
                  @if (cit.sheet_name) {
                    <span class="badge badge-xlsx">Sheet: {{ cit.sheet_name }}</span>
                  }
                  @if (cit.relevance_score) {
                    <span class="badge badge-success">{{ (cit.relevance_score * 100).toFixed(1) }}% Semantic Match</span>
                  }
                </div>
              </div>
              <button class="btn-close" (click)="activeCitation.set(null)">&times;</button>
            </div>

            <div class="cit-body">
              <label>Retrieved Source Excerpt (Indexed via pgvector):</label>
              <div class="cit-snippet-box">
                {{ cit.snippet }}
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .workspace-container {
      max-width: 1440px;
      margin: 0 auto;
      padding: 20px 24px;
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 20px;
      height: calc(100vh - 80px);
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      padding: 16px;
      overflow: hidden;
    }
    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .sidebar-header h3 {
      font-size: 15px;
      color: #fff;
    }
    .sessions-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;
      padding-right: 4px;
    }
    .session-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 13px;
      color: var(--text-secondary);
      transition: all 0.15s ease;
      background: rgba(255, 255, 255, 0.02);
    }
    .session-item:hover {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-primary);
    }
    .session-item.active {
      background: rgba(99, 102, 241, 0.18);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #fff;
      font-weight: 500;
    }
    .session-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .filter-box {
      border-top: 1px solid var(--border-subtle);
      padding-top: 12px;
    }
    .filter-label {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
      display: block;
    }
    .doc-multiselect {
      max-height: 160px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-secondary);
      cursor: pointer;
    }
    .truncate-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chat-area {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .pipeline-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 18px;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .pipeline-steps {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pipeline-label {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 600;
    }
    .agent-step {
      display: flex;
      align-items: center;
      gap: 5px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 3px 8px;
      font-size: 11.5px;
      color: var(--text-secondary);
    }
    .agent-step.step-active {
      border-color: var(--accent-secondary);
      color: var(--accent-secondary);
      box-shadow: 0 0 8px rgba(6, 182, 212, 0.3);
    }
    .step-num {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    }
    .step-arrow {
      color: var(--text-muted);
      font-size: 12px;
    }
    .select-mode {
      padding: 6px 12px;
      font-size: 12.5px;
      border-radius: var(--radius-md);
      background: #111827;
      color: #fff;
    }
    .messages-scroll {
      flex: 1;
      overflow-y: auto;
      padding-right: 8px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .welcome-banner {
      padding: 36px;
      text-align: center;
      margin: auto 0;
    }
    .welcome-icon {
      font-size: 36px;
      margin-bottom: 12px;
    }
    .quick-prompts {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 18px;
      flex-wrap: wrap;
    }
    .prompt-pill {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12.5px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .prompt-pill:hover {
      background: rgba(99, 102, 241, 0.15);
      border-color: var(--accent-primary);
      color: #fff;
    }
    .message-row {
      display: flex;
      gap: 12px;
      max-width: 90%;
    }
    .user-row {
      margin-left: auto;
      flex-direction: row-reverse;
    }
    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    .agent-avatar {
      background: var(--gradient-primary);
    }
    .message-bubble {
      padding: 16px 20px;
      border-radius: var(--radius-lg);
      width: 100%;
    }
    .user-row .message-bubble {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.3);
    }
    .message-meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 11.5px;
      color: var(--text-muted);
    }
    .author-name {
      font-weight: 600;
      color: var(--text-primary);
    }
    .thoughts-accordion {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 6px 10px;
      margin-bottom: 12px;
    }
    .thoughts-summary {
      cursor: pointer;
      font-size: 12px;
      color: var(--accent-secondary);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .thoughts-body {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 6px;
      border-top: 1px solid var(--border-subtle);
    }
    .thought-step {
      font-size: 11.5px;
      color: var(--text-secondary);
    }
    .thought-agent {
      font-weight: 600;
      color: #a5b4fc;
      margin-right: 6px;
    }
    .message-text {
      font-size: 13.5px;
      color: var(--text-primary);
      white-space: pre-wrap;
      line-height: 1.6;
    }
    .citations-wrapper {
      margin-top: 14px;
      border-top: 1px solid var(--border-subtle);
      padding-top: 10px;
    }
    .citations-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .citation-pills {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .citation-pill {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 4px 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
    }
    .citation-pill:hover {
      border-color: var(--accent-secondary);
      color: #fff;
      background: rgba(6, 182, 212, 0.1);
    }
    .cit-name {
      max-width: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cit-loc {
      color: var(--accent-secondary);
      font-size: 10.5px;
    }
    .cit-score {
      font-size: 10px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .input-bar-container {
      margin-top: 14px;
    }
    .input-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: var(--radius-xl);
    }
    .chat-input {
      flex: 1;
      background: transparent;
      border: none;
      color: #fff;
      font-family: var(--font-body);
      font-size: 14px;
      outline: none;
      padding: 6px;
    }
    .btn-send {
      padding: 8px 18px;
    }
    .loading-bubble {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--accent-secondary);
      font-size: 13px;
    }

    /* Citation Inspection Drawer */
    .citation-drawer {
      width: 100%;
      max-width: 580px;
      padding: 24px;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .drawer-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 12px;
    }
    .cit-meta-tags {
      display: flex;
      gap: 6px;
      margin-top: 6px;
    }
    .cit-body label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      display: block;
      margin-bottom: 8px;
    }
    .cit-snippet-box {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 14px;
      font-family: var(--font-mono);
      font-size: 12.5px;
      color: #cbd5e1;
      white-space: pre-wrap;
      line-height: 1.6;
      max-height: 320px;
      overflow-y: auto;
    }
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(6px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .btn-close {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 24px;
      cursor: pointer;
    }
  `]
})
export class AgentChatComponent implements OnInit {
  agentService = inject(AgentService);
  documentService = inject(DocumentService);

  sessions = signal<AgentSession[]>([]);
  documents = signal<DocumentItem[]>([]);
  messages = signal<AgentMessage[]>([]);
  currentSessionId = signal<string | null>(null);
  selectedDocIds = signal<string[]>([]);
  workflowMode: 'auto' | 'rag' | 'deep_analysis' | 'fact_check' = 'auto';
  userInput = '';
  isQuerying = signal<boolean>(false);
  activeCitation = signal<Citation | null>(null);

  ngOnInit(): void {
    this.loadSessions();
    this.loadDocuments();
  }

  loadSessions(): void {
    this.agentService.getSessions().subscribe({
      next: (sessList) => {
        this.sessions.set(sessList);
        if (sessList.length > 0 && !this.currentSessionId()) {
          this.selectSession(sessList[0].id);
        }
      },
      error: () => this.sessions.set([])
    });
  }

  loadDocuments(): void {
    this.documentService.getDocuments().subscribe({
      next: (docs) => this.documents.set(docs),
      error: () => this.documents.set([])
    });
  }

  selectSession(sessionId: string): void {
    this.currentSessionId.set(sessionId);
    this.agentService.getSessionMessages(sessionId).subscribe({
      next: (msgs) => this.messages.set(msgs),
      error: () => this.messages.set([])
    });
  }

  createNewSession(): void {
    const title = `Analysis ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    this.agentService.createSession(title).subscribe({
      next: (newSess) => {
        this.sessions.update(list => [newSess, ...list]);
        this.selectSession(newSess.id);
      }
    });
  }

  toggleDocSelection(docId: string): void {
    this.selectedDocIds.update(ids => {
      if (ids.includes(docId)) {
        return ids.filter(i => i !== docId);
      } else {
        return [...ids, docId];
      }
    });
  }

  clearDocSelection(): void {
    this.selectedDocIds.set([]);
  }

  setPrompt(promptText: string): void {
    this.userInput = promptText;
  }

  sendQuery(): void {
    if (!this.userInput.trim() || this.isQuerying()) return;

    const queryText = this.userInput;
    this.userInput = '';
    this.isQuerying.set(true);

    // Optimistic user message addition
    const tempUserMsg: AgentMessage = {
      id: 'temp-' + Date.now(),
      session_id: this.currentSessionId() || '',
      role: 'user',
      content: queryText,
      thoughts: [],
      citations: [],
      created_at: new Date().toISOString(),
    };
    this.messages.update(m => [...m, tempUserMsg]);

    this.agentService.queryAgents({
      query: queryText,
      session_id: this.currentSessionId() || undefined,
      document_ids: this.selectedDocIds().length > 0 ? this.selectedDocIds() : undefined,
      workflow_mode: this.workflowMode,
    }).subscribe({
      next: (res) => {
        this.currentSessionId.set(res.session_id);
        const assistantMsg: AgentMessage = {
          id: 'resp-' + Date.now(),
          session_id: res.session_id,
          role: 'assistant',
          agent_name: 'MultiAgentCoordinator',
          content: res.answer,
          thoughts: res.thoughts,
          citations: res.citations,
          created_at: new Date().toISOString(),
        };
        this.messages.update(m => [...m, assistantMsg]);
        this.isQuerying.set(false);
        this.loadSessions();
      },
      error: (err) => {
        this.isQuerying.set(false);
        console.error(err);
      }
    });
  }
}
