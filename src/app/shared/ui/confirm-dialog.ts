import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'pending() && confirm.close(false)' },
  template: `
    @if (pending(); as p) {
      <div class="backdrop" (click)="confirm.close(false)"></div>
      <div class="dialog card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{{ p.title }}</h2>
        <p>{{ p.message }}</p>
        <div class="actions">
          <button class="btn btn-ghost" type="button" (click)="confirm.close(false)">
            {{ p.cancelText ?? 'Cancel' }}
          </button>
          <button
            #ok
            class="btn"
            [class.btn-danger]="p.danger"
            [class.btn-primary]="!p.danger"
            type="button"
            (click)="confirm.close(true)"
          >
            {{ p.confirmText ?? 'Confirm' }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 90;
      background: rgb(8 12 24 / 0.45);
      backdrop-filter: blur(2px);
      animation: fade 0.15s;
    }
    .dialog {
      position: fixed;
      z-index: 91;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: min(420px, calc(100vw - 32px));
      padding: 24px;
      box-shadow: var(--shadow-lg);
      animation: pop 0.15s ease-out;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 18px;
    }
    p {
      margin: 0 0 24px;
      color: var(--text-2);
      line-height: 1.5;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    @keyframes pop {
      from {
        opacity: 0;
        transform: translate(-50%, -48%) scale(0.97);
      }
    }
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
  protected readonly pending = this.confirm.pending;
  private readonly okButton = viewChild<ElementRef<HTMLButtonElement>>('ok');

  constructor() {
    effect(() => this.okButton()?.nativeElement.focus());
  }
}
