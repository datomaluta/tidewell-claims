import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../../shared/ui/toast.service';
import { errorMessage } from './http-error';

/**
 * Shows a toast when a write request (POST/PUT/PATCH/DELETE) fails.
 * Failed reads and uploads are shown inline by the page that made them, with a retry button.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: unknown) => {
      const isWrite = req.method !== 'GET';
      const handledElsewhere = err instanceof HttpErrorResponse && err.status === 401;
      if (
        isWrite &&
        !handledElsewhere &&
        !req.url.endsWith('/auth/login') &&
        req.url !== '/api/uploads'
      ) {
        toast.show('error', errorMessage(err));
      }
      return throwError(() => err);
    }),
  );
};
