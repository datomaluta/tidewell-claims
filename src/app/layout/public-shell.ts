import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '../core/theme.service';
import { Icon } from '../shared/ui/icon';

@Component({
  selector: 'app-public-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip" href="#main">Skip to content</a>
    <header class="header">
      <div class="inner">
        <a class="brand" routerLink="/" aria-label="Tidewell home">
          <span class="logo"><app-icon name="waves" [size]="18" [stroke]="2.4" /></span>
          Tidewell
        </a>

        <nav aria-label="Main">
          <a routerLink="/claim" routerLinkActive="active" ariaCurrentWhenActive="page">
            File a claim
          </a>
          <a routerLink="/track" routerLinkActive="active" ariaCurrentWhenActive="page">
            Track a claim
          </a>
        </nav>

        <div class="actions">
          <button
            class="btn-icon"
            type="button"
            (click)="theme.toggle()"
            [attr.aria-label]="
              theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            "
          >
            <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" />
          </button>
          <a class="btn btn-secondary staff" routerLink="/staff">
            <app-icon name="lock" [size]="16" />
            <span>Staff portal</span>
          </a>
        </div>
      </div>
    </header>

    <main id="main" tabindex="-1">
      <router-outlet />
    </main>

    <footer class="footer">
      <div class="inner">
        <span
          >Tidewell is a fictional insurer. This is a portfolio demo, no real data is sent.</span
        >
        <span>Claims line: +1 503 555 0100 · Mon–Fri, 8:00–18:00</span>
      </div>
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }
    .skip {
      position: absolute;
      left: 12px;
      top: -48px;
      z-index: 50;
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      background: var(--primary);
      color: var(--primary-contrast);
      &:focus {
        top: 12px;
      }
    }
    .inner {
      display: flex;
      align-items: center;
      gap: 24px;
      max-width: 1120px;
      margin: 0 auto;
      padding: 0 24px;
    }
    .header {
      position: sticky;
      top: 0;
      z-index: 20;
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--surface), transparent 12%);
      backdrop-filter: blur(10px);
      .inner {
        height: 64px;
      }
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text);
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .logo {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 9px;
      background: var(--primary);
      color: var(--primary-contrast);
    }
    nav {
      display: flex;
      gap: 4px;
      a {
        padding: 8px 12px;
        border-radius: var(--radius-sm);
        color: var(--text-2);
        font-weight: 500;
        &:hover {
          background: var(--surface-2);
          color: var(--text);
        }
        &.active {
          color: var(--primary);
          background: var(--primary-soft);
        }
      }
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }
    main {
      flex: 1;
      outline: none;
    }
    .footer {
      border-top: 1px solid var(--border);
      color: var(--text-3);
      font-size: 13px;
      .inner {
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px 24px;
        padding-top: 20px;
        padding-bottom: 24px;
      }
    }
    @media (max-width: 760px) {
      .inner {
        gap: 12px;
        padding: 0 16px;
      }
      .header .inner {
        flex-wrap: wrap;
        height: auto;
        padding-top: 10px;
      }
      nav {
        order: 3;
        width: calc(100% + 32px);
        margin: 0 -16px;
        padding: 0 12px 8px;
        overflow-x: auto;
      }
      .staff span {
        display: none;
      }
      .staff {
        width: 38px;
        padding: 0;
      }
    }
  `,
})
export class PublicShell {
  protected readonly theme = inject(ThemeService);
}
