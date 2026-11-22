import { HttpErrorResponse } from '@angular/common/http';

/** Turns any thrown value into a message that is safe to show in the UI. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Network error. Check your connection and try again.';
    return err.error?.message ?? `Request failed (${err.status})`;
  }
  return 'Something went wrong. Please try again.';
}
