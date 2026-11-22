import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ClaimStatus, STATUS_LABELS } from '../../core/models';

const TONES: Record<ClaimStatus, string> = {
  submitted: 'info',
  in_review: 'primary',
  needs_info: 'warning',
  approved: 'success',
  rejected: 'danger',
  paid: 'muted',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"badge " + tone()' },
  template: `<span class="dot" aria-hidden="true"></span>{{ label() }}`,
  styles: `
    :host {
      &.info {
        background: var(--info-soft);
        color: var(--info);
      }
      &.primary {
        background: var(--primary-soft);
        color: var(--primary);
      }
      &.warning {
        background: var(--warning-soft);
        color: var(--warning);
      }
      &.success {
        background: var(--success-soft);
        color: var(--success);
      }
      &.danger {
        background: var(--danger-soft);
        color: var(--danger);
      }
      &.muted {
        background: var(--surface-2);
        color: var(--text-2);
      }
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
  `,
})
export class StatusBadge {
  readonly status = input.required<ClaimStatus>();
  protected readonly tone = computed(() => TONES[this.status()]);
  protected readonly label = computed(() => STATUS_LABELS[this.status()]);
}
