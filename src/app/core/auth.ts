import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { StaffUser } from './models';
import { storage } from './storage';

interface Session {
  token: string;
  user: StaffUser;
}

const KEY = 'tidewell.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(storage.get<Session | null>(KEY, null));

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isManager = computed(() => this.user()?.role === 'manager');

  signIn(userId: string): Observable<Session> {
    return this.http.post<Session>('/api/auth/login', { userId }).pipe(
      tap((session) => {
        this.session.set(session);
        storage.set(KEY, session);
      }),
    );
  }

  signOut(redirect = true): void {
    this.session.set(null);
    storage.remove(KEY);
    if (redirect) void this.router.navigateByUrl('/staff/sign-in');
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && token) {
        auth.signOut(false);
        void router.navigate(['/staff/sign-in'], {
          queryParams: { returnUrl: router.url, expired: 1 },
        });
      }
      return throwError(() => err);
    }),
  );
};

export const staffGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.user()) return true;
  return inject(Router).createUrlTree(['/staff/sign-in'], {
    queryParams: { returnUrl: state.url },
  });
};
