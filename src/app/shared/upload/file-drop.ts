import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ClaimDocument } from '../../core/models';
import { FILE_RULES } from '../../core/validators';
import { FileSizePipe } from '../ui/file-size.pipe';
import { Icon } from '../ui/icon';
import { FileUploader } from './file-uploader';

/**
 * Drop zone plus the list of uploaded and uploading files. Content placed inside the element
 * (a field error, say) is shown between the drop zone and the list.
 */
@Component({
  selector: 'app-file-drop',
  imports: [Icon, FileSizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      class="drop"
      [class.compact]="compact()"
      [class.over]="dragging()"
      [class.invalid]="invalid()"
      (dragover)="onDragOver($event)"
      (dragleave)="dragging.set(false)"
      (drop)="onDrop($event)"
    >
      <input
        type="file"
        multiple
        [id]="inputId()"
        [accept]="accept"
        (change)="onPick($event)"
        [attr.aria-describedby]="inputId() + '-rules ' + describedBy()"
      />
      <span class="drop-icon"><app-icon name="upload" [size]="compact() ? 18 : 22" /></span>
      <strong>Drag files here or <u>browse</u></strong>
      <span class="hint" [id]="inputId() + '-rules'">
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

    <ng-content />

    @if (documents().length || uploader().uploads().length) {
      <ul class="files" aria-label="Files">
        @for (doc of documents(); track doc.id) {
          <li class="file">
            @if (uploader().previews()[doc.id]; as url) {
              <img [src]="url" alt="" class="thumb" />
            } @else {
              <span class="thumb icon">
                <app-icon [name]="doc.mimeType === 'application/pdf' ? 'file' : 'image'" />
              </span>
            }
            <div class="meta">
              <span class="name">{{ doc.name }}</span>
              <span class="hint">{{ doc.size | fileSize }} · Uploaded</span>
            </div>
            <app-icon name="circle-check" class="ok" />
            <button
              class="btn-icon danger"
              type="button"
              (click)="removed.emit(doc.id)"
              [attr.aria-label]="'Remove ' + doc.name"
            >
              <app-icon name="trash" [size]="17" />
            </button>
          </li>
        }
        @for (u of uploader().uploads(); track u.key) {
          <li class="file" [class.failed]="u.state === 'error'">
            <span class="thumb icon">
              <app-icon [name]="u.state === 'error' ? 'alert' : 'upload'" />
            </span>
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
              <button class="btn btn-secondary sm" type="button" (click)="uploader().retry(u.key)">
                <app-icon name="refresh" [size]="15" /> Retry
              </button>
            } @else {
              <span class="pct">{{ u.progress }}%</span>
            }
            <button
              class="btn-icon danger"
              type="button"
              (click)="uploader().cancel(u.key)"
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
    :host {
      display: block;
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
      &.compact {
        padding: 18px 16px;
      }
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
      .compact & {
        width: 36px;
        height: 36px;
        margin-bottom: 0;
      }
    }
    .alert {
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
export class FileDrop {
  readonly uploader = input.required<FileUploader>();
  readonly documents = input.required<ClaimDocument[]>();
  readonly inputId = input.required<string>();
  /** Extra ids for the input's aria-describedby, e.g. the field error. */
  readonly describedBy = input('');
  readonly invalid = input(false);
  readonly compact = input(false);

  readonly removed = output<string>();
  /** Emits after the user picked or dropped files, so the owner can mark the field touched. */
  readonly picked = output<void>();

  protected readonly dragging = signal(false);
  protected readonly problems = signal<string[]>([]);
  protected readonly accept = FILE_RULES.types.join(',');
  protected readonly maxFiles = FILE_RULES.maxFiles;

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
    this.problems.set(this.uploader().add(files));
    this.picked.emit();
  }
}
