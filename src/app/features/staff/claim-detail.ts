import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { AuthService } from '../../core/auth';
import { errorMessage } from '../../core/http/http-error';
import { Claim, HOME_CAUSES, ITEM_CATEGORIES } from '../../core/models';
import { formatDate } from '../../core/validators';
import { canAssign, isFinal } from '../../core/workflow';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ToastService } from '../../shared/ui/toast.service';
import { ClaimActions } from './claim-actions';
import { ClaimTimeline } from './claim-timeline';
import { StaffContext } from './staff-context';

/** Resource errors can arrive wrapped, so look at the cause too. */
function httpStatus(err: unknown): number | null {
  const e = err instanceof HttpErrorResponse ? err : (err as { cause?: unknown } | null)?.cause;
  return e instanceof HttpErrorResponse ? e.status : null;
}

@Component({
  selector: 'app-claim-detail',
  imports: [
    RouterLink,
    DatePipe,
    CurrencyPipe,
    DecimalPipe,
    Icon,
    Avatar,
    StatusBadge,
    ClaimActions,
    ClaimTimeline,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a class="back" routerLink="/staff/claims">
        <app-icon name="arrow-left" [size]="16" /> Claims queue
      </a>

      @if (claim.hasValue()) {
        @let c = claim.value();
        <header class="head">
          <div class="title">
            <span class="type"><app-icon [name]="c.type === 'auto' ? 'car' : 'home'" /></span>
            <div>
              <div class="title-row">
                <h1 class="mono">{{ c.number }}</h1>
                <app-status-badge [status]="c.status" />
              </div>
              <p>
                {{ c.type === 'auto' ? 'Auto' : 'Home' }} claim from
                <strong>{{ c.claimant.firstName }} {{ c.claimant.lastName }}</strong> · filed
                {{ c.createdAt | date: 'MMM d, y' }}
              </p>
            </div>
          </div>
          <div class="amount">
            <span>Claimed</span>
            <strong>{{ c.total | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
          </div>
        </header>

        <div class="layout">
          <app-claim-actions
            class="actions"
            [claim]="c"
            [deductible]="deductible()"
            (changed)="update($event)"
          />

          <aside class="side">
            <section class="card box" aria-labelledby="assign-title">
              <h2 id="assign-title">Assignee</h2>
              @if (ctx.name(c.assigneeId); as name) {
                <div class="person">
                  <app-avatar [name]="name" [size]="34" />
                  <div>
                    <strong>{{ name }}</strong>
                    <span>{{ c.assigneeId === auth.user()?.id ? 'You' : 'Claims team' }}</span>
                  </div>
                </div>
              } @else {
                <p class="muted">Nobody yet.</p>
              }
              @if (auth.isManager() && !closed()) {
                <div class="field reassign">
                  <label for="assignee">{{ c.assigneeId ? 'Reassign to' : 'Assign to' }}</label>
                  <select
                    id="assignee"
                    class="select"
                    [disabled]="assigning()"
                    (change)="assign($any($event.target))"
                  >
                    @if (!c.assigneeId) {
                      <option value="" selected disabled>Choose a team member</option>
                    }
                    @for (s of ctx.staff(); track s.id) {
                      <option [value]="s.id" [selected]="s.id === c.assigneeId">
                        {{ s.name }} · {{ s.role === 'manager' ? 'Manager' : 'Agent' }}
                      </option>
                    }
                  </select>
                </div>
              } @else if (closed()) {
                <p class="hint">Closed claims keep their assignee.</p>
              } @else if (assignBlocked(); as reason) {
                <p class="hint">{{ reason }}</p>
              }
            </section>

            <section class="card box" aria-labelledby="claimant-title">
              <h2 id="claimant-title">Claimant</h2>
              <dl>
                <dt>Name</dt>
                <dd>{{ c.claimant.firstName }} {{ c.claimant.lastName }}</dd>
                <dt>Email</dt>
                <dd>
                  <a [href]="'mailto:' + c.claimant.email">{{ c.claimant.email }}</a>
                </dd>
                <dt>Phone</dt>
                <dd>
                  <a [href]="'tel:' + c.claimant.phone">{{ c.claimant.phone }}</a>
                </dd>
              </dl>
            </section>

            <section class="card box" aria-labelledby="policy-title">
              <h2 id="policy-title">Policy</h2>
              @if (policy.hasValue()) {
                @let p = policy.value();
                <dl>
                  <dt>Number</dt>
                  <dd class="mono">{{ p.number }}</dd>
                  <dt>Holder</dt>
                  <dd>{{ p.holderName }}</dd>
                  <dt>Period</dt>
                  <dd>{{ date(p.validFrom) }} – {{ date(p.validTo) }}</dd>
                  <dt>Coverage limit</dt>
                  <dd>{{ p.coverageLimit | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
                  <dt>Deductible</dt>
                  <dd>{{ p.deductible | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
                </dl>
              } @else if (policy.isLoading()) {
                <div class="skeleton" style="height: 120px"></div>
              } @else {
                <p class="muted mono">{{ c.policyNumber }}</p>
              }
            </section>
          </aside>

          <div class="details">
            <section class="card box" aria-labelledby="incident-title">
              <h2 id="incident-title">What happened</h2>
              <p class="story">{{ c.incident.description }}</p>
              <dl class="grid">
                <div>
                  <dt>When</dt>
                  <dd>{{ date(c.incident.date) }} at {{ c.incident.time }}</dd>
                </div>
                <div>
                  <dt>Where</dt>
                  <dd>{{ c.incident.location }}</dd>
                </div>
                <div>
                  <dt>Police report</dt>
                  <dd>{{ c.incident.policeReportNumber || 'None' }}</dd>
                </div>
                @if (c.incident.auto; as a) {
                  <div>
                    <dt>Vehicle</dt>
                    <dd>
                      {{ a.vehicle.year }} {{ a.vehicle.make }} {{ a.vehicle.model }} ·
                      <span class="mono">{{ a.vehicle.plate }}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Drivable</dt>
                    <dd>{{ a.drivable ? 'Yes' : 'No' }}</dd>
                  </div>
                  <div>
                    <dt>Other party</dt>
                    <dd>
                      @if (a.otherParty; as o) {
                        {{ o.name }}, {{ o.insurer }} · <span class="mono">{{ o.plate }}</span>
                      } @else {
                        None
                      }
                    </dd>
                  </div>
                }
                @if (c.incident.home; as h) {
                  <div>
                    <dt>Cause</dt>
                    <dd>{{ cause(h.cause) }}</dd>
                  </div>
                  <div>
                    <dt>Rooms</dt>
                    <dd>{{ h.rooms.join(', ') }}</dd>
                  </div>
                  <div>
                    <dt>Home livable</dt>
                    <dd>
                      {{ h.habitable ? 'Yes' : 'No' }}
                      @if (h.needsAccommodation) {
                        · needs a place to stay
                      }
                    </dd>
                  </div>
                }
              </dl>
            </section>

            <section class="card" aria-labelledby="items-title">
              <header class="card-header">
                <h2 id="items-title">Damage and costs</h2>
                <span class="muted"
                  >{{ c.items.length }} {{ c.items.length === 1 ? 'item' : 'items' }}</span
                >
              </header>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col" class="hide-sm">Category</th>
                      <th scope="col" class="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of c.items; track $index) {
                      <tr>
                        <td>{{ item.description }}</td>
                        <td class="hide-sm muted">{{ category(item.category) }}</td>
                        <td class="num">{{ item.amount | currency: 'USD' }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colspan="2">Total claimed</th>
                      <td class="num">{{ c.total | currency: 'USD' }}</td>
                    </tr>
                    @if (policy.hasValue()) {
                      @let p = policy.value();
                      <tr class="minor">
                        <th scope="row" colspan="2">Deductible</th>
                        <td class="num">−{{ p.deductible | currency: 'USD' }}</td>
                      </tr>
                      <tr class="payout">
                        <th scope="row" colspan="2">Estimated payout</th>
                        <td class="num">{{ payout(c.total, p.deductible) | currency: 'USD' }}</td>
                      </tr>
                    }
                  </tfoot>
                </table>
              </div>
              @if (policy.hasValue()) {
                @let p = policy.value();
                <div class="limit">
                  <div class="limit-text">
                    <span>Coverage used</span>
                    <span>
                      {{ (c.total / p.coverageLimit) * 100 | number: '1.0-0' }}% of
                      {{ p.coverageLimit | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </span>
                  </div>
                  <div class="bar" aria-hidden="true">
                    <span [style.width.%]="min(100, (c.total / p.coverageLimit) * 100)"></span>
                  </div>
                </div>
              }
            </section>

            <section class="card box" aria-labelledby="docs-title">
              <h2 id="docs-title">Photos and documents</h2>
              <ul class="docs">
                @for (d of c.documents; track d.id) {
                  <li>
                    <span class="doc-icon">
                      <app-icon
                        [name]="d.mimeType.startsWith('image/') ? 'image' : 'file'"
                        [size]="18"
                      />
                    </span>
                    <span class="doc-name">{{ d.name }}</span>
                    <span class="muted">{{ d.size / 1024 / 1024 | number: '1.1-1' }} MB</span>
                  </li>
                }
              </ul>
              <p class="hint">The demo keeps file details only, not the files themselves.</p>
            </section>

            <app-claim-timeline [claim]="c" (changed)="update($event)" />
          </div>
        </div>
      } @else if (claim.isLoading()) {
        <div class="loading" aria-busy="true" aria-label="Loading claim">
          <div class="skeleton" style="height: 56px; max-width: 420px"></div>
          <div class="layout">
            <div class="skeleton actions" style="height: 150px"></div>
            <div class="skeleton side" style="height: 320px"></div>
            <div class="skeleton details" style="height: 420px"></div>
          </div>
        </div>
      } @else if (claim.error(); as err) {
        @if (notFound()) {
          <div class="card state">
            <span class="state-icon"><app-icon name="search" /></span>
            <h3>Claim not found</h3>
            <p>It may have been removed when the demo data was reset.</p>
            <a class="btn btn-secondary" routerLink="/staff/claims">Back to the queue</a>
          </div>
        } @else {
          <div class="card state error">
            <span class="state-icon"><app-icon name="alert" /></span>
            <h3>Couldn't load this claim</h3>
            <p>{{ message(err) }}</p>
            <button class="btn btn-primary" type="button" (click)="claim.reload()">
              <app-icon name="refresh" [size]="16" /> Try again
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 16px;
      color: var(--text-2);
      font-size: 13.5px;
      font-weight: 500;
      &:hover {
        color: var(--primary);
      }
    }
    .head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .title {
      display: flex;
      gap: 14px;
      align-items: center;
      min-width: 0;
      p {
        margin: 4px 0 0;
        color: var(--text-2);
      }
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    h1 {
      font-size: 24px;
      letter-spacing: -0.01em;
    }
    .type {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 46px;
      height: 46px;
      border-radius: 12px;
      background: var(--primary-soft);
      color: var(--primary);
    }
    .amount {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      span {
        font-size: 12.5px;
        color: var(--text-3);
      }
      strong {
        font-size: 24px;
        font-variant-numeric: tabular-nums;
      }
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      grid-template-areas:
        'actions side'
        'details side';
      grid-template-rows: auto 1fr;
      gap: 16px;
      align-items: start;
    }
    .actions {
      grid-area: actions;
      display: block;
    }
    .side {
      grid-area: side;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .details {
      grid-area: details;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    .box {
      padding: 18px 20px;
      h2 {
        margin-bottom: 12px;
        font-size: 15px;
      }
    }
    .card-header h2 {
      font-size: 15px;
    }
    .person {
      display: flex;
      align-items: center;
      gap: 10px;
      div {
        display: flex;
        flex-direction: column;
      }
      span {
        font-size: 12.5px;
        color: var(--text-3);
      }
    }
    .reassign {
      margin-top: 14px;
    }
    .hint {
      margin: 10px 0 0;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 16px;
      margin: 0;
      font-size: 13.5px;
      dt {
        color: var(--text-3);
      }
      dd {
        margin: 0;
        text-align: right;
        overflow-wrap: anywhere;
      }
    }
    dl.grid {
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 14px 20px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      dd {
        margin-top: 2px;
        text-align: left;
        font-weight: 500;
      }
    }
    .story {
      margin: 0;
      line-height: 1.6;
      white-space: pre-line;
    }
    .table-wrap {
      margin-top: 12px;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 10px 20px;
      text-align: left;
    }
    thead th {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-3);
      background: var(--surface-2);
    }
    tbody td {
      border-top: 1px solid var(--border);
    }
    tfoot {
      th {
        font-weight: 500;
        color: var(--text-2);
      }
      tr:first-child > * {
        border-top: 1px solid var(--border);
        color: var(--text);
        font-weight: 600;
      }
      .minor > * {
        padding-top: 2px;
        padding-bottom: 2px;
        color: var(--text-3);
        font-size: 13px;
      }
      .payout > * {
        color: var(--primary);
        font-weight: 600;
      }
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .limit {
      padding: 8px 20px 18px;
    }
    .limit-text {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 12.5px;
      color: var(--text-3);
    }
    .bar {
      height: 6px;
      margin-top: 6px;
      border-radius: 99px;
      background: var(--surface-2);
      overflow: hidden;
      span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: var(--primary);
      }
    }
    .docs {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
      li {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        font-size: 13.5px;
      }
    }
    .doc-icon {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--surface-2);
      color: var(--text-2);
      flex-shrink: 0;
    }
    .doc-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .loading {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    @media (max-width: 1100px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas:
          'actions'
          'side'
          'details';
        grid-template-rows: auto;
      }
      .side {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        align-items: stretch;
      }
    }
    @media (max-width: 640px) {
      .hide-sm {
        display: none;
      }
      th,
      td {
        padding-left: 16px;
        padding-right: 16px;
      }
      .amount {
        align-items: flex-start;
      }
      .type {
        display: none;
      }
      h1 {
        font-size: 20px;
      }
    }
  `,
})
export class ClaimDetail {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly title = inject(Title);
  protected readonly auth = inject(AuthService);
  protected readonly ctx = inject(StaffContext);

  /** From the `:id` route param. */
  readonly id = input.required<string>();

  protected readonly assigning = signal(false);
  protected readonly min = Math.min;

  protected readonly claim = rxResource({
    // The version makes the claim load again after a demo reset.
    params: () => ({ id: this.id(), version: this.ctx.version() }),
    stream: ({ params }) => this.api.claim(params.id),
  });

  protected readonly policy = rxResource({
    params: () => (this.claim.hasValue() ? this.claim.value().policyNumber : undefined),
    stream: ({ params }) => this.api.policy(params),
  });

  protected readonly closed = computed(
    () => this.claim.hasValue() && isFinal(this.claim.value().status),
  );

  protected readonly deductible = computed(() =>
    this.policy.hasValue() ? this.policy.value().deductible : null,
  );

  protected readonly notFound = computed(() => httpStatus(this.claim.error()) === 404);

  /** Why an agent can't take this claim, shown under the assignee. */
  protected readonly assignBlocked = computed(() => {
    const user = this.auth.user();
    if (!user || !this.claim.hasValue()) return null;
    const claim = this.claim.value();
    if (claim.assigneeId === user.id) return null;
    const check = canAssign(claim, user.id, user);
    return check.allowed ? null : check.reason;
  });

  constructor() {
    effect(() => {
      if (this.claim.hasValue())
        this.title.setTitle(`${this.claim.value().number} · Tidewell staff`);
    });
  }

  protected update(claim: Claim): void {
    this.claim.set(claim);
  }

  protected assign(select: HTMLSelectElement): void {
    const assigneeId = select.value;
    if (!assigneeId || !this.claim.hasValue()) return;
    const previous = this.claim.value().assigneeId ?? '';
    this.assigning.set(true);
    this.api.assign(this.claim.value().id, assigneeId).subscribe({
      next: (claim) => {
        this.assigning.set(false);
        this.claim.set(claim);
        this.toast.show('success', `Assigned to ${this.ctx.name(assigneeId)}.`);
      },
      error: () => {
        this.assigning.set(false);
        // Put the select back to the real assignee.
        select.value = previous;
      },
    });
  }

  protected date(iso: string): string {
    return formatDate(iso);
  }

  protected cause(value: string): string {
    return HOME_CAUSES.find((c) => c.value === value)?.label ?? value;
  }

  protected category(value: string): string {
    const all = [...ITEM_CATEGORIES.auto, ...ITEM_CATEGORIES.home];
    return all.find((c) => c.value === value)?.label ?? value;
  }

  protected payout(total: number, deductible: number): number {
    return Math.max(0, total - deductible);
  }

  protected message(err: unknown): string {
    const cause = (err as { cause?: unknown } | null)?.cause;
    return errorMessage(err instanceof HttpErrorResponse ? err : (cause ?? err));
  }
}
