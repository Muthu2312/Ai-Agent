import { Routes } from '@angular/router';
import { DocumentsComponent } from './features/documents/documents';
import { AgentChatComponent } from './features/agent-chat/agent-chat';
import { DashboardComponent } from './features/dashboard/dashboard';

export const routes: Routes = [
  { path: '', redirectTo: 'agents', pathMatch: 'full' },
  { path: 'documents', component: DocumentsComponent },
  { path: 'agents', component: AgentChatComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: '**', redirectTo: 'agents' },
];
