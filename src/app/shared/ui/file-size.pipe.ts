import { Pipe, PipeTransform } from '@angular/core';

/** 1536 → "2 KB", 2_400_000 → "2.3 MB". */
@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
