import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from './icon';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toaster',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class]="t.kind" role="status">
          <app-icon
            [name]="t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'"
          />
          <span>{{ t.text }}</span>
          <button
            class="btn-icon"
            type="button"
            (click)="toasts.dismiss(t.id)"
            aria-label="Dismiss"
          >
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack {
      position: fixed;
      z-index: 100;
      right: 16px;
      bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(380px, calc(100vw - 32px));
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 8px 10px 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-lg);
      font-size: 14px;
      animation: slide-in 0.2s ease-out;
      span {
        flex: 1;
      }
      &.success app-icon {
        color: var(--success);
      }
      &.error app-icon {
        color: var(--danger);
      }
      &.info app-icon {
        color: var(--primary);
      }
      .btn-icon app-icon {
        color: var(--text-3);
      }
    }
    @keyframes slide-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
  `,
})
export class Toaster {
  protected readonly toasts = inject(ToastService);
}
