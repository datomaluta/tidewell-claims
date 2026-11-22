import { Injectable, effect, signal } from '@angular/core';
import { storage } from './storage';

export type Theme = 'light' | 'dark';
const KEY = 'tidewell.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(
    storage.get<Theme | null>(KEY, null) ?? ThemeService.systemTheme(),
  );

  constructor() {
    effect(() => {
      const theme = this.theme();
      document.documentElement.dataset['theme'] = theme;
      storage.set(KEY, theme);
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  private static systemTheme(): Theme {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
