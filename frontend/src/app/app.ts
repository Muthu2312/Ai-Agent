import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './shared/navbar/navbar';
import { AuthModalComponent } from './features/auth/auth-modal';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, AuthModalComponent],
  template: `
    <app-navbar (openAuth)="showAuthModal.set(true)"></app-navbar>

    <main class="main-content">
      <router-outlet></router-outlet>
    </main>

    @if (showAuthModal()) {
      <app-auth-modal (close)="showAuthModal.set(false)"></app-auth-modal>
    }
  `,
  styles: [`
    .main-content {
      min-height: calc(100vh - 70px);
    }
  `]
})
export class App {
  showAuthModal = signal<boolean>(false);
}
