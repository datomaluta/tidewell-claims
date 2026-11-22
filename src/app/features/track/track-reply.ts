import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../core/api';
import { ClaimDocument, PublicClaim } from '../../core/models';
import { FileDrop } from '../../shared/upload/file-drop';
import { FileUploader } from '../../shared/upload/file-uploader';
import { Icon } from '../../shared/ui/icon';

/** Lets the claimant answer a request for information, with files, from the tracking page. */
@Component({
  selector: 'app-track-reply',
  imports: [ReactiveFormsModule, FileDrop, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="reply" aria-labelledby="reply-title">
      <h3 id="reply-title">Send what we asked for</h3>
      <p class="lead">
        Answer the message above and add any files that help. Your claim goes straight back to the
        agent.
      </p>

      <form (submit)="$event.preventDefault(); send()" novalidate>
        <div class="field">
          <label for="reply-message">Your reply <span class="req">*</span></label>
          <textarea
            #messageBox
            id="reply-message"
            class="textarea"
            rows="4"
            maxlength="2000"
            [formControl]="message"
            [class.invalid]="messageError()"
            [attr.aria-invalid]="!!messageError()"
            aria-describedby="reply-message-error"
            placeholder="e.g. I've attached the repair estimate from the garage."
          ></textarea>
          <p class="error-text" id="reply-message-error">{{ messageError() }}</p>
        </div>

        <div class="field">
          <span class="label" id="reply-files-label"
            >Files <span class="opt">(optional)</span></span
          >
          <app-file-drop
            inputId="reply-files"
            describedBy="reply-files-label"
            [compact]="true"
            [uploader]="uploader"
            [documents]="documents()"
            (removed)="remove($event)"
          />
        </div>

        @if (waitForUploads()) {
          <p class="error-text" role="alert">
            <app-icon name="clock" [size]="14" /> Wait for the files to finish uploading.
          </p>
        }

        <div class="actions">
          <button class="btn btn-primary" type="submit" [disabled]="sending()">
            @if (sending()) {
              <span class="spinner"></span>
            } @else {
              <app-icon name="send" [size]="16" />
            }
            Send reply
          </button>
        </div>
      </form>
    </section>
  `,
  styles: `
    .reply {
      margin-top: 18px;
      padding: 18px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
    }
    h3 {
      font-size: 15px;
    }
    .lead {
      margin: 4px 0 14px;
      color: var(--text-2);
      line-height: 1.5;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .label {
      display: block;
      margin-bottom: 6px;
      font-size: 13.5px;
      font-weight: 500;
    }
    .textarea {
      background: var(--surface);
    }
    .error-text {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      &:empty {
        display: none;
      }
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    @media (max-width: 480px) {
      .actions .btn {
        width: 100%;
      }
    }
  `,
})
export class TrackReply {
  private readonly api = inject(Api);

  readonly number = input.required<string>();
  readonly lastName = input.required<string>();
  readonly sent = output<PublicClaim>();

  private readonly messageBox = viewChild.required<ElementRef<HTMLTextAreaElement>>('messageBox');

  protected readonly documents = signal<ClaimDocument[]>([]);
  protected readonly sending = signal(false);
  protected readonly tried = signal(false);
  protected readonly waitForUploads = signal(false);
  protected readonly message = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(2000)],
  });

  protected readonly uploader = new FileUploader(this.api, {
    attached: () => this.documents().length,
    done: (doc) => {
      this.documents.update((list) => [...list, doc]);
      this.waitForUploads.set(false);
    },
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.uploader.destroy());
  }

  protected messageError(): string {
    if (!this.tried() || this.message.valid) return '';
    return 'Write a short reply so the agent knows what you sent.';
  }

  protected remove(id: string): void {
    this.documents.update((list) => list.filter((d) => d.id !== id));
    this.uploader.forget(id);
  }

  protected send(): void {
    this.tried.set(true);
    if (this.message.invalid) {
      this.messageBox().nativeElement.focus();
      return;
    }
    if (this.uploader.busy()) {
      this.waitForUploads.set(true);
      return;
    }
    this.sending.set(true);
    this.api
      .reply({
        number: this.number(),
        lastName: this.lastName(),
        message: this.message.value.trim(),
        documents: this.documents(),
      })
      // Failures are shown as a toast by the error interceptor; the form keeps what was typed.
      .subscribe({
        next: (claim) => this.sent.emit(claim),
        error: () => this.sending.set(false),
      });
  }
}
