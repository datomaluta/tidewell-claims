import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AuditPage,
  Claim,
  ClaimDocument,
  ClaimInput,
  ClaimPage,
  ClaimReply,
  ClaimStatus,
  Policy,
  PublicClaim,
  StaffUser,
} from './models';

export interface ClaimQuery {
  status?: ClaimStatus | 'all';
  type?: string;
  q?: string;
  assignee?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface ActivityQuery {
  actor?: string;
  action?: string;
  page?: number;
}

/** Builds HttpParams and drops empty values. */
function params(query: object): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') p = p.set(key, String(value));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  /* Claimant side */

  policy(number: string): Observable<Policy> {
    return this.http.get<Policy>(`/api/policies/${encodeURIComponent(number)}`);
  }

  submitClaim(input: ClaimInput): Observable<Claim> {
    return this.http.post<Claim>('/api/claims', input);
  }

  upload(file: File): Observable<HttpEvent<ClaimDocument>> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<ClaimDocument>('/api/uploads', body, {
      reportProgress: true,
      observe: 'events',
    });
  }

  track(number: string, lastName: string): Observable<PublicClaim> {
    return this.http.get<PublicClaim>('/api/track', { params: params({ number, lastName }) });
  }

  reply(reply: ClaimReply): Observable<PublicClaim> {
    return this.http.post<PublicClaim>('/api/track/reply', reply);
  }

  /* Staff side */

  claims(query: ClaimQuery): Observable<ClaimPage> {
    return this.http.get<ClaimPage>('/api/claims', { params: params(query) });
  }

  claim(id: string): Observable<Claim> {
    return this.http.get<Claim>(`/api/claims/${id}`);
  }

  transition(id: string, to: ClaimStatus, note?: string): Observable<Claim> {
    return this.http.post<Claim>(`/api/claims/${id}/transition`, { to, note });
  }

  assign(id: string, assigneeId: string): Observable<Claim> {
    return this.http.post<Claim>(`/api/claims/${id}/assign`, { assigneeId });
  }

  addNote(id: string, note: string): Observable<Claim> {
    return this.http.post<Claim>(`/api/claims/${id}/notes`, { note });
  }

  staff(): Observable<StaffUser[]> {
    return this.http.get<StaffUser[]>('/api/staff');
  }

  activity(query: ActivityQuery): Observable<AuditPage> {
    return this.http.get<AuditPage>('/api/activity', { params: params(query) });
  }

  resetDemo(): Observable<unknown> {
    return this.http.post('/api/demo/reset', {});
  }
}
