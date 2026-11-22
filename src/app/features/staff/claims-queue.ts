import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  merge,
  skip,
  switchMap,
  tap,
} from 'rxjs';
import { Api } from '../../core/api';
import { errorMessage } from '../../core/http/http-error';
import { CLAIM_STATUSES, ClaimPage, ClaimStatus, STATUS_LABELS } from '../../core/models';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { StatusBadge } from '../../shared/ui/status-badge';
import { StaffContext } from './staff-context';

type Sort = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';

interface QueueQuery {
  q: string;
  status: ClaimStatus | 'all';
  type: '' | 'auto' | 'home';
  assignee: '' | 'me' | 'unassigned';
  sort: Sort;
  page: number;
}

const DEFAULTS: QueueQuery = {
  q: '',
  status: 'all',
  type: '',
  assignee: '',
  sort: 'newest',
  page: 1,
};
const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Highest amount' },
  { value: 'amount_asc', label: 'Lowest amount' },
];
const PAGE_SIZE = 10;

/** Filters live in the URL, so a view can be bookmarked, shared or restored with Back. */
function parseQuery(params: ParamMap): QueueQuery {
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const value = params.get(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  };
  return {
    q: params.get('q') ?? '',
    status: pick('status', ['all', ...CLAIM_STATUSES], 'all'),
    type: pick('type', ['', 'auto', 'home'], ''),
    assignee: pick('assignee', ['', 'me', 'unassigned'], ''),
    sort: pick(
      'sort',
      SORTS.map((s) => s.value),
      'newest',
    ),
    page: Math.max(1, Math.floor(Number(params.get('page'))) || 1),
  };
}

