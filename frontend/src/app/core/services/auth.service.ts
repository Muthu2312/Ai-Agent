import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, TokenResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth`;

  currentUser = signal<User | null>(null);
  isLoading = signal<boolean>(false);

  constructor() {
    this.checkSession();
  }

  checkSession(): void {
    this.http.get<User>(`${this.apiUrl}/me`, { withCredentials: true }).pipe(
      catchError(() => of(null))
    ).subscribe(user => {
      this.currentUser.set(user);
    });
  }

  register(email: string, password: string, full_name?: string): Observable<TokenResponse> {
    this.isLoading.set(true);
    return this.http.post<TokenResponse>(
      `${this.apiUrl}/register`,
      { email, password, full_name },
      { withCredentials: true }
    ).pipe(
      tap(res => {
        this.currentUser.set(res.user);
        this.isLoading.set(false);
      })
    );
  }

  login(email: string, password: string): Observable<TokenResponse> {
    this.isLoading.set(true);
    return this.http.post<TokenResponse>(
      `${this.apiUrl}/login`,
      { email, password },
      { withCredentials: true }
    ).pipe(
      tap(res => {
        this.currentUser.set(res.user);
        this.isLoading.set(false);
      })
    );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).pipe(
      tap(() => this.currentUser.set(null))
    );
  }
}
