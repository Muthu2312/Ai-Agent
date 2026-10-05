import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentService } from '../../core/services/document.service';
import { AuthService } from '../../core/services/auth.service';
import { DocumentItem } from '../../core/models/document.model';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Document Intelligence Hub</h1>
          <p class="page-description">
            Ingest, parse, and vectorize multi-format documents (PDF with PyMuPDF, DOCX with python-docx, XLSX with openpyxl).
          </p>
        </div>
        <div class="header-badges">
          <span class="badge badge-pdf">PyMuPDF Engine</span>
          <span class="badge badge-docx">Word Parser</span>
          <span class="badge badge-xlsx">Excel Matrix</span>
          <span class="badge badge-agent">pgvector Store</span>
        </div>
      </div>

      <!-- Upload Zone -->
      <div 
        class="upload-card glass-panel"
        [class.drag-over]="isDragging()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        (click)="fileInput.click()">
        
        <input #fileInput type="file" multiple (change)="onFileSelected($event)" accept=".pdf,.docx,.xlsx,.xls,.doc" style="display: none;" />

        <div class="upload-icon-wrapper">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        
        <div class="upload-text">
          <h3>Drop documents here or click to browse</h3>
          <p>Supports <strong>PDF</strong>, <strong>DOCX</strong>, and <strong>XLSX/XLS</strong> files up to 50MB</p>
        </div>

        @if (isUploading()) {
          <div class="uploading-state">
            <span class="pulse-indicator"></span>
            <span>Parsing document structure & indexing vectors in pgvector...</span>
          </div>
        }
      </div>

      <!-- Documents List -->
      <div class="documents-section">
        <div class="section-header">
          <h2>Indexed Documents ({{ documents().length }})</h2>
          <button class="btn btn-secondary btn-sm" (click)="loadDocuments()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>

        @if (documents().length === 0) {
          <div class="empty-state glass-panel">
            <div class="empty-icon">📂</div>
            <h3>No documents indexed yet</h3>
            <p>Upload your first financial statement, contract, or spreadsheet to start asking multi-agent queries.</p>
          </div>
        } @else {
          <div class="table-container glass-panel">
            <table class="doc-table">
              <thead>
                <tr>
                  <th>Format</th>
                  <th>Document Name</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Extracted Chunks</th>
                  <th>Metadata Highlights</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (doc of documents(); track doc.id) {
                  <tr>
                    <td>
                      <span class="badge" [ngClass]="'badge-' + doc.file_type">
                        {{ doc.file_type.toUpperCase() }}
                      </span>
                    </td>
                    <td class="filename-cell">
                      <span class="filename" title="{{ doc.filename }}">{{ doc.filename }}</span>
                    </td>
                    <td>{{ formatFileSize(doc.file_size_bytes) }}</td>
                    <td>
                      <span class="status-pill" [class.status-indexed]="doc.status === 'indexed'" [class.status-error]="doc.status === 'error'">
                        {{ doc.status }}
                      </span>
                    </td>
                    <td>
                      <strong>{{ doc.total_chunks || 0 }}</strong> vectors
                    </td>
                    <td class="metadata-cell">
                      @if (doc.file_type === 'pdf') {
                        <span>Pages: {{ doc.metadata_json['page_count'] || 'N/A' }}</span>
                      } @else if (doc.file_type === 'docx') {
                        <span>Paragraphs: {{ doc.metadata_json['paragraph_count'] || '0' }}, Tables: {{ doc.metadata_json['table_count'] || '0' }}</span>
                      } @else if (doc.file_type === 'xlsx') {
                        <span>Sheets: {{ doc.metadata_json['sheet_count'] || '1' }}</span>
                      }
                    </td>
                    <td>
                      <div class="actions-group">
                        <button class="btn btn-secondary btn-xs" (click)="viewChunks(doc)" title="Inspect Chunks">
                          Inspect
                        </button>
                        <button class="btn btn-danger btn-xs" (click)="deleteDoc(doc.id)" title="Delete Document">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Chunk Inspector Drawer / Modal -->
      @if (selectedDoc(); as doc) {
        <div class="modal-backdrop" (click)="selectedDoc.set(null)">
          <div class="inspector-drawer glass-panel" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <div>
                <span class="badge" [ngClass]="'badge-' + doc.file_type">{{ doc.file_type.toUpperCase() }}</span>
                <h2>{{ doc.filename }}</h2>
                <p class="subtitle">{{ doc.total_chunks }} Parsed Chunks stored in pgvector</p>
              </div>
              <button class="btn-close" (click)="selectedDoc.set(null)">&times;</button>
            </div>

            <div class="chunks-scroll">
              @if (loadingChunks()) {
                <div class="loading-box">
                  <span class="pulse-indicator"></span> Loading chunk vectors...
                </div>
              } @else if (docDetail()?.chunks?.length) {
                @for (chunk of docDetail()?.chunks; track chunk.id) {
                  <div class="chunk-card">
                    <div class="chunk-meta">
                      <span class="chunk-tag">Chunk #{{ chunk.chunk_index + 1 }}</span>
                      @if (chunk.page_number) {
                        <span class="location-tag">Page {{ chunk.page_number }}</span>
                      }
                      @if (chunk.sheet_name) {
                        <span class="location-tag">Sheet: {{ chunk.sheet_name }}</span>
                      }
                      @if (chunk.section_title) {
                        <span class="location-tag">{{ chunk.section_title }}</span>
                      }
                    </div>
                    <pre class="chunk-content">{{ chunk.content }}</pre>
                  </div>
                }
              } @else {
                <p class="no-chunks">No individual chunks found.</p>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 32px 24px;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
      gap: 16px;
      flex-wrap: wrap;
    }
    .page-title {
      font-size: 26px;
      color: #fff;
      margin-bottom: 6px;
    }
    .page-description {
      color: var(--text-secondary);
      font-size: 14px;
      max-width: 700px;
    }
    .header-badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .upload-card {
      border: 2px dashed rgba(99, 102, 241, 0.35);
      border-radius: var(--radius-xl);
      padding: 42px 24px;
      text-align: center;
      cursor: pointer;
      margin-bottom: 36px;
      transition: all 0.25s ease;
      background: rgba(13, 18, 31, 0.5);
    }
    .upload-card:hover, .upload-card.drag-over {
      border-color: var(--accent-primary);
      background: rgba(99, 102, 241, 0.08);
      transform: translateY(-2px);
    }
    .upload-icon-wrapper {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--gradient-glow);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-secondary);
      margin-bottom: 14px;
    }
    .upload-text h3 {
      font-size: 17px;
      color: #fff;
      margin-bottom: 4px;
    }
    .upload-text p {
      font-size: 13px;
      color: var(--text-muted);
    }
    .uploading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-top: 18px;
      color: var(--accent-secondary);
      font-size: 13px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .section-header h2 {
      font-size: 19px;
      color: #fff;
    }
    .empty-state {
      padding: 48px;
      text-align: center;
    }
    .empty-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }
    .table-container {
      overflow-x: auto;
    }
    .doc-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .doc-table th {
      text-align: left;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.04em;
    }
    .doc-table td {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: var(--text-secondary);
    }
    .filename-cell .filename {
      font-weight: 500;
      color: var(--text-primary);
      max-width: 260px;
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status-pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      text-transform: capitalize;
      background: rgba(255, 255, 255, 0.06);
    }
    .status-indexed {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
    }
    .status-error {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
    }
    .actions-group {
      display: flex;
      gap: 6px;
    }
    .btn-xs {
      padding: 4px 10px;
      font-size: 12px;
    }

    /* Inspector Drawer */
    .inspector-drawer {
      width: 100%;
      max-width: 780px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      padding: 24px;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 14px;
    }
    .chunks-scroll {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-right: 6px;
    }
    .chunk-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 14px;
    }
    .chunk-meta {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }
    .chunk-tag {
      font-size: 11px;
      font-weight: 700;
      color: var(--accent-primary);
      text-transform: uppercase;
    }
    .location-tag {
      font-size: 11px;
      background: rgba(255, 255, 255, 0.06);
      padding: 1px 6px;
      border-radius: 4px;
      color: var(--text-secondary);
    }
    .chunk-content {
      font-family: var(--font-body);
      font-size: 12.5px;
      color: var(--text-primary);
      white-space: pre-wrap;
      line-height: 1.5;
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
export class DocumentsComponent implements OnInit {
  documentService = inject(DocumentService);
  authService = inject(AuthService);

  documents = signal<DocumentItem[]>([]);
  isUploading = signal<boolean>(false);
  isDragging = signal<boolean>(false);
  selectedDoc = signal<DocumentItem | null>(null);
  docDetail = signal<DocumentItem | null>(null);
  loadingChunks = signal<boolean>(false);

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.documentService.getDocuments().subscribe({
      next: (docs) => this.documents.set(docs),
      error: () => this.documents.set([])
    });
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      this.uploadFiles(Array.from(e.dataTransfer.files));
    }
  }

  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
    if (files.length > 0) {
      this.uploadFiles(Array.from(files));
    }
  }

  uploadFiles(files: File[]): void {
    this.isUploading.set(true);
    let completed = 0;
    for (const file of files) {
      this.documentService.uploadDocument(file).subscribe({
        next: () => {
          completed++;
          if (completed >= files.length) {
            this.isUploading.set(false);
            this.loadDocuments();
          }
        },
        error: (err) => {
          completed++;
          console.error(err);
          if (completed >= files.length) {
            this.isUploading.set(false);
            this.loadDocuments();
          }
        }
      });
    }
  }

  viewChunks(doc: DocumentItem): void {
    this.selectedDoc.set(doc);
    this.loadingChunks.set(true);
    this.documentService.getDocument(doc.id).subscribe({
      next: (detail) => {
        this.docDetail.set(detail);
        this.loadingChunks.set(false);
      },
      error: () => this.loadingChunks.set(false)
    });
  }

  deleteDoc(id: string): void {
    if (confirm('Delete this document and all its indexed vector chunks?')) {
      this.documentService.deleteDocument(id).subscribe(() => this.loadDocuments());
    }
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
