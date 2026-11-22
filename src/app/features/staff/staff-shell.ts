import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Api } from '../../core/api';
import { AuthService } from '../../core/auth';
import { ThemeService } from '../../core/theme.service';
import { Avatar } from '../../shared/ui/avatar';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { Icon, IconName } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast.service';
import { StaffContext } from './staff-context';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

@Component({
  selector: 'app-staff-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <a class="skip" href="#staff-main">Skip to content</a>

    <aside class="sidebar" [class.open]="menuOpen()" aria-label="Staff navigation">
      <a class="brand" routerLink="/staff/claims">
        <span class="logo"><app-icon name="waves" [size]="18" [stroke]="2.4" /></span>
        Tidewell
        <span class="tag">Staff</span>
      </a>

      <nav aria-label="Staff">
        <span class="nav-label">Claims desk</span>
        @for (item of nav; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="active"
            #rla="routerLinkActive"
            [attr.aria-current]="rla.isActive ? 'page' : null"
          >
            <app-icon [name]="item.icon" />
            {{ item.label }}
          </a>
        }

        <span class="nav-label">Demo</span>
        <a routerLink="/claim">
          <app-icon name="external-link" />
          File a test claim
        </a>
        <button type="button" (click)="resetDemo()" [disabled]="resetting()">
          <app-icon name="refresh" />
          Reset demo data
        </button>
      </nav>

      @if (auth.user(); as user) {
        <div class="profile">
          <app-avatar [name]="user.name" [size]="36" />
          <div class="who">
            <strong>{{ user.name }}</strong>
            <span>{{ user.title }}</span>
          </div>
          <button
            class="btn-icon"
            type="button"
            (click)="auth.signOut()"
            aria-label="Sign out"
            title="Sign out"
          >
            <app-icon name="logout" />
          </button>
        </div>
      }
    </aside>

    @if (menuOpen()) {
      <div class="scrim" (click)="menuOpen.set(false)"></div>
    }

    <div class="main">
      <header class="topbar">
        <button
          class="btn-icon menu"
          type="button"
          (click)="menuOpen.set(true)"
          aria-label="Open menu"
        >
          <app-icon name="menu" />
        </button>

        <a class="mobile-brand" routerLink="/staff/claims" aria-label="Tidewell staff home">
          <span class="logo"><app-icon name="waves" [size]="16" [stroke]="2.4" /></span>
          Tidewell
        </a>
        <div class="spacer"></div>

        @if (auth.user(); as user) {
          <span class="role" [class.manager]="user.role === 'manager'">
            <app-icon [name]="user.role === 'manager' ? 'shield' : 'user'" [size]="14" />
            {{ user.role === 'manager' ? 'Manager' : 'Agent' }} view
          </span>
        }
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
      </header>

      <main id="staff-main" tabindex="-1">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }
    .skip {
      position: absolute;
      left: 12px;
      top: -48px;
      z-index: 60;
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      background: var(--primary);
      color: var(--primary-contrast);
      &:focus {
        top: 12px;
      }
    }
    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      z-index: 30;
      width: var(--sidebar-w);
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 18px 14px;
      background: var(--surface);
      border-right: 1px solid var(--border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 8px 18px;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--text);
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
    .tag {
      padding: 2px 8px;
      border-radius: 99px;
      background: var(--primary-soft);
      color: var(--primary);
      font-size: 11.5px;
      font-weight: 600;
    }
    nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      overflow-y: auto;
    }
    .nav-label {
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-3);
      &:not(:first-child) {
        margin-top: 14px;
      }
    }
    nav a,
    nav button {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 40px;
      padding: 0 12px;
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--text-2);
      font: inherit;
      font-weight: 500;
      text-align: left;
      cursor: pointer;
      transition:
        background 0.15s,
        color 0.15s;
      &:hover:not(:disabled) {
        background: var(--surface-2);
        color: var(--text);
      }
      &.active {
        background: var(--primary-soft);
        color: var(--primary);
      }
      &:disabled {
        opacity: 0.6;
        cursor: progress;
      }
    }
    .profile {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 8px 4px;
      border-top: 1px solid var(--border);
      .who {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      strong {
        font-size: 13.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      span {
        font-size: 12px;
        color: var(--text-3);
      }
    }
    .main {
      margin-left: var(--sidebar-w);
      min-width: 0;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 8px;
      height: var(--topbar-h);
      padding: 0 24px;
      background: color-mix(in srgb, var(--bg) 82%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
    }
    .spacer {
      flex: 1;
    }
    .role {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 28px;
      padding: 0 10px;
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--text-2);
      font-size: 12.5px;
      font-weight: 500;
      white-space: nowrap;
      &.manager {
        background: var(--primary-soft);
        color: var(--primary);
      }
    }
    main {
      outline: none;
    }
    .mobile-brand {
      display: none;
      align-items: center;
      gap: 8px;
      color: var(--text);
      font-weight: 700;
      .logo {
        width: 28px;
        height: 28px;
        border-radius: 8px;
      }
    }
    .menu,
    .scrim {
      display: none;
    }
    @media (max-width: 960px) {
      .sidebar {
        transform: translateX(-100%);
        visibility: hidden;
        transition:
          transform 0.22s ease,
          visibility 0s 0.22s;
        box-shadow: var(--shadow-lg);
      }
      .sidebar.open {
        transform: none;
        visibility: visible;
        transition: transform 0.22s ease;
      }
      .scrim {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 25;
        background: rgb(4 17 15 / 0.45);
      }
      .main {
        margin-left: 0;
      }
      .menu {
        display: inline-grid;
      }
      .mobile-brand {
        display: flex;
      }
      .topbar {
        padding: 0 16px;
      }
    }
    @media (max-width: 560px) {
      .role {
        display: none;
      }
    }
  `,
})
export class StaffShell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly api = inject(Api);
  private readonly ctx = inject(StaffContext);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);
  protected readonly resetting = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '/staff/claims', label: 'Claims queue', icon: 'inbox' },
    { path: '/staff/activity', label: 'Activity log', icon: 'activity' },
  ];

  constructor() {
    this.ctx.load();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected async resetDemo(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Reset the demo data?',
      message:
        'This puts all claims and the activity log back to how they started. Claims you filed or changed will be gone.',
      confirmText: 'Reset data',
      danger: true,
    });
    if (!ok) return;
    this.resetting.set(true);
    this.api.resetDemo().subscribe({
      next: () => {
        this.resetting.set(false);
        this.ctx.version.update((v) => v + 1);
        this.toast.show('success', 'Demo data is back to the start.');
        void this.router.navigateByUrl('/staff/claims');
      },
      error: () => this.resetting.set(false),
    });
  }

  /** "/" focuses the page search, Escape closes the mobile menu. */
  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const typing =
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
    if (event.key === '/' && !typing) {
      event.preventDefault();
      document.querySelector<HTMLInputElement>('main input[type=search]')?.focus();
    }
    if (event.key === 'Escape') this.menuOpen.set(false);
  }
}
