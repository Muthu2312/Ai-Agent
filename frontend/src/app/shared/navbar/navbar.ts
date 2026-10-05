import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header class="navbar-wrapper">
      <div class="nav-container">
        <!-- Brand Logo & Badge -->
        <div class="brand" routerLink="/">
          <div class="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div class="brand-text">
            <span class="brand-title">AetherDoc</span>
            <span class="brand-tag">LangGraph Platform</span>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav class="nav-links">
          <a routerLink="/documents" routerLinkActive="active" class="nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>Document Hub</span>
          </a>

          <a routerLink="/agents" routerLinkActive="active" class="nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Agent Workspace</span>
          </a>

          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <span>Observability</span>
          </a>
        </nav>

        <!-- Right Side: Observability & Auth -->
        <div class="nav-actions">
          <a class="observability-badge" href="https://smith.langchain.com/o/d3dba61a-1595-4e51-92e3-c5017b929173/projects/p/e38d0945-f05b-4ed8-9f42-ea750315e30b" target="_blank" rel="noopener noreferrer" title="Open LangSmith Project: document-intelligence-platform">
            <span class="pulse-indicator"></span>
            <span class="obs-text">LangSmith Tracing ↗</span>
          </a>

          @if (authService.currentUser(); as user) {
            <div class="user-pill">
              <div class="user-avatar">{{ user.email.charAt(0).toUpperCase() }}</div>
              <span class="user-email">{{ user.email }}</span>
              <button class="btn-icon-logout" (click)="logout()" title="Logout">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          } @else {
            <button class="btn btn-primary" (click)="openAuth.emit()">
              Sign In / Demo
            </button>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    .navbar-wrapper {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(7, 9, 14, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-subtle);
    }
    .nav-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      background: var(--gradient-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      box-shadow: 0 0 16px rgba(99, 102, 241, 0.4);
    }
    .brand-text {
      display: flex;
      flex-direction: column;
    }
    .brand-title {
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      line-height: 1.1;
    }
    .brand-tag {
      font-size: 10px;
      color: var(--accent-secondary);
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(17, 24, 39, 0.5);
      padding: 4px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      font-size: 13.5px;
      font-weight: 500;
      color: var(--text-secondary);
      border-radius: var(--radius-md);
      transition: all 0.2s ease;
    }
    .nav-item:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.04);
    }
    .nav-item.active {
      color: #fff;
      background: var(--gradient-primary);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .observability-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
    }
    .obs-text {
      font-size: 11.5px;
      font-weight: 600;
      color: #34d399;
    }
    .user-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 12px 4px 4px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
    }
    .user-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--gradient-primary);
      color: white;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
    .user-email {
      font-size: 12.5px;
      color: var(--text-primary);
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .btn-icon-logout {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 4px;
      border-radius: 4px;
      transition: color 0.2s;
    }
    .btn-icon-logout:hover {
      color: #ef4444;
    }
  `]
})
export class NavbarComponent {
  authService = inject(AuthService);
  openAuth = output<void>();

  logout(): void {
    this.authService.logout().subscribe();
  }
}
