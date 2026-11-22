import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Api } from '../../core/api';
import { errorMessage } from '../../core/http/http-error';
import { AuditAction } from '../../core/models';
import { Icon, IconName } from '../../shared/ui/icon';
import { StaffContext } from './staff-context';

const ACTIONS: { value: AuditAction; label: string; icon: IconName }[] = [
  { value: 'claim_submitted', label: 'Claim submitted', icon: 'send' },
  { value: 'status_changed', label: 'Status changed', icon: 'circle-check' },
  { value: 'assigned', label: 'Assigned', icon: 'user-check' },
  { value: 'note_added', label: 'Note added', icon: 'message' },
];

interface LogQuery {
  actor: string;
  action: string;
  page: number;
}

/** Read-only audit trail of everything that happened to claims, filterable by person and action. */
@Component({
  selector: 'app-activity-log',
  imports: [RouterLink, DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Activity log</h1>
          <p>Every change to a claim, who made it and when.</p>
        </div>
      </header>

      <div class="card">
        <div class="toolbar">
          <select
            class="select"
            aria-label="Person"
            (change)="update({ actor: $any($event.target).value, page: 1 })"
          >
            <option value="" [selected]="!query().actor">Everyone</option>
            <option value="claimant" [selected]="query().actor === 'claimant'">Claimants</option>
            @for (s of ctx.staff(); track s.id) {
              <option [value]="s.id" [selected]="query().actor === s.id">{{ s.name }}</option>
            }
          </select>
          <select
            class="select"
            aria-label="Action"
            (change)="update({ action: $any($event.target).value, page: 1 })"
          >
            <option value="" [selected]="!query().action">All actions</option>
            @for (a of actions; track a.value) {
              <option [value]="a.value" [selected]="query().action === a.value">
                {{ a.label }}
              </option>
            }
          </select>
          @if (log.hasValue()) {
            @let p = log.value();
            <span class="muted total">{{ p.total }} {{ p.total === 1 ? 'entry' : 'entries' }}</span>
          }
        </div>

        @if (log.error(); as err) {
          <div class="state error">
            <span class="state-icon"><app-icon name="alert" /></span>
            <h3>Couldn't load the log</h3>
            <p>{{ message(err) }}</p>
            <button class="btn btn-primary" type="button" (click)="log.reload()">
              <app-icon name="refresh" [size]="16" /> Try again
            </button>
          </div>
        } @else if (log.hasValue()) {
          @let p = log.value();
          <ul class="entries" [class.loading]="log.isLoading()" [attr.aria-busy]="log.isLoading()">
            @for (e of p.items; track e.id) {
              <li>
                <span class="icon" [class]="e.action">
                  <app-icon [name]="icon(e.action)" [size]="15" />
                </span>
                <div class="body">
                  <p>
                    <strong>{{ e.actorName }}</strong>
                    @if (e.actorId === null) {
                      <span class="chip">Claimant</span>
                    }
                    ·
                    <a class="mono" [routerLink]="['/staff/claims', e.claimId]">{{
                      e.claimNumber
                    }}</a>
                  </p>
                  <p class="detail">{{ e.detail }}</p>
                </div>
                <time [attr.datetime]="e.at">
                  <span>{{ e.at | date: 'MMM d' }}</span>
                  <span>{{ e.at | date: 'h:mm a' }}</span>
                </time>
              </li>
            } @empty {
              <li class="state">
                <span class="state-icon"><app-icon name="history" /></span>
                <h3>Nothing here yet</h3>
                <p>No activity matches these filters.</p>
              </li>
            }
          </ul>

          @if (p.total > p.pageSize) {
            <footer class="pager">
              <span class="muted">Page {{ p.page }} of {{ pages() }}</span>
              <div class="pager-controls">
                <button
                  class="btn btn-secondary"
                  type="button"
                  [disabled]="p.page <= 1"
                  (click)="update({ page: p.page - 1 })"
                >
                  <app-icon name="chevron-left" [size]="16" /> Newer
                </button>
                <button
                  class="btn btn-secondary"
                  type="button"
                  [disabled]="p.page >= pages()"
                  (click)="update({ page: p.page + 1 })"
                >
                  Older <app-icon name="chevron-right" [size]="16" />
                </button>
              </div>
            </footer>
          }
        } @else {
          <div class="sk" aria-busy="true" aria-label="Loading activity">
            @for (i of skeleton; track i) {
              <div class="skeleton"></div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 16px;
      border-bottom: 1px solid var(--border);
      .select {
        width: auto;
        min-width: 160px;
      }
    }
    .total {
      margin-left: auto;
      font-size: 13px;
    }
    .entries {
      margin: 0;
      padding: 0;
      list-style: none;
      transition: opacity 0.15s;
      &.loading {
        opacity: 0.55;
      }
      li:not(.state) {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        border-top: 1px solid var(--border);
        &:first-child {
          border-top: 0;
        }
      }
    }
    .icon {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--surface-2);
      color: var(--text-2);
      &.status_changed {
        background: var(--primary-soft);
        color: var(--primary);
      }
      &.claim_submitted {
        background: var(--info-soft);
        color: var(--info);
      }
      &.note_added {
        background: var(--warning-soft);
        color: var(--warning);
      }
    }
    .body {
      flex: 1;
      min-width: 0;
      p {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      strong {
        font-weight: 600;
      }
      .chip {
        height: 20px;
        font-size: 11.5px;
      }
    }
    .detail {
      margin-top: 2px !important;
      color: var(--text-2);
      overflow-wrap: anywhere;
    }
    time {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      flex-shrink: 0;
      font-size: 12.5px;
      color: var(--text-3);
      white-space: nowrap;
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      font-size: 13px;
    }
    .pager-controls {
      display: flex;
      gap: 8px;
    }
    .sk {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      .skeleton {
        height: 44px;
      }
    }
    @media (max-width: 640px) {
      .toolbar .select {
        flex: 1 1 0;
        min-width: 0;
      }
      .total {
        width: 100%;
        margin-left: 0;
      }
    }
  `,
})
export class ActivityLog {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly ctx = inject(StaffContext);

  protected readonly actions = ACTIONS;
  protected readonly skeleton = [1, 2, 3, 4, 5, 6];

  protected readonly query = toSignal(
    this.route.queryParamMap.pipe(
      map((p): LogQuery => ({
        actor: p.get('actor') ?? '',
        action: p.get('action') ?? '',
        page: Math.max(1, Math.floor(Number(p.get('page'))) || 1),
      })),
    ),
    { requireSync: true },
  );

  protected readonly log = rxResource({
    params: () => ({ ...this.query(), version: this.ctx.version() }),
    stream: ({ params }) =>
      this.api.activity({ actor: params.actor, action: params.action, page: params.page }),
  });

  protected readonly pages = computed(() => {
    const p = this.log.hasValue() ? this.log.value() : null;
    return p ? Math.max(1, Math.ceil(p.total / p.pageSize)) : 1;
  });

  protected update(patch: Partial<LogQuery>): void {
    const next = { ...this.query(), ...patch };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        actor: next.actor || null,
        action: next.action || null,
        page: next.page > 1 ? next.page : null,
      },
      replaceUrl: true,
    });
  }

  protected icon(action: AuditAction): IconName {
    return ACTIONS.find((a) => a.value === action)?.icon ?? 'history';
  }

  protected message(err: unknown): string {
    return errorMessage((err as { cause?: unknown } | null)?.cause ?? err);
  }
}