@Component({
  selector: 'app-claims-queue',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, CurrencyPipe, Avatar, Icon, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Claims queue</h1>
          <p>
            @if (page(); as p) {
              {{ p.counts.all }} {{ p.counts.all === 1 ? 'claim' : 'claims' }}
              @if (p.counts.submitted) {
                · {{ p.counts.submitted }} waiting for an agent
              }
            } @else {
              Loading claims…
            }
          </p>
        </div>
      </header>

      <div class="card">
        <div class="toolbar">
          <div class="input-icon search">
            <app-icon name="search" [size]="16" />
            <input
              class="input"
              type="search"
              placeholder="Claim number, name or policy"
              [formControl]="search"
              aria-label="Search claims"
            />
          </div>
          <div class="selects">
            <select
              class="select"
              aria-label="Claim type"
              [value]="query().type"
              (change)="update({ type: $any($event.target).value, page: 1 })"
            >
              <option value="">All types</option>
              <option value="auto">Auto</option>
              <option value="home">Home</option>
            </select>
            <select
              class="select"
              aria-label="Assignee"
              [value]="query().assignee"
              (change)="update({ assignee: $any($event.target).value, page: 1 })"
            >
              <option value="">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <select
              class="select"
              aria-label="Sort"
              (change)="update({ sort: $any($event.target).value, page: 1 })"
            >
              @for (s of sorts; track s.value) {
                <option [value]="s.value" [selected]="s.value === query().sort">
                  {{ s.label }}
                </option>
              }
            </select>
          </div>
        </div>

        <div class="tabs">
          <div class="segmented" role="group" aria-label="Filter by status">
            @for (s of statusTabs; track s) {
              <button
                type="button"
                [class.active]="query().status === s"
                [attr.aria-pressed]="query().status === s"
                (click)="update({ status: s, page: 1 })"
              >
                {{ label(s) }}
                <span class="count">{{ page()?.counts?.[s] ?? '' }}</span>
              </button>
            }
          </div>
        </div>

        @if (error(); as e) {
          <div class="state error">
            <span class="state-icon"><app-icon name="alert" /></span>
            <h3>Couldn't load claims</h3>
            <p>{{ e }}</p>
            <button class="btn btn-primary" type="button" (click)="reload$.next()">
              <app-icon name="refresh" [size]="16" /> Try again
            </button>
          </div>
        } @else {
          <div
            class="table-wrap"
            [class.loading]="loading() && page()"
            [attr.aria-busy]="loading()"
          >
            <table>
              <caption class="sr-only">
                Claims,
                {{
                  sortLabel()
                }}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Claim</th>
                  <th scope="col">Status</th>
                  <th scope="col" class="num">Amount</th>
                  <th scope="col" class="hide-md">Incident</th>
                  <th scope="col" class="hide-sm">Filed</th>
                  <th scope="col" class="hide-sm">Assignee</th>
                </tr>
              </thead>
              <tbody>
                @if (!page() && loading()) {
                  @for (i of skeletonRows; track i) {
                    <tr class="sk">
                      <td colspan="6"><div class="skeleton"></div></td>
                    </tr>
                  }
                }
                @for (c of page()?.items ?? []; track c.id) {
                  <tr>
                    <td>
                      <div class="claim">
                        <span class="type" [attr.title]="c.type === 'auto' ? 'Auto' : 'Home'">
                          <app-icon [name]="c.type === 'auto' ? 'car' : 'home'" [size]="16" />
                        </span>
                        <div>
                          <a class="row-link" [routerLink]="['/staff/claims', c.id]">
                            {{ c.claimantName }}
                          </a>
                          <span class="mono">{{ c.number }}</span>
                        </div>
                      </div>
                    </td>
                    <td><app-status-badge [status]="c.status" /></td>
                    <td class="num">{{ c.total | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
                    <td class="hide-md muted">{{ c.incidentDate | date: 'MMM d' }}</td>
                    <td class="hide-sm muted">{{ c.createdAt | date: 'MMM d, y' }}</td>
                    <td class="hide-sm">
                      @if (ctx.name(c.assigneeId); as name) {
                        <span class="assignee">
                          <app-avatar [name]="name" [size]="26" />
                          {{ name }}
                        </span>
                      } @else {
                        <span class="muted">Unassigned</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            @if (page()?.items?.length === 0) {
              <div class="state">
                <span class="state-icon"><app-icon name="inbox" /></span>
                <h3>No claims match</h3>
                <p>Try another search or clear the filters to see the whole queue.</p>
                <button class="btn btn-secondary" type="button" (click)="clearFilters()">
                  Clear filters
                </button>
              </div>
            }
          </div>

          @if (page(); as p) {
            @if (p.total > 0) {
              <footer class="pager">
                <span class="muted">
                  Showing
                  <strong
                    >{{ (p.page - 1) * p.pageSize + 1 }}–{{
                      min(p.page * p.pageSize, p.total)
                    }}</strong
                  >
                  of <strong>{{ p.total }}</strong>
                </span>
                <nav class="pager-controls" aria-label="Pages">
                  <button
                    class="btn-icon"
                    type="button"
                    [disabled]="p.page <= 1"
                    (click)="update({ page: p.page - 1 })"
                    aria-label="Previous page"
                  >
                    <app-icon name="chevron-left" />
                  </button>
                  @for (n of pageNumbers(); track $index) {
                    @if (n === null) {
                      <span class="gap">…</span>
                    } @else {
                      <button
                        class="page-btn"
                        type="button"
                        [class.active]="n === p.page"
                        (click)="update({ page: n })"
                        [attr.aria-current]="n === p.page ? 'page' : null"
                        [attr.aria-label]="'Page ' + n"
                      >
                        {{ n }}
                      </button>
                    }
                  }
                  <button
                    class="btn-icon"
                    type="button"
                    [disabled]="p.page >= totalPages()"
                    (click)="update({ page: p.page + 1 })"
                    aria-label="Next page"
                  >
                    <app-icon name="chevron-right" />
                  </button>
                </nav>
              </footer>
            }
          }
        }
      </div>
    </div>
  `,
  styles: `
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 16px 16px 12px;
    }
    .search {
      flex: 1 1 260px;
      max-width: 360px;
    }
    .selects {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      .select {
        width: auto;
        min-width: 130px;
      }
    }
    .tabs {
      padding: 0 16px 14px;
      border-bottom: 1px solid var(--border);
    }
    .table-wrap {
      position: relative;
      overflow-x: auto;
      transition: opacity 0.15s;
      &.loading {
        opacity: 0.55;
        pointer-events: none;
      }
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      padding: 10px 16px;
      text-align: left;
      white-space: nowrap;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: var(--surface-2);
    }
    td {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      white-space: nowrap;
    }
    tbody tr {
      position: relative;
      transition: background 0.12s;
      &:hover,
      &:focus-within {
        background: var(--surface-2);
      }
    }
    /* The whole row is clickable through the claimant link, which stays a real link for keyboards and new tabs. */
    .row-link {
      color: var(--text);
      font-weight: 600;
      &::after {
        content: '';
        position: absolute;
        inset: 0;
      }
      &:focus-visible {
        outline: none;
      }
    }
    tbody tr:has(.row-link:focus-visible) {
      outline: 2px solid var(--primary);
      outline-offset: -2px;
    }
    .claim {
      display: flex;
      align-items: center;
      gap: 12px;
      div {
        display: flex;
        flex-direction: column;
      }
      .mono {
        font-size: 12.5px;
        color: var(--text-3);
      }
    }
    .type {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--primary-soft);
      color: var(--primary);
      flex-shrink: 0;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }
    .assignee {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .sk td {
      padding: 14px 16px;
    }
    .sk .skeleton {
      height: 32px;
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      font-size: 13px;
      strong {
        color: var(--text);
        font-weight: 600;
      }
    }
    .pager-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .page-btn {
      min-width: 34px;
      height: 34px;
      padding: 0 6px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-2);
      font-weight: 500;
      cursor: pointer;
      &:hover {
        background: var(--surface-2);
      }
      &.active {
        background: var(--primary);
        color: var(--primary-contrast);
      }
    }
    .gap {
      padding: 0 4px;
      color: var(--text-3);
    }
    @media (max-width: 1100px) {
      .hide-md {
        display: none;
      }
    }
    @media (max-width: 640px) {
      .hide-sm {
        display: none;
      }
      .search {
        max-width: none;
      }
      .selects {
        display: grid;
        grid-template-columns: 1fr 1fr;
        width: 100%;
        .select {
          min-width: 0;
          width: 100%;
        }
        .select:last-child {
          grid-column: span 2;
        }
      }
      td,
      th {
        padding-left: 12px;
        padding-right: 12px;
      }
      .type {
        display: none;
      }
      .page-btn,
      .gap {
        display: none;
      }
      .page-btn.active {
        display: inline-block;
      }
    }
  `,
})
export class ClaimsQueue {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly ctx = inject(StaffContext);

  protected readonly sorts = SORTS;
  protected readonly statusTabs: (ClaimStatus | 'all')[] = ['all', ...CLAIM_STATUSES];
  protected readonly skeletonRows = Array.from({ length: 8 }, (_, i) => i);
  protected readonly min = Math.min;

  private readonly query$ = this.route.queryParamMap.pipe(map(parseQuery));
  protected readonly query = toSignal(this.query$, { initialValue: DEFAULTS });
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly reload$ = new Subject<void>();

  protected readonly page = signal<ClaimPage | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly sortLabel = computed(
    () => SORTS.find((s) => s.value === this.query().sort)?.label.toLowerCase() ?? '',
  );

  protected readonly totalPages = computed(() => {
    const p = this.page();
    return p ? Math.max(1, Math.ceil(p.total / p.pageSize)) : 1;
  });

  /** Compact pagination: 1 … 4 5 6 … 13 */
  protected readonly pageNumbers = computed<(number | null)[]>(() => {
    const total = this.totalPages();
    const current = this.page()?.page ?? 1;
    const wanted = new Set(
      [1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total),
    );
    const sorted = [...wanted].sort((a, b) => a - b);
    return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? [null, n] : [n]));
  });

  constructor() {
    // Fetch when the URL changes, on retry, and after a demo reset. switchMap drops stale responses.
    const reset$ = toObservable(this.ctx.version).pipe(skip(1));
    merge(this.query$, merge(this.reload$, reset$).pipe(map(() => this.query())))
      .pipe(
        tap((q) => {
          if (this.search.value !== q.q) this.search.setValue(q.q, { emitEvent: false });
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((q) =>
          this.api.claims({ ...q, pageSize: PAGE_SIZE }).pipe(
            catchError((err: unknown) => {
              this.error.set(errorMessage(err));
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.page.set(page);
        this.loading.set(false);
      });

    this.search.valueChanges
      .pipe(
        map((v) => v.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((q) => this.update({ q, page: 1 }));
  }

  protected label(status: ClaimStatus | 'all'): string {
    return status === 'all' ? 'All' : STATUS_LABELS[status];
  }

  protected update(patch: Partial<QueueQuery>): void {
    const next = { ...this.query(), ...patch };
    // Default values are left out so the URL stays short.
    const queryParams = Object.fromEntries(
      Object.entries(next).map(([k, v]) => [k, v === DEFAULTS[k as keyof QueueQuery] ? null : v]),
    );
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }

  protected clearFilters(): void {
    this.search.setValue('', { emitEvent: false });
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }
}
