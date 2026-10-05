import { Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-card glass-panel" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div>
            <h3>{{ isLogin() ? 'Sign In to Platform' : 'Create Intelligence Account' }}</h3>
            <p class="subtitle">Secure session with JWT & httpOnly cookies</p>
          </div>
          <button class="btn-close" (click)="close.emit()">&times;</button>
        </div>

        <!-- Quick Demo Button -->
        <div class="demo-box">
          <div class="demo-info">
            <span class="demo-badge">Fast Access</span>
            <p>Skip manual input and sign in as <strong>Demo Document Analyst</strong>.</p>
          </div>
          <button class="btn btn-secondary btn-sm" (click)="quickDemoLogin()" [disabled]="authService.isLoading()">
            Instant Demo Sign In
          </button>
        </div>

        <div class="divider">
          <span>or continue with email</span>
        </div>

        <!-- Form -->
        <form (ngSubmit)="submit()">
          @if (!isLogin()) {
            <div class="form-group">
              <label>Full Name</label>
              <input type="text" [(ngModel)]="fullName" name="fullName" class="input-text" placeholder="Sarah Connor" />
            </div>
          }

          <div class="form-group">
            <label>Email Address</label>
            <input type="email" [(ngModel)]="email" name="email" class="input-text" placeholder="analyst@enterprise.ai" required />
          </div>

          <div class="form-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="password" name="password" class="input-text" placeholder="••••••••" required />
          </div>

          @if (errorMessage()) {
            <div class="error-alert">
              {{ errorMessage() }}
            </div>
          }

          <button type="submit" class="btn btn-primary btn-block" [disabled]="authService.isLoading()">
            @if (authService.isLoading()) {
              <span>Authenticating...</span>
            } @else {
              <span>{{ isLogin() ? 'Sign In' : 'Register Account' }}</span>
            }
          </button>
        </form>

        <!-- Toggle -->
        <div class="modal-footer">
          @if (isLogin()) {
            <span>Don't have an account?</span>
            <button type="button" class="btn-link" (click)="isLogin.set(false)">Create one now</button>
          } @else {
            <span>Already have an account?</span>
            <button type="button" class="btn-link" (click)="isLogin.set(true)">Sign in instead</button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal-card {
      width: 100%;
      max-width: 440px;
      padding: 28px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      animation: modalSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes modalSlide {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;
      margin-bottom: 20px;
    }
    .header-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      background: var(--gradient-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    h3 {
      font-size: 18px;
      color: #fff;
    }
    .subtitle {
      font-size: 12px;
      color: var(--text-muted);
    }
    .btn-close {
      position: absolute;
      top: -6px;
      right: -6px;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 24px;
      cursor: pointer;
    }
    .demo-box {
      background: rgba(99, 102, 241, 0.08);
      border: 1px dashed rgba(99, 102, 241, 0.3);
      border-radius: var(--radius-md);
      padding: 12px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .demo-badge {
      font-size: 10px;
      background: var(--accent-primary);
      color: white;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 700;
      text-transform: uppercase;
      display: inline-block;
      margin-bottom: 4px;
    }
    .demo-info p {
      font-size: 12.5px;
      color: var(--text-secondary);
    }
    .btn-sm {
      padding: 6px 12px;
      font-size: 12.5px;
    }
    .divider {
      text-align: center;
      margin: 16px 0;
      position: relative;
    }
    .divider::before {
      content: '';
      position: absolute;
      top: 50%; left: 0; right: 0;
      height: 1px;
      background: var(--border-subtle);
    }
    .divider span {
      position: relative;
      background: #0d121f;
      padding: 0 10px;
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    .form-group {
      margin-bottom: 14px;
    }
    label {
      display: block;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }
    .btn-block {
      width: 100%;
      margin-top: 10px;
      padding: 10px;
    }
    .error-alert {
      padding: 8px 12px;
      border-radius: var(--radius-md);
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      font-size: 12px;
      margin-bottom: 12px;
    }
    .modal-footer {
      margin-top: 18px;
      text-align: center;
      font-size: 12.5px;
      color: var(--text-muted);
      display: flex;
      justify-content: center;
      gap: 6px;
    }
    .btn-link {
      background: none;
      border: none;
      color: var(--accent-secondary);
      font-size: 12.5px;
      cursor: pointer;
      text-decoration: underline;
    }
  `]
})
export class AuthModalComponent {
  authService = inject(AuthService);
  close = output<void>();

  isLogin = signal<boolean>(true);
  email = '';
  password = '';
  fullName = '';
  errorMessage = signal<string>('');

  quickDemoLogin(): void {
    this.errorMessage.set('');
    // Try to login demo account or register it if first run
    this.authService.login('analyst@aetherdoc.internal', 'demo12345').subscribe({
      next: () => this.close.emit(),
      error: () => {
        this.authService.register('analyst@aetherdoc.internal', 'demo12345', 'Demo Document Analyst').subscribe({
          next: () => this.close.emit(),
          error: (err) => this.errorMessage.set(err.error?.detail || 'Demo login failed')
        });
      }
    });
  }

  submit(): void {
    this.errorMessage.set('');
    if (this.isLogin()) {
      this.authService.login(this.email, this.password).subscribe({
        next: () => this.close.emit(),
        error: (err) => this.errorMessage.set(err.error?.detail || 'Login failed. Check your credentials.')
      });
    } else {
      this.authService.register(this.email, this.password, this.fullName).subscribe({
        next: () => this.close.emit(),
        error: (err) => this.errorMessage.set(err.error?.detail || 'Registration failed.')
      });
    }
  }
}
