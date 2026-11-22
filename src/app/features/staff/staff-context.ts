import { Injectable, inject, signal } from '@angular/core';
import { Api } from '../../core/api';
import { StaffUser } from '../../core/models';

/** Shared state for the staff area: the team list and a counter that pages reload on. */
@Injectable({ providedIn: 'root' })
export class StaffContext {
  private readonly api = inject(Api);
  private readonly team = signal<StaffUser[]>([]);
  private loading = false;

  readonly staff = this.team.asReadonly();
  /** Bumped after the demo data is reset, so open pages fetch again. */
  readonly version = signal(0);

  load(): void {
    if (this.loading || this.team().length) return;
    this.loading = true;
    this.api.staff().subscribe({
      next: (list) => this.team.set(list),
      error: () => (this.loading = false),
      complete: () => (this.loading = false),
    });
  }

  name(id: string | null): string | null {
    return this.team().find((s) => s.id === id)?.name ?? null;
  }
}
