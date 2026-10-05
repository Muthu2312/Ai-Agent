import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AgentQueryRequest,
  AgentQueryResponse,
  AgentSession,
  AgentMessage,
} from '../models/agent.model';

@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/agents`;

  queryAgents(request: AgentQueryRequest): Observable<AgentQueryResponse> {
    return this.http.post<AgentQueryResponse>(`${this.apiUrl}/query`, request, { withCredentials: true });
  }

  createSession(title: string): Observable<AgentSession> {
    return this.http.post<AgentSession>(`${this.apiUrl}/sessions?title=${encodeURIComponent(title)}`, {}, { withCredentials: true });
  }

  getSessions(): Observable<AgentSession[]> {
    return this.http.get<AgentSession[]>(`${this.apiUrl}/sessions`, { withCredentials: true });
  }

  getSessionMessages(sessionId: string): Observable<AgentMessage[]> {
    return this.http.get<AgentMessage[]>(`${this.apiUrl}/sessions/${sessionId}/messages`, { withCredentials: true });
  }
}
