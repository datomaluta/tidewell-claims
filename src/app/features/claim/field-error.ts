import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Icon } from '../../shared/ui/icon';
import { ClaimFormService } from './claim-form.service';

/**
 * Error message under a field. Give the element an `id` and point the input's
 * `aria-describedby` at it; it only has text while there is an error to show.
 */
@Component({
  selector: 'app-field-error',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="error-text">
      @if (message(); as m) {
        <app-icon name="alert" [size]="14" />
        <span>{{ m }}</span>
      }
    </p>
  `,
  styles: `
    p {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      &:empty {
        display: none;
      }
    }
    app-icon {
      margin-top: 2px;
    }
  `,
})
export class FieldError {
  private readonly f = inject(ClaimFormService);
  readonly path = input.required<string>();
  /** Per-field wording for specific error keys, e.g. `{ minItems: 'Add a photo.' }`. */
  readonly messages = input<Partial<Record<string, string>>>({});

  protected readonly message = computed(() => {
    const text = this.f.error(this.path());
    if (!text) return null;
    const key = Object.keys(this.f.form.get(this.path())?.errors ?? {})[0];
    return this.messages()[key] ?? text;
  });
}
