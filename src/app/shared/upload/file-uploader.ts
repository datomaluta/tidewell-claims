import { HttpEventType } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { Api } from '../../core/api';
import { errorMessage } from '../../core/http/http-error';
import { ClaimDocument } from '../../core/models';
import { FILE_RULES, checkFile } from '../../core/validators';

export interface Upload {
  key: string;
  file: File;
  progress: number;
  state: 'uploading' | 'error';
  error?: string;
  sub?: Subscription;
}

export interface UploaderOptions {
  /** How many documents are already attached, so the file limit counts them too. */
  attached: () => number;
  /** Called when a file has finished uploading. The owner decides where the document lives. */
  done: (doc: ClaimDocument) => void;
}

/**
 * Upload queue shared by the claim form and the claimant's reply: checks files up front, tracks
 * progress per file, supports retry and cancel, and keeps image previews for this session.
 */
export class FileUploader {
  readonly uploads = signal<Upload[]>([]);
  /** Object URLs for image previews, by document id. */
  readonly previews = signal<Record<string, string>>({});
  readonly busy = computed(() => this.uploads().some((u) => u.state === 'uploading'));

  constructor(
    private readonly api: Api,
    private readonly options: UploaderOptions,
  ) {}

  /** Validates and uploads files. Returns messages for files that were refused up front. */
  add(files: File[]): string[] {
    const problems: string[] = [];
    for (const file of files) {
      if (this.options.attached() + this.uploads().length >= FILE_RULES.maxFiles) {
        problems.push(`You can add up to ${FILE_RULES.maxFiles} files.`);
        break;
      }
      const problem = checkFile(file);
      if (problem) {
        problems.push(problem);
        continue;
      }
      const upload: Upload = { key: crypto.randomUUID(), file, progress: 0, state: 'uploading' };
      this.uploads.update((list) => [...list, upload]);
      this.start(upload);
    }
    return problems;
  }

  retry(key: string): void {
    const upload = this.uploads().find((u) => u.key === key);
    if (upload) this.start(upload);
  }

  cancel(key: string): void {
    this.uploads()
      .find((u) => u.key === key)
      ?.sub?.unsubscribe();
    this.uploads.update((list) => list.filter((u) => u.key !== key));
  }

  /** Frees the preview of a document that was removed. */
  forget(id: string): void {
    const url = this.previews()[id];
    if (!url) return;
    URL.revokeObjectURL(url);
    this.previews.update(({ [id]: _, ...rest }) => rest);
  }

  /** Stops running uploads and frees previews. Call when the owner is destroyed. */
  destroy(): void {
    this.uploads().forEach((u) => u.sub?.unsubscribe());
    Object.values(this.previews()).forEach((url) => URL.revokeObjectURL(url));
  }

  private start(upload: Upload): void {
    this.patch(upload.key, { state: 'uploading', progress: 0, error: undefined });
    const sub = this.api.upload(upload.file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.patch(upload.key, { progress: Math.round((event.loaded / event.total) * 100) });
        }
        if (event.type === HttpEventType.Response && event.body) {
          const doc = event.body;
          if (upload.file.type.startsWith('image/')) {
            this.previews.update((p) => ({ ...p, [doc.id]: URL.createObjectURL(upload.file) }));
          }
          this.uploads.update((list) => list.filter((u) => u.key !== upload.key));
          this.options.done(doc);
        }
      },
      error: (err: unknown) => this.patch(upload.key, { state: 'error', error: errorMessage(err) }),
    });
    this.patch(upload.key, { sub });
  }

  private patch(key: string, patch: Partial<Upload>): void {
    this.uploads.update((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  }
}
