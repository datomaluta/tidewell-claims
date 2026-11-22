import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const HUES = [245, 200, 160, 30, 330, 280, 10, 185];

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--size.px]': 'size()',
    '[style.--hue]': 'hue()',
    '[attr.title]': 'name()',
  },
  template: `{{ initials() }}`,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      font-size: calc(var(--size) * 0.38);
      font-weight: 600;
      letter-spacing: 0.02em;
      color: hsl(var(--hue) 70% 32%);
      background: hsl(var(--hue) 85% 92%);
    }
    :host-context([data-theme='dark']) {
      color: hsl(var(--hue) 90% 80%);
      background: hsl(var(--hue) 45% 22%);
    }
  `,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly size = input(32);

  protected readonly initials = computed(() =>
    this.name()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join(''),
  );

  protected readonly hue = computed(() => {
    let hash = 0;
    for (const ch of this.name()) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    return HUES[Math.abs(hash) % HUES.length];
  });
}
