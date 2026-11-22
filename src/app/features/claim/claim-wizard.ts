import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../core/api';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { ClaimFormService } from './claim-form.service';
import { DocumentsStep } from './steps/documents-step';
import { IncidentStep } from './steps/incident-step';
import { ItemsStep } from './steps/items-step';
import { PolicyStep } from './steps/policy-step';
import { ReviewStep } from './steps/review-step';

interface SummaryEntry {
  /** Field errors disappear from the summary once fixed; other messages stay. */
  live: boolean;
  target: string;
  label: string;
  message: string;
}

type Draft = NonNullable<ReturnType<ClaimFormService['readDraft']>>;

@Component({
  selector: 'app-claim-wizard',
  providers: [ClaimFormService],
  imports: [PolicyStep, IncidentStep, ItemsStep, DocumentsStep, ReviewStep, Icon, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <header class="head">
        <h1>File a claim</h1>
        <p>It takes about ten minutes. Fields marked <span class="req">*</span> are required.</p>
      </header>

      @if (draftPrompt(); as d) {
        <div class="alert draft" role="region" aria-label="Saved draft">
          <app-icon name="history" />
          <div class="alert-body">
            <strong>You have an unfinished claim</strong>
            <p>Saved on this device {{ d.savedAt | date: 'MMM d, h:mm a' }}.</p>
          </div>
          <div class="draft-actions">
            <button class="btn btn-ghost" type="button" (click)="discardDraft()">Start over</button>
            <button
              class="btn btn-primary"
              type="button"
              (click)="resumeDraft(d)"
              [disabled]="restoring()"
            >
              @if (restoring()) {
                <span class="spinner"></span>
              }
              Continue
            </button>
          </div>
        </div>
      }

      <nav class="stepper" aria-label="Claim steps">
        <ol>
          @for (s of f.steps; track s.id; let i = $index) {
            <li [class.current]="i === current()" [class.done]="isDone(i)">
              <button
                type="button"
                (click)="goTo(i)"
                [disabled]="i > f.reached() || busy()"
                [attr.aria-current]="i === current() ? 'step' : null"
              >
                <span class="dot" aria-hidden="true">
                  @if (isDone(i)) {
                    <app-icon name="check" [size]="14" [stroke]="3" />
                  } @else {
                    {{ i + 1 }}
                  }
                </span>
                <span class="label">
                  <span class="sr-only">Step {{ i + 1 }}: </span>{{ s.title }}
                  @if (isDone(i)) {
                    <span class="sr-only"> (completed)</span>
                  }
                </span>
              </button>
            </li>
          }
        </ol>
        <div class="progress" aria-hidden="true">
          <span>Step {{ current() + 1 }} of {{ f.steps.length }}</span>
          <div class="track">
            <span [style.width.%]="((current() + 1) / f.steps.length) * 100"></span>
          </div>
        </div>
      </nav>

      <section class="card panel" aria-labelledby="step-title">
        <h2 id="step-title" tabindex="-1" #heading>{{ step().title }}</h2>

        @if (summary().length) {
          <div class="alert danger summary" role="alert" tabindex="-1" #summaryBox>
            <app-icon name="alert" />
            <div class="alert-body">
              <strong>
                {{
                  summary().length === 1
                    ? 'There is 1 problem'
                    : 'There are ' + summary().length + ' problems'
                }}
                to fix
              </strong>
              <ul>
                @for (e of summary(); track e.target + e.message) {
                  <li>
                    <a [href]="'#' + e.target" (click)="focusField($event, e.target)">
                      {{ e.label }}: {{ e.message }}
                    </a>
                  </li>
                }
              </ul>
            </div>
          </div>
        }

        @switch (step().id) {
          @case ('policy') {
            <app-policy-step />
          }
          @case ('incident') {
            <app-incident-step />
          }
          @case ('items') {
            <app-items-step />
          }
          @case ('documents') {
            <app-documents-step />
          }
          @case ('review') {
            <app-review-step (edit)="goTo($event)" />
          }
        }

        <footer class="nav">
          @if (current() > 0) {
            <button class="btn btn-secondary" type="button" (click)="back()" [disabled]="busy()">
              <app-icon name="arrow-left" [size]="16" /> Back
            </button>
          }
          <span class="saved" aria-live="polite">
            @if (f.lastSaved(); as saved) {
              <app-icon name="check" [size]="14" /> Draft saved {{ saved | date: 'h:mm a' }}
            }
          </span>
          <button class="btn btn-primary" type="button" (click)="next()" [disabled]="busy()">
            @if (busy()) {
              <span class="spinner"></span>
            }
            @if (isLast()) {
              {{ submitting() ? 'Sending…' : 'Submit claim' }}
              <app-icon name="send" [size]="16" />
            } @else {
              {{ checking() ? 'Checking…' : 'Continue' }}
              <app-icon name="arrow-right" [size]="16" />
            }
          </button>
        </footer>
      </section>
    </div>
  `,
  styles: `
    .wrap {
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 24px 72px;
    }
    .head {
      margin-bottom: 24px;
      h1 {
        font-size: 30px;
        letter-spacing: -0.02em;
      }
      p {
        margin: 6px 0 0;
        color: var(--text-2);
      }
      .req {
        color: var(--danger);
      }
    }
    .draft {
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 20px;
      border: 1px solid color-mix(in srgb, var(--info), transparent 70%);
    }
    .draft-actions {
      display: flex;
      gap: 8px;
    }
    .stepper {
      margin-bottom: 16px;
      ol {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      li {
        position: relative;
        display: flex;
      }
      button {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 6px 10px;
        border: 0;
        border-bottom: 3px solid var(--border);
        background: none;
        color: var(--text-3);
        font-size: 13px;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
        &:disabled {
          cursor: default;
        }
        &:not(:disabled):hover .label {
          color: var(--text);
        }
      }
      .dot {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--surface-2);
        font-size: 12px;
        font-weight: 600;
      }
      .done button {
        border-color: var(--primary);
        color: var(--text-2);
        .dot {
          background: var(--primary);
          color: var(--primary-contrast);
        }
      }
      .current button {
        border-color: var(--primary);
        color: var(--text);
        .dot {
          background: var(--primary-soft);
          color: var(--primary);
          box-shadow: inset 0 0 0 2px var(--primary);
        }
      }
    }
    .progress {
      display: none;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-2);
      .track {
        height: 6px;
        margin-top: 8px;
        border-radius: 99px;
        background: var(--surface-2);
        overflow: hidden;
        span {
          display: block;
          height: 100%;
          background: var(--primary);
          transition: width 0.25s;
        }
      }
    }
    .panel {
      padding: 28px;
      h2 {
        margin-bottom: 18px;
        font-size: 20px;
        outline: none;
      }
    }
    .summary {
      margin-bottom: 20px;
      outline: none;
      ul {
        margin: 4px 0 0;
        padding-left: 18px;
      }
      a {
        color: var(--danger);
        text-decoration: underline;
      }
    }
    .nav {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
    }
    .saved {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-right: auto;
      font-size: 13px;
      color: var(--text-3);
    }
    .nav .btn-primary {
      min-width: 140px;
    }
    @media (max-width: 760px) {
      .wrap {
        padding: 24px 16px 56px;
      }
      .head h1 {
        font-size: 25px;
      }
      .stepper ol {
        display: none;
      }
      .progress {
        display: block;
      }
      .panel {
        padding: 20px 16px;
      }
      .nav {
        flex-wrap: wrap;
        .saved {
          order: -1;
          width: 100%;
        }
        .btn {
          flex: 1;
        }
      }
    }
  `,
})
export class ClaimWizard {
  protected readonly f = inject(ClaimFormService);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** `?step=2` in the URL (1-based), bound by the router. */
  readonly stepParam = input<string | undefined>(undefined, { alias: 'step' });

  protected readonly current = computed(() => {
    const wanted = Number(this.stepParam() ?? 1) - 1;
    return Number.isInteger(wanted) ? Math.min(Math.max(wanted, 0), this.f.reached()) : 0;
  });
  protected readonly step = computed(() => this.f.steps[this.current()]);
  protected readonly isLast = computed(() => this.current() === this.f.steps.length - 1);

  protected readonly summary = signal<SummaryEntry[]>([]);
  protected readonly draftPrompt = signal<Draft | null>(null);
  protected readonly restoring = signal(false);
  protected readonly checking = signal(false);
  protected readonly submitting = signal(false);
  protected readonly busy = computed(() => this.checking() || this.submitting());

  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly summaryBox = viewChild<ElementRef<HTMLElement>>('summaryBox');
  private submitted = false;

  constructor() {
    const draft = this.f.readDraft();
    if (draft) this.draftPrompt.set(draft);
    else this.f.autosave.set(true);

    // Keep the URL honest: a step the user hasn't reached yet falls back to the furthest one.
    effect(() => {
      const wanted = this.stepParam();
      const actual = this.current() + 1;
      if (wanted !== undefined && Number(wanted) !== actual) {
        untracked(() => this.navigate(actual - 1, true));
      }
    });

    // Drop summary entries as soon as their field is fixed.
    effect(() => {
      this.f.version();
      if (!untracked(this.summary).length) return;
      afterNextRender(
        () =>
          this.summary.update((list) => {
            const next = list.filter((e) => !e.live || this.errorShown(e.target));
            return next.length === list.length ? list : next;
          }),
        { injector: this.injector },
      );
    });

    // Move focus to the step heading on every step change (not on first load).
    let first = true;
    effect(() => {
      this.current();
      if (first) {
        first = false;
        return;
      }
      untracked(() => this.summary.set([]));
      afterNextRender(
        () => {
          this.host.nativeElement.scrollIntoView({ block: 'start' });
          this.heading().nativeElement.focus({ preventScroll: true });
        },
        { injector: this.injector },
      );
    });
  }

  protected isDone(i: number): boolean {
    this.f.version();
    return i < this.f.reached() && i !== this.current() && this.f.steps[i].control.valid;
  }

  protected goTo(i: number): void {
    if (i <= this.f.reached()) this.navigate(i);
  }

  protected back(): void {
    this.goTo(this.current() - 1);
  }

  protected async next(): Promise<void> {
    const index = this.current();
    const step = this.f.steps[index];

    if (step.control.pending) {
      this.checking.set(true);
      await this.f.settled(step.control);
      this.checking.set(false);
    }

    if (step.id === 'documents' && this.f.uploads().some((u) => u.state === 'uploading')) {
      this.summary.set([
        {
          live: false,
          target: 'documents',
          label: 'Uploads',
          message: 'Wait for your files to finish uploading.',
        },
      ]);
      this.focusSummary();
      return;
    }

    if (step.control.invalid) {
      step.control.markAllAsTouched();
      await this.showProblems();
      return;
    }

    this.summary.set([]);
    if (this.isLast()) {
      await this.submit();
      return;
    }
    this.f.reached.update((r) => Math.max(r, index + 1));
    if (this.f.autosave() && this.f.form.dirty) this.f.saveDraft();
    this.navigate(index + 1);
  }

  private async submit(): Promise<void> {
    this.f.form.markAllAsTouched();
    await this.f.settled();
    const invalid = this.f.firstInvalidStep();
    if (invalid !== -1) {
      await this.navigate(invalid);
      await this.showProblems();
      return;
    }

    this.submitting.set(true);
    this.api.submitClaim(this.f.toInput()).subscribe({
      next: (claim) => {
        this.submitted = true;
        this.f.autosave.set(false);
        this.f.clearDraft();
        void this.router.navigate(['/claim/submitted', claim.number], {
          state: {
            claim: {
              number: claim.number,
              lastName: claim.claimant.lastName,
              email: claim.claimant.email,
              total: claim.total,
            },
          },
        });
      },
      // The error interceptor shows a toast; the form stays as it was so nothing is lost.
      error: () => this.submitting.set(false),
    });
  }

  protected async resumeDraft(draft: Draft): Promise<void> {
    this.restoring.set(true);
    await this.f.restore(draft);
    this.restoring.set(false);
    this.draftPrompt.set(null);
    this.f.autosave.set(true);
    this.navigate(this.f.reached());
  }

  protected discardDraft(): void {
    this.f.clearDraft();
    this.draftPrompt.set(null);
    this.f.autosave.set(true);
  }

  /** Used by the route's CanDeactivate guard. */
  async canLeave(): Promise<boolean> {
    if (this.submitted || !this.f.form.dirty) return true;
    if (this.f.autosave()) this.f.saveDraft();
    return this.confirm.ask({
      title: 'Leave your claim?',
      message:
        "Your answers are saved on this device, so you can continue where you left off. The claim isn't sent until you submit it.",
      confirmText: 'Leave',
      cancelText: 'Stay',
    });
  }

  protected focusField(event: Event, id: string): void {
    event.preventDefault();
    const el = this.host.nativeElement.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    el?.focus();
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  private navigate(index: number, replaceUrl = false): Promise<boolean> {
    return this.router.navigate([], {
      queryParams: { step: index + 1 },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  /**
   * Builds the error summary from what is on screen: every visible field error,
   * labelled with its field's label. Keeps labels in one place (the templates).
   */
  private async showProblems(): Promise<void> {
    await this.rendered();
    const root = this.host.nativeElement;
    const entries: SummaryEntry[] = [];
    root.querySelectorAll<HTMLElement>('app-field-error').forEach((p) => {
      const message = p.textContent?.trim();
      if (!message) return;
      const target = p.id.replace(/-error$/, '');
      const field = root.querySelector<HTMLElement>(`#${CSS.escape(target)}`);
      const label =
        field?.dataset['summaryLabel'] ||
        (field && root.querySelector(`label[for="${CSS.escape(target)}"]`)?.textContent) ||
        field?.closest('fieldset')?.querySelector('legend')?.textContent ||
        this.step().title;
      entries.push({
        live: true,
        target: field ? target : p.id,
        label: label.replace(/\*|\(optional\)/g, '').trim(),
        message,
      });
    });
    this.summary.set(entries);
    this.focusSummary();
  }

  private errorShown(target: string): boolean {
    const root = this.host.nativeElement;
    const el =
      root.querySelector(`#${CSS.escape(target)}-error`) ??
      root.querySelector(`#${CSS.escape(target)}`);
    return !!el?.textContent?.trim();
  }

  private focusSummary(): void {
    afterNextRender(() => this.summaryBox()?.nativeElement.focus(), { injector: this.injector });
  }

  private rendered(): Promise<void> {
    return new Promise((resolve) => afterNextRender(() => resolve(), { injector: this.injector }));
  }
}
