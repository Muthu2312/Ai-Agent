import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PlatformStats {
  total_documents: number;
  total_chunks: number;
  total_sessions: number;
  total_messages: number;
  file_formats: Record<string, number>;
  vector_db: {
    engine: string;
    indexed_vectors: number;
    status: string;
  };
  observability: {
    tracing_enabled: boolean;
    project: string;
    endpoint: string;
    has_api_key: boolean;
    dashboard_url?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/analytics`;

  getStats(): Observable<PlatformStats> {
    return this.http.get<PlatformStats>(`${this.apiUrl}/stats`, { withCredentials: true });
  }
}
