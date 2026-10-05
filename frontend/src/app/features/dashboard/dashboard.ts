import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService, PlatformStats } from '../../core/services/analytics.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <!-- Title -->
      <div class="dash-header">
        <div>
          <h1 class="dash-title">Platform Observability & Intelligence</h1>
          <p class="dash-subtitle">Real-time telemetry, LangSmith tracing status, and pgvector embeddings metrics.</p>
        </div>
        <button class="btn btn-secondary btn-sm" (click)="loadStats()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Refresh Stats
        </button>
      </div>

      <!-- KPI Grid -->
      <div class="kpi-grid">
        <div class="kpi-card glass-panel glass-panel-hover">
          <div class="kpi-icon icon-docs">📄</div>
          <div class="kpi-content">
            <span class="kpi-label">Total Documents</span>
            <div class="kpi-value">{{ stats()?.total_documents || 0 }}</div>
            <span class="kpi-hint">PDF, DOCX, XLSX Ingested</span>
          </div>
        </div>

        <div class="kpi-card glass-panel glass-panel-hover">
          <div class="kpi-icon icon-vectors">🧬</div>
          <div class="kpi-content">
            <span class="kpi-label">pgvector Embeddings</span>
            <div class="kpi-value">{{ stats()?.total_chunks || 0 }}</div>
            <span class="kpi-hint">Indexed high-dimensional vectors</span>
          </div>
        </div>

        <div class="kpi-card glass-panel glass-panel-hover">
          <div class="kpi-icon icon-agents">🤖</div>
          <div class="kpi-content">
            <span class="kpi-label">Agent Sessions</span>
            <div class="kpi-value">{{ stats()?.total_sessions || 0 }}</div>
            <span class="kpi-hint">LangGraph Execution Runs</span>
          </div>
        </div>

        <div class="kpi-card glass-panel glass-panel-hover">
          <div class="kpi-icon icon-obs">🔭</div>
          <div class="kpi-content">
            <span class="kpi-label">Total Messages</span>
            <div class="kpi-value">{{ stats()?.total_messages || 0 }}</div>
            <span class="kpi-hint">Analyzed & Verified Queries</span>
          </div>
        </div>
      </div>

      <!-- Deep Dive Grid -->
      <div class="details-grid">
        <!-- LangSmith Observability Box -->
        <div class="detail-card glass-panel">
          <div class="card-header">
            <div class="header-with-icon">
              <span class="pulse-indicator"></span>
              <h3>LangSmith Observability</h3>
            </div>
            <span class="badge badge-success">Telemetry Ready</span>
          </div>
          
          <div class="card-body">
            <p class="obs-desc">
              Every LangGraph execution automatically streams token traces, agent latencies, and step reasoning graphs to LangSmith.
            </p>

            <div class="info-table">
              <div class="info-row">
                <span class="info-key">Project:</span>
                <span class="info-val code">{{ stats()?.observability?.project || 'document-intelligence-platform' }}</span>
              </div>
              <div class="info-row">
                <span class="info-key">Tracing Status:</span>
                <span class="info-val">
                  @if (stats()?.observability?.tracing_enabled) {
                    <span class="status-active">● Active (Tracing enabled in .env)</span>
                  } @else {
                    <span class="status-standby">Standby (Provide LANGCHAIN_API_KEY to stream traces)</span>
                  }
                </span>
              </div>
              <div class="info-row">
                <span class="info-key">Endpoint:</span>
                <span class="info-val">{{ stats()?.observability?.endpoint || 'https://api.smith.langchain.com' }}</span>
              </div>
            </div>

            <a href="https://smith.langchain.com" target="_blank" class="btn btn-secondary btn-block">
              Open LangSmith Dashboard ↗
            </a>
          </div>
        </div>

        <!-- pgvector Vector Database Health -->
        <div class="detail-card glass-panel">
          <div class="card-header">
            <div class="header-with-icon">
              <span class="icon-db">🗄️</span>
              <h3>PostgreSQL + pgvector Engine</h3>
            </div>
            <span class="badge badge-xlsx">Active</span>
          </div>

          <div class="card-body">
            <p class="obs-desc">
              Native PostgreSQL vector extensions enable millisecond cosine distance searches over parsed document chunks with hybrid metadata filtering.
            </p>

            <div class="info-table">
              <div class="info-row">
                <span class="info-key">Vector Engine:</span>
                <span class="info-val code">PostgreSQL 16 + pgvector extension</span>
              </div>
              <div class="info-row">
                <span class="info-key">Distance Metric:</span>
                <span class="info-val code">Cosine Distance (&lt;=&gt;)</span>
              </div>
              <div class="info-row">
                <span class="info-key">Indexed Chunks:</span>
                <span class="info-val"><strong>{{ stats()?.vector_db?.indexed_vectors || 0 }}</strong> Vectors</span>
              </div>
            </div>

            <div class="format-chips">
              <span class="badge badge-pdf">PyMuPDF Text Engine</span>
              <span class="badge badge-docx">python-docx Parser</span>
              <span class="badge badge-xlsx">openpyxl Tables</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 32px 24px;
    }
    .dash-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
    }
    .dash-title {
      font-size: 26px;
      color: #fff;
      margin-bottom: 4px;
    }
    .dash-subtitle {
      color: var(--text-secondary);
      font-size: 14px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 18px;
      margin-bottom: 28px;
    }
    .kpi-card {
      padding: 22px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .kpi-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      background: rgba(255, 255, 255, 0.05);
    }
    .icon-docs { background: rgba(239, 68, 68, 0.12); }
    .icon-vectors { background: rgba(99, 102, 241, 0.12); }
    .icon-agents { background: rgba(6, 182, 212, 0.12); }
    .icon-obs { background: rgba(16, 185, 129, 0.12); }
    .kpi-label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
    }
    .kpi-value {
      font-size: 26px;
      font-weight: 700;
      color: #fff;
      line-height: 1.2;
      margin: 2px 0;
    }
    .kpi-hint {
      font-size: 11.5px;
      color: var(--text-secondary);
    }
    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      gap: 20px;
    }
    .detail-card {
      padding: 24px;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 12px;
    }
    .header-with-icon {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .card-header h3 {
      font-size: 16px;
      color: #fff;
    }
    .obs-desc {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .info-table {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
      background: rgba(0, 0, 0, 0.2);
      padding: 14px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 12.5px;
    }
    .info-key {
      color: var(--text-muted);
    }
    .info-val {
      color: var(--text-primary);
    }
    .code {
      font-family: var(--font-mono);
      font-size: 11.5px;
      color: var(--accent-secondary);
    }
    .status-active {
      color: #34d399;
      font-weight: 600;
    }
    .status-standby {
      color: #fbbf24;
    }
    .btn-block {
      width: 100%;
      text-align: center;
    }
    .format-chips {
      display: flex;
      gap: 8px;
      margin-top: 14px;
      flex-wrap: wrap;
    }
  `]
})
export class DashboardComponent implements OnInit {
  analyticsService = inject(AnalyticsService);
  stats = signal<PlatformStats | null>(null);

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.analyticsService.getStats().subscribe({
      next: (data) => this.stats.set(data),
      error: () => this.stats.set(null)
    });
  }
}
