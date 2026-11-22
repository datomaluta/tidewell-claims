import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../core/api';
import { Claim, ClaimEvent, STATUS_LABELS } from '../../core/models';
import { requiresNote } from '../../core/workflow';
import { Avatar } from '../../shared/ui/avatar';
import { Icon, IconName } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast.service';

interface Row {
  event: ClaimEvent;
  icon: IconName;
  text: string;
  /** Status messages to the claimant vs internal notes, styled differently. */
  noteKind: 'claimant' | 'internal' | 'reply' | null;
}

/** Internal notes form plus the full claim history, newest first. */
@Component({
  selector: 'app-claim-timeline',
  imports: [ReactiveFormsModule, DatePipe, Icon, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="history-title">
      <header class="card-header">
        <h2 id="history-title">Notes and history</h2>
        <span class="muted">{{ rows().length }} events</span>
      </header>

      <form class="note-form" (submit)="$event.preventDefault(); add()" novalidate>
        <label class="sr-only" for="internal-note">Internal note</label>
        <textarea
          id="internal-note"
          class="textarea"
          rows="2"
          placeholder="Add an internal note for the team…"
          [formControl]="note"
          [attr.aria-invalid]="showError()"
          aria-describedby="internal-note-hint"
          (keydown.control.enter)="add()"
          (keydown.meta.enter)="add()"
        ></textarea>
        <div class="note-foot">
          <span class="hint" id="internal-note-hint">
            <app-icon name="lock" [size]="13" />
            @if (showError()) {
              <span class="error-text">Write something first.</span>
            } @else {
              Only staff can see notes.
            }
          </span>
          <button class="btn btn-secondary" type="submit" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner"></span>
            }
            Add note
          </button>
        </div>
      </form>

      <ol class="timeline">
        @for (r of rows(); track r.event.id) {
          <li [class]="r.event.kind">
            <span class="marker"><app-icon [name]="r.icon" [size]="14" /></span>
            <div class="body">
              <p class="line">
                <strong>{{ r.event.actorName }}</strong> {{ r.text }}
              </p>
              @if (r.event.note && r.noteKind) {
                <blockquote [class]="r.noteKind">
                  @if (r.noteKind === 'claimant') {
                    <span class="label">Message to claimant</span>
                  } @else if (r.noteKind === 'reply') {
                    <span class="label">Reply from claimant</span>
                  }
                  {{ r.event.note }}
                </blockquote>
              }
              @if (r.event.documents?.length) {
                <ul class="attached" aria-label="Files sent with the reply">
                  @for (d of r.event.documents; track d.id) {
                    <li>
                      <app-icon
                        [name]="d.mimeType.startsWith('image/') ? 'image' : 'file'"
                        [size]="13"
                      />
                      {{ d.name }}
                    </li>
                  }
                </ul>
              }
              <time [attr.datetime]="r.event.at">{{ r.event.at | date: 'MMM d, y, h:mm a' }}</time>
            </div>
            @if (r.event.kind === 'note') {
              <app-avatar class="who" [name]="r.event.actorName" [size]="26" />
            }
          </li>
        }
      </ol>
    </section>
  `,
  styles: `
    .note-form {
      padding: 16px 20px 4px;
      .textarea {
        min-height: 64px;
      }
    }
    .note-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 8px;
      .hint {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0;
      }
      .error-text {
        margin: 0;
      }
    }
    .timeline {
      margin: 0;
      padding: 12px 20px 20px;
      list-style: none;
      li {
        position: relative;
        display: flex;
        gap: 12px;
        padding: 10px 0;
        &:not(:last-child)::before {
          content: '';
          position: absolute;
          left: 13px;
          top: 38px;
          bottom: -10px;
          width: 2px;
          background: var(--border);
        }
      }
    }
    .marker {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--surface-2);
      color: var(--text-2);
      .status & {
        background: var(--primary-soft);
        color: var(--primary);
      }
      .note & {
        background: var(--warning-soft);
        color: var(--warning);
      }
    }
    .body {
      flex: 1;
      min-width: 0;
    }
    .line {
      margin: 4px 0 0;
      color: var(--text-2);
      strong {
        color: var(--text);
        font-weight: 600;
      }
    }
    blockquote {
      margin: 8px 0 0;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      white-space: pre-line;
      overflow-wrap: anywhere;
      &.claimant {
        background: var(--info-soft);
      }
      &.reply {
        background: var(--success-soft);
        .label {
          color: var(--success);
        }
      }
      .label {
        display: block;
        margin-bottom: 2px;
        font-size: 12px;
        font-weight: 600;
        color: var(--info);
      }
    }
    .attached {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
      li {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        max-width: 100%;
        padding: 3px 9px;
        border: 1px solid var(--border);
        border-radius: 99px;
        font-size: 12.5px;
        color: var(--text-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    .reply .marker {
      background: var(--success-soft);
      color: var(--success);
    }
    time {
      display: block;
      margin-top: 4px;
      font-size: 12.5px;
      color: var(--text-3);
    }
    .who {
      margin-top: 2px;
    }
  `,
})
export class ClaimTimeline {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  readonly claim = input.required<Claim>();
  readonly changed = output<Claim>();

  protected readonly saving = signal(false);
  protected readonly tried = signal(false);
  protected readonly note = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/)],
  });

  protected readonly rows = computed<Row[]>(() =>
    [...this.claim().events].reverse().map((event) => {
      switch (event.kind) {
        case 'submitted':
          return { event, icon: 'send', text: 'submitted the claim', noteKind: null };
        case 'assigned':
          return {
            event,
            icon: 'user-check',
            text: `assigned it to ${event.note}`,
            noteKind: null,
          };
        case 'note':
          return { event, icon: 'message', text: 'added a note', noteKind: 'internal' };
        case 'reply':
          return {
            event,
            icon: 'send',
            text: 'replied, so the claim is back in review',
            noteKind: 'reply',
          };
        case 'status': {
          const to = event.to!;
          return {
            event,
            icon: to === 'rejected' ? 'circle-x' : to === 'needs_info' ? 'message' : 'circle-check',
            text: `moved it from ${STATUS_LABELS[event.from!]} to ${STATUS_LABELS[to]}`,
            noteKind: requiresNote(to) ? 'claimant' : 'internal',
          };
        }
      }
    }),
  );

  protected showError(): boolean {
    return this.tried() && this.note.invalid;
  }

  protected add(): void {
    this.tried.set(true);
    if (this.note.invalid || this.saving()) return;
    this.saving.set(true);
    this.api.addNote(this.claim().id, this.note.value.trim()).subscribe({
      next: (claim) => {
        this.saving.set(false);
        this.tried.set(false);
        this.note.reset();
        this.changed.emit(claim);
        this.toast.show('success', 'Note added.');
      },
      error: () => this.saving.set(false),
    });
  }
}
