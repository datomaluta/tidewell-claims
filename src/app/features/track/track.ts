import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../core/api';
import { errorMessage } from '../../core/http/http-error';
import { ClaimStatus, PublicClaim, STATUS_LABELS } from '../../core/models';
import { errorText, showError } from '../../core/validators';
import { Icon } from '../../shared/ui/icon';
import { StatusBadge } from '../../shared/ui/status-badge';

/** The happy path shown as a progress line. Needs info and rejected are shown as side states. */
const PATH: ClaimStatus[] = ['submitted', 'in_review', 'approved', 'paid'];

const STATUS_HELP: Record<ClaimStatus, string> = {
  submitted:
    "We've received your claim. An agent will pick it up soon, usually within one working day.",
  in_review: 'An agent is reviewing your claim. We will contact you if we need anything.',
  needs_info: 'We need a bit more information before we can continue. See the message below.',
  approved: 'Good news: your claim is approved. Payment is on its way within 5 working days.',
  rejected:
    "We're sorry, we can't cover this claim. The reason is below. You can call us to talk it through.",
  paid: 'Your claim has been paid. Thank you for your patience.',
};

@Component({
  selector: 'app-track',
  imports: [ReactiveFormsModule, Icon, StatusBadge, DatePipe, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <header class="head">
        <h1>Track a claim</h1>
        <p>Enter your claim number and the last name you used when you filed it.</p>
      </header>

      <form class="card lookup" [formGroup]="form" (ngSubmit)="search()" novalidate>
        <div class="field">
          <label for="track-number">Claim number</label>
          <input
            id="track-number"
            class="input mono"
            formControlName="number"
            placeholder="TW-2026-01001"
            autocomplete="off"
            [class.invalid]="invalid('number')"
            [attr.aria-invalid]="invalid('number')"
            aria-describedby="track-number-error"
          />
          <p class="error-text" id="track-number-error">{{ error('number') }}</p>
        </div>
        <div class="field">
          <label for="track-lastName">Last name</label>
          <input
            id="track-lastName"
            class="input"
            formControlName="lastName"
            autocomplete="family-name"
            [class.invalid]="invalid('lastName')"
            [attr.aria-invalid]="invalid('lastName')"
            aria-describedby="track-lastName-error"
          />
          <p class="error-text" id="track-lastName-error">{{ error('lastName') }}</p>
        </div>
        <button class="btn btn-primary" type="submit" [disabled]="loading()">
          @if (loading()) {
            <span class="spinner"></span>
          } @else {
            <app-icon name="search" [size]="16" />
          }
          Find claim
        </button>
      </form>

      <div aria-live="polite">
        @if (notFound()) {
          <div class="state card">
            <span class="state-icon"><app-icon name="search" /></span>
            <h3>No claim found</h3>
            <p>{{ notFound() }}</p>
          </div>
        }
        @if (failed()) {
          <div class="state error card">
            <span class="state-icon"><app-icon name="alert" /></span>
            <h3>Something went wrong</h3>
            <p>{{ failed() }}</p>
            <button class="btn btn-secondary" type="button" (click)="search()">
              <app-icon name="refresh" [size]="16" /> Try again
            </button>
          </div>
        }

        @if (claim(); as c) {
          <article class="card result" aria-labelledby="claim-title">
            <header>
              <div>
                <span class="muted">{{ c.type === 'auto' ? 'Auto' : 'Home' }} claim</span>
                <h2 id="claim-title" class="mono">{{ c.number }}</h2>
              </div>
              <app-status-badge [status]="c.status" />
            </header>

            <p class="help">{{ help(c.status) }}</p>

            @if (latestMessage(c); as m) {
              <div
                class="alert"
                [class.warning]="c.status === 'needs_info'"
                [class.danger]="c.status === 'rejected'"
              >
                <app-icon [name]="c.status === 'rejected' ? 'circle-x' : 'message'" />
                <div class="alert-body">
                  <strong>Message from your claims team</strong>
                  <p>{{ m }}</p>
                </div>
              </div>
            }

            <ol class="path" aria-label="Progress">
              @for (s of path; track s; let i = $index) {
                <li [class.done]="reachedIndex(c) >= i" [class.current]="reachedIndex(c) === i">
                  <span class="dot"></span>
                  <span>{{ label(s) }}</span>
                </li>
              }
            </ol>

            <dl class="facts">
              <div>
                <dt>Filed</dt>
                <dd>{{ c.createdAt | date: 'MMM d, y' }}</dd>
              </div>
              <div>
                <dt>Last update</dt>
                <dd>{{ c.updatedAt | date: 'MMM d, y, h:mm a' }}</dd>
              </div>
              <div>
                <dt>Amount claimed</dt>
                <dd>{{ c.total | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
              </div>
            </dl>

            <h3>History</h3>
            <ul class="timeline">
              @for (e of reversed(c); track $index) {
                <li>
                  <app-status-badge [status]="e.status" />
                  <time [attr.datetime]="e.at">{{ e.at | date: 'MMM d, h:mm a' }}</time>
                  @if (e.message) {
                    <p>{{ e.message }}</p>
                  }
                </li>
              }
            </ul>
          </article>
        }
      </div>
    </div>
  `,
  styles: `
    .wrap {
      max-width: 760px;
      margin: 0 auto;
      padding: 40px 24px 72px;
    }
    .head {
      margin-bottom: 20px;
      h1 {
        font-size: 30px;
        letter-spacing: -0.02em;
      }
      p {
        margin: 6px 0 0;
        color: var(--text-2);
      }
    }
    .lookup {
      display: grid;
      grid-template-columns: 1.2fr 1fr auto;
      align-items: start;
      gap: 12px;
      padding: 18px;
      .btn {
        margin-top: 25px;
        height: 40px;
      }
    }
    .error-text:empty {
      display: none;
    }
    .state,
    .result {
      margin-top: 20px;
    }
    .result {
      padding: 24px;
      header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      h2 {
        margin-top: 2px;
        font-size: 22px;
      }
      h3 {
        margin: 24px 0 10px;
        font-size: 15px;
      }
    }
    .help {
      margin: 14px 0;
      color: var(--text-2);
      line-height: 1.55;
    }
    .path {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      margin: 22px 0 0;
      padding: 0;
      list-style: none;
      li {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 13px;
        color: var(--text-3);
        &::before {
          content: '';
          position: absolute;
          top: 6px;
          left: 14px;
          right: 0;
          height: 2px;
          background: var(--border);
        }
        &:last-child::before {
          display: none;
        }
        &.done {
          color: var(--text);
          &::before {
            background: var(--primary);
          }
          .dot {
            background: var(--primary);
            border-color: var(--primary);
          }
        }
        &.current::before {
          background: var(--border);
        }
        &.current .dot {
          box-shadow: 0 0 0 4px var(--primary-soft);
        }
      }
      .dot {
        position: relative;
        width: 14px;
        height: 14px;
        border: 2px solid var(--border);
        border-radius: 50%;
        background: var(--surface);
      }
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 22px 0 0;
      padding: 14px 16px;
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      dt {
        font-size: 12.5px;
        color: var(--text-3);
      }
      dd {
        margin: 2px 0 0;
        font-weight: 500;
      }
    }
    .timeline {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
      li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border);
        &:last-child {
          border-bottom: 0;
        }
      }
      time {
        font-size: 13px;
        color: var(--text-3);
      }
      p {
        width: 100%;
        margin: 0;
        color: var(--text-2);
      }
    }
    @media (max-width: 640px) {
      .wrap {
        padding: 24px 16px 56px;
      }
      .lookup {
        grid-template-columns: 1fr;
        .btn {
          margin-top: 0;
        }
      }
      .path {
        grid-template-columns: 1fr 1fr;
        row-gap: 16px;
        li:nth-child(2)::before {
          display: none;
        }
      }
      .facts {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Track {
  private readonly api = inject(Api);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly path = PATH;
  protected readonly loading = signal(false);
  protected readonly claim = signal<PublicClaim | null>(null);
  protected readonly notFound = signal<string | null>(null);
  protected readonly failed = signal<string | null>(null);

  protected readonly form = this.fb.group({
    number: this.fb.control('', [
      Validators.required,
      Validators.pattern(/^\s*TW-\d{4}-\d{5}\s*$/i),
    ]),
    lastName: this.fb.control('', Validators.required),
  });

  constructor() {
    // Coming from the confirmation page: fill in the form and look the claim up right away.
    const state = history.state as { number?: string; lastName?: string } | null;
    if (state?.number && state.lastName) {
      this.form.setValue({ number: state.number, lastName: state.lastName });
      this.search();
    }
  }

  protected invalid(name: 'number' | 'lastName'): boolean {
    return showError(this.form.controls[name]);
  }

  protected error(name: 'number' | 'lastName'): string {
    const control = this.form.controls[name];
    if (!showError(control)) return '';
    if (control.hasError('pattern')) return 'Claim numbers look like TW-2026-01001.';
    return errorText(control.errors) ?? '';
  }

  protected search(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { number, lastName } = this.form.getRawValue();
    this.loading.set(true);
    this.notFound.set(null);
    this.failed.set(null);
    this.api.track(number, lastName).subscribe({
      next: (claim) => {
        this.claim.set(claim);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.claim.set(null);
        this.loading.set(false);
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.notFound.set(errorMessage(err));
        } else {
          this.failed.set(errorMessage(err));
        }
      },
    });
  }

  protected label(status: ClaimStatus): string {
    return STATUS_LABELS[status];
  }

  protected help(status: ClaimStatus): string {
    return STATUS_HELP[status];
  }

  /** How far along the happy path the claim is. Needs info counts as "in review". */
  protected reachedIndex(claim: PublicClaim): number {
    if (claim.status === 'needs_info' || claim.status === 'rejected') return 1;
    return PATH.indexOf(claim.status);
  }

  protected latestMessage(claim: PublicClaim): string | null {
    if (claim.status !== 'needs_info' && claim.status !== 'rejected') return null;
    return [...claim.timeline].reverse().find((e) => e.status === claim.status)?.message ?? null;
  }

  protected reversed(claim: PublicClaim) {
    return [...claim.timeline].reverse();
  }
}
