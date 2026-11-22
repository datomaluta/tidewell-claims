import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ClaimDocument } from '../../../core/models';
import { FILE_RULES } from '../../../core/validators';
import { Icon } from '../../../shared/ui/icon';
import { ClaimFormService } from '../claim-form.service';
import { FieldError } from '../field-error';

@Component({
  selector: 'app-documents-step',
  imports: [FieldError, Icon, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="intro">
      Add at least one photo of the damage. Repair quotes, receipts and the police report help the
      agent decide faster.
    </p>

    <label
      class="drop"
      [class.over]="dragging()"
      [class.invalid]="f.invalid('documents')"
      (dragover)="onDragOver($event)"
      (dragleave)="dragging.set(false)"
      (drop)="onDrop($event)"
    >
      <input
        id="documents"
        type="file"
        multiple
        [accept]="accept"
        (change)="onPick($event)"
        aria-describedby="documents-rules documents-error"
      />
      <span class="drop-icon"><app-icon name="upload" [size]="22" /></span>
      <strong>Drag files here or <u>browse</u></strong>
      <span class="hint" id="documents-rules">
        JPG, PNG, WebP or PDF · up to 10 MB each · {{ maxFiles }} files max
      </span>
    </label>

    @if (problems().length) {
      <div class="alert danger" role="alert">
        <app-icon name="alert" />
        <div class="alert-body">
          @for (p of problems(); track $index) {
            <p>{{ p }}</p>
          }
        </div>
        <button class="btn-icon" type="button" (click)="problems.set([])" aria-label="Dismiss">
          <app-icon name="x" [size]="16" />
        </button>
      </div>
    }

    <app-field-error
      path="documents"
      id="documents-error"
      [messages]="{ minItems: 'Add at least one photo or document.' }"
    />

    @if (f.documentCount()) {
      <ul class="files" aria-label="Files">
        @for (doc of documents(); track doc.id) {
          <li class="file">
            @if (f.previews()[doc.id]; as url) {
              <img [src]="url" alt="" class="thumb" />
            } @else {
              <span class="thumb icon">
                <app-icon [name]="doc.mimeType === 'application/pdf' ? 'file' : 'image'" />
              </span>
            }
            <div class="meta">
              <span class="name">{{ doc.name }}</span>
              <span class="hint">{{ doc.size / 1024 / 1024 | number: '1.1-1' }} MB · Uploaded</span>
            </div>
            <app-icon name="circle-check" class="ok" />
            <button
              class="btn-icon danger"
              type="button"
              (click)="f.removeDocument(doc.id)"
              [attr.aria-label]="'Remove ' + doc.name"
            >
              <app-icon name="trash" [size]="17" />
            </button>
          </li>
        }
        @for (u of f.uploads(); track u.key) {
          <li class="file" [class.failed]="u.state === 'error'">
            <span class="thumb icon"
              ><app-icon [name]="u.state === 'error' ? 'alert' : 'upload'"
            /></span>
            <div class="meta">
              <span class="name">{{ u.file.name }}</span>
              @if (u.state === 'uploading') {
                <div
                  class="bar"
                  role="progressbar"
                  [attr.aria-label]="'Uploading ' + u.file.name"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-valuenow]="u.progress"
                >
                  <span [style.width.%]="u.progress"></span>
                </div>
              } @else {
                <span class="error-text">{{ u.error }}</span>
              }
            </div>
            @if (u.state === 'error') {
              <button class="btn btn-secondary sm" type="button" (click)="f.retryUpload(u.key)">
                <app-icon name="refresh" [size]="15" /> Retry
              </button>
            } @else {
              <span class="pct">{{ u.progress }}%</span>
            }
            <button
              class="btn-icon danger"
              type="button"
              (click)="f.cancelUpload(u.key)"
              [attr.aria-label]="
                (u.state === 'error' ? 'Remove ' : 'Cancel upload of ') + u.file.name
              "
            >
              <app-icon name="x" [size]="17" />
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .intro {
      margin: 0 0 18px;
      color: var(--text-2);
      line-height: 1.55;
    }
    .drop {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 32px 16px;
      border: 2px dashed var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      text-align: center;
      cursor: pointer;
      transition:
        border-color 0.15s,
        background 0.15s;
      input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }
      &:hover,
      &.over {
        border-color: var(--primary);
        background: var(--primary-soft);
      }
      &:has(input:focus-visible) {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
      &.invalid {
        border-color: var(--danger);
      }
      u {
        color: var(--primary);
      }
    }
    .drop-icon {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      margin-bottom: 4px;
      border-radius: 50%;
      background: var(--primary-soft);
      color: var(--primary);
    }
    .alert,
    app-field-error {
      display: flex;
      margin-top: 12px;
    }
    .files {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 16px 0 0;
      padding: 0;
      list-style: none;
    }
    .file {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      animation: appear 0.18s ease-out;
      &.failed {
        border-color: color-mix(in srgb, var(--danger), transparent 50%);
      }
    }
    .thumb {
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border-radius: 8px;
      object-fit: cover;
      &.icon {
        display: grid;
        place-items: center;
        background: var(--surface-2);
        color: var(--text-2);
      }
    }
    .failed .thumb.icon {
      background: var(--danger-soft);
      color: var(--danger);
    }
    .meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }
    .ok {
      color: var(--success);
    }
    .pct {
      font-size: 13px;
      color: var(--text-2);
      font-variant-numeric: tabular-nums;
    }
    .bar {
      height: 6px;
      border-radius: 99px;
      background: var(--surface-2);
      overflow: hidden;
      span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: var(--primary);
        transition: width 0.2s;
      }
    }
    .sm {
      height: 32px;
      padding: 0 10px;
      font-size: 13px;
    }
    @keyframes appear {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
  `,
})
export class DocumentsStep {
  protected readonly f = inject(ClaimFormService);
  protected readonly dragging = signal(false);
  protected readonly problems = signal<string[]>([]);
  protected readonly accept = FILE_RULES.types.join(',');
  protected readonly maxFiles = FILE_RULES.maxFiles;
  protected documents(): ClaimDocument[] {
    return this.f.value<ClaimDocument[]>('documents') ?? [];
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.add([...(input.files ?? [])]);
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.add([...(event.dataTransfer?.files ?? [])]);
  }

  private add(files: File[]): void {
    this.problems.set(this.f.addFiles(files));
    this.f.form.controls.documents.markAsTouched();
  }
}
