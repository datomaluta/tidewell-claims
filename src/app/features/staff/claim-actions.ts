import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  Injector,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../core/api';
import { AuthService } from '../../core/auth';
import { Claim, ClaimStatus, STATUS_LABELS } from '../../core/models';
import { money } from '../../core/validators';
import { TransitionOption, canAssign, isFinal, transitionOptions } from '../../core/workflow';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast.service';

const GUIDANCE: Record<ClaimStatus, string> = {
  submitted: 'New claim. Start the review so the claimant can see someone is on it.',
  in_review:
    'Check the incident, the items and the documents, then approve, reject or ask the claimant for more.',
  needs_info: 'Waiting for the claimant. Move the claim back to review once they reply.',
  approved: 'Approved. Mark the claim as paid once the money has gone out.',
  rejected: 'This claim is closed. It was rejected.',
  paid: 'This claim is closed. It has been paid.',
};

const DONE: Record<ClaimStatus, string> = {
  submitted: 'Claim submitted.',
  in_review: 'Review started.',
  needs_info: 'Request sent. The claimant sees it on the tracking page.',
  approved: 'Claim approved.',
  rejected: 'Claim rejected. The claimant sees your message.',
  paid: 'Claim marked as paid.',
};

/** The "Next step" panel: workflow buttons, the reasons some are off, and the claimant message form. */
@Component({
  selector: 'app-claim-actions',
  imports: [ReactiveFormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card panel" aria-labelledby="actions-title">
      <h2 id="actions-title">Next step</h2>
      <p class="guide">{{ guidance() }}</p>

      @if (!closed()) {
        @if (canPickUp()) {
          <div class="alert info pick">
            <app-icon name="user-check" />
            <div class="alert-body">
              @if (claim().assigneeId) {
                This claim is assigned to someone else.
              } @else {
                Nobody has picked this claim up yet.
              }
            </div>
            <button
              class="btn btn-secondary"
              type="button"
              (click)="assignToMe()"
              [disabled]="busy()"
            >
              Assign to me
            </button>
          </div>
        }

        <div class="buttons">
          @for (o of options(); track o.to) {
            <button
              type="button"
              class="btn"
              [class.btn-primary]="o.to === primary()"
              [class.btn-secondary]="o.to !== primary() && o.to !== 'rejected'"
              [class.btn-danger-soft]="o.to === 'rejected'"
              [class.selected]="composing()?.to === o.to"
              [disabled]="!o.check.allowed || busy()"
              [attr.aria-describedby]="describedBy(o.to)"
              [attr.aria-expanded]="o.requiresNote ? composing()?.to === o.to : null"
              (click)="start(o)"
            >
              @if (!o.check.allowed) {
                <app-icon name="lock" [size]="14" />
              }
              {{ o.label }}
            </button>
          }
        </div>

        @if (blocked().length) {
          <ul class="why">
            @for (b of blocked(); track b.reason) {
              <li>
                <app-icon name="info" [size]="15" />
                <span [id]="b.id">
                  <strong>{{ b.labels }}:</strong> {{ b.reason }}
                </span>
              </li>
            }
          </ul>
        }

        @if (composing(); as o) {
          <form class="compose" (submit)="$event.preventDefault(); sendWithNote(o)" novalidate>
            <div class="field">
              <label for="claimant-message">
                {{
                  o.to === 'rejected'
                    ? 'Reason for the claimant'
                    : 'What do you need from the claimant?'
                }}
              </label>
              <textarea
                #messageBox
                id="claimant-message"
                class="textarea"
                rows="4"
                [formControl]="note"
                [class.invalid]="noteError()"
                [attr.aria-invalid]="!!noteError()"
                aria-describedby="claimant-message-hint claimant-message-error"
                [placeholder]="
                  o.to === 'rejected'
                    ? 'e.g. The damage happened before the policy started.'
                    : 'e.g. Please send the repair shop estimate.'
                "
              ></textarea>
              <p class="hint" id="claimant-message-hint">
                <app-icon name="message" [size]="14" /> The claimant sees this message when they
                track their claim.
              </p>
              <p class="error-text" id="claimant-message-error">{{ noteError() }}</p>
            </div>
            <div class="compose-actions">
              <button type="button" class="btn btn-ghost" (click)="cancel()">Cancel</button>
              <button
                type="submit"
                class="btn"
                [class.btn-primary]="o.to !== 'rejected'"
                [class.btn-danger]="o.to === 'rejected'"
                [disabled]="busy()"
              >
                @if (busy()) {
                  <span class="spinner"></span>
                }
                {{ o.to === 'rejected' ? 'Reject claim' : 'Send request' }}
              </button>
            </div>
          </form>
        }
      }
    </section>
  `,
  styles: `
    .panel {
      padding: 20px;
    }
    h2 {
      font-size: 16px;
    }
    .guide {
      margin: 6px 0 16px;
      color: var(--text-2);
      line-height: 1.5;
    }
    .pick {
      align-items: center;
      margin-bottom: 16px;
      .alert-body {
        flex: 1;
      }
      .btn {
        flex-shrink: 0;
      }
    }
    .buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .btn-danger-soft {
      border: 1px solid color-mix(in srgb, var(--danger), transparent 60%);
      background: var(--surface);
      color: var(--danger);
      &:hover:not(:disabled) {
        background: var(--danger-soft);
      }
    }
    .btn.selected {
      box-shadow: 0 0 0 3px var(--primary-soft);
    }
    .btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .why {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 14px 0 0;
      padding: 0;
      list-style: none;
      font-size: 13px;
      color: var(--text-2);
      li {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      app-icon {
        margin-top: 2px;
        color: var(--text-3);
        flex-shrink: 0;
      }
      strong {
        color: var(--text);
        font-weight: 600;
      }
    }
    .compose {
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      .hint {
        display: flex;
        align-items: center;
        gap: 6px;
      }
    }
    .error-text:empty {
      display: none;
    }
    .compose-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
    }
    @media (max-width: 520px) {
      .pick {
        flex-wrap: wrap;
      }
      .buttons .btn {
        flex: 1 1 auto;
      }
    }
  `,
})
export class ClaimActions {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  readonly claim = input.required<Claim>();
  readonly deductible = input<number | null>(null);
  readonly changed = output<Claim>();

  private readonly messageBox = viewChild<ElementRef<HTMLTextAreaElement>>('messageBox');

  protected readonly busy = signal(false);
  protected readonly composing = signal<TransitionOption | null>(null);
  protected readonly submitted = signal(false);
  protected readonly note = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(1000)],
  });

  private readonly user = computed(() => this.auth.user());
  protected readonly closed = computed(() => isFinal(this.claim().status));
  protected readonly guidance = computed(() => GUIDANCE[this.claim().status]);
  protected readonly options = computed(() => {
    const user = this.user();
    return user ? transitionOptions(this.claim(), user) : [];
  });

  /** The suggested action gets the primary style: the first one this user is allowed to take. */
  protected readonly primary = computed(
    () => this.options().find((o) => o.check.allowed && o.to !== 'rejected')?.to ?? null,
  );

  /** Disabled actions grouped by reason, so "Assign this claim to yourself first" shows once. */
  protected readonly blocked = computed(() => {
    const groups = new Map<string, TransitionOption[]>();
    for (const o of this.options()) {
      if (!o.check.allowed) groups.set(o.check.reason, [...(groups.get(o.check.reason) ?? []), o]);
    }
    return [...groups].map(([reason, list], i) => ({
      id: 'why-' + i,
      reason,
      labels: list.map((o) => o.label).join(', '),
      statuses: list.map((o) => o.to),
    }));
  });

  protected describedBy(to: ClaimStatus): string | null {
    return this.blocked().find((b) => b.statuses.includes(to))?.id ?? null;
  }

  protected readonly canPickUp = computed(() => {
    const user = this.user();
    const claim = this.claim();
    return (
      !!user &&
      user.role === 'agent' &&
      claim.assigneeId !== user.id &&
      canAssign(claim, user.id, user).allowed
    );
  });

  protected noteError(): string {
    if (!this.submitted() && !this.note.touched) return '';
    if (this.note.hasError('maxlength')) return 'Keep the message under 1000 characters.';
    if (this.note.invalid) return 'Write a message for the claimant.';
    return '';
  }

  protected async start(option: TransitionOption): Promise<void> {
    if (option.requiresNote) {
      this.composing.set(option);
      this.submitted.set(false);
      this.note.reset();
      afterNextRender(() => this.messageBox()?.nativeElement.focus(), { injector: this.injector });
      return;
    }
    this.composing.set(null);
    const claim = this.claim();
    if (option.to === 'approved') {
      const deductible = this.deductible() ?? 0;
      const ok = await this.confirm.ask({
        title: `Approve ${claim.number}?`,
        message: `The claimant asked for ${money(claim.total)}. After the ${money(deductible)} deductible the payout is ${money(Math.max(0, claim.total - deductible))}.`,
        confirmText: 'Approve claim',
      });
      if (!ok) return;
    }
    if (option.to === 'paid') {
      const ok = await this.confirm.ask({
        title: 'Mark this claim as paid?',
        message: 'This closes the claim. It cannot be reopened.',
        confirmText: 'Mark as paid',
      });
      if (!ok) return;
    }
    this.run(option.to);
  }

  protected sendWithNote(option: TransitionOption): void {
    this.submitted.set(true);
    if (this.note.invalid) {
      this.messageBox()?.nativeElement.focus();
      return;
    }
    this.run(option.to, this.note.value.trim());
  }

  protected cancel(): void {
    this.composing.set(null);
    this.note.reset();
  }

  protected assignToMe(): void {
    this.busy.set(true);
    const user = this.user();
    if (!user) return;
    this.api.assign(this.claim().id, user.id).subscribe({
      next: (claim) => {
        this.busy.set(false);
        this.changed.emit(claim);
        this.toast.show('success', 'The claim is now assigned to you.');
      },
      error: () => this.busy.set(false),
    });
  }

  private run(to: ClaimStatus, note?: string): void {
    this.busy.set(true);
    this.api.transition(this.claim().id, to, note).subscribe({
      next: (claim) => {
        this.busy.set(false);
        this.composing.set(null);
        this.note.reset();
        this.changed.emit(claim);
        this.toast.show('success', DONE[to] ?? `Moved to ${STATUS_LABELS[to]}.`);
      },
      // The error interceptor shows the server's reason as a toast.
      error: () => this.busy.set(false),
    });
  }
}
