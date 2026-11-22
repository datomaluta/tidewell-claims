import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { errorMessage } from '../../core/http/http-error';
import { Role } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';

interface DemoAccount {
  id: string;
  name: string;
  title: string;
  role: Role;
  can: string;
}

/** A real portal would have SSO here. The demo signs in as one of three seeded staff members. */
const ACCOUNTS: DemoAccount[] = [
  {
    id: 'u-maya',
    name: 'Maya Collins',
    title: 'Claims agent',
    role: 'agent',
    can: 'Reviews her own claims, asks claimants for more info and approves up to $5,000.',
  },
  {
    id: 'u-leo',
    name: 'Leo Hartmann',
    title: 'Claims agent',
    role: 'agent',
    can: 'Same rights as Maya. Use him to see how claims are split between agents.',
  },
  {
    id: 'u-grace',
    name: 'Grace Okafor',
    title: 'Claims manager',
    role: 'manager',
    can: 'Assigns claims to anyone, approves any amount, rejects claims and marks them paid.',
  },
];

@Component({
  selector: 'app-sign-in',
  imports: [RouterLink, Icon, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="top">
      <a class="brand" routerLink="/">
        <span class="logo"><app-icon name="waves" [size]="18" [stroke]="2.4" /></span>
        Tidewell
      </a>
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
    </div>

    <main class="wrap">
      <div class="card panel">
        <span class="tag"><app-icon name="lock" [size]="14" /> Staff portal</span>
        <h1>Sign in to review claims</h1>
        <p class="lead">
          This is a demo, so there are no passwords. Pick a team member to see the portal with their
          permissions.
        </p>

        @if (expired()) {
          <div class="alert warning" role="status">
            <app-icon name="clock" />
            <div class="alert-body">Your session ended. Sign in again to carry on.</div>
          </div>
        }
        @if (error(); as e) {
          <div class="alert danger" role="alert">
            <app-icon name="alert" />
            <div class="alert-body">{{ e }}</div>
          </div>
        }

        <ul class="accounts" aria-label="Demo accounts">
          @for (a of accounts; track a.id) {
            <li>
              <button type="button" [disabled]="busy() !== null" (click)="signIn(a)">
                <app-avatar [name]="a.name" [size]="42" />
                <span class="who">
                  <strong>{{ a.name }}</strong>
                  <span class="role" [class.manager]="a.role === 'manager'">{{ a.title }}</span>
                  <span class="can">{{ a.can }}</span>
                </span>
                @if (busy() === a.id) {
                  <span class="spinner" aria-label="Signing in"></span>
                } @else {
                  <app-icon class="go" name="arrow-right" [size]="18" />
                }
              </button>
            </li>
          }
        </ul>

        <a class="back" routerLink="/">
          <app-icon name="arrow-left" [size]="16" /> Back to the claimant site
        </a>
      </div>
    </main>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      background:
        radial-gradient(60rem 30rem at 50% -10%, var(--primary-soft), transparent 70%), var(--bg);
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text);
      font-size: 17px;
      font-weight: 700;
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
    .wrap {
      flex: 1;
      display: grid;
      place-items: center;
      padding: 16px 16px 64px;
    }
    .panel {
      width: min(520px, 100%);
      padding: 32px;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 99px;
      background: var(--primary-soft);
      color: var(--primary);
      font-size: 12.5px;
      font-weight: 600;
    }
    h1 {
      margin-top: 14px;
      font-size: 24px;
      letter-spacing: -0.02em;
    }
    .lead {
      margin: 8px 0 20px;
      color: var(--text-2);
      line-height: 1.55;
    }
    .alert {
      margin-bottom: 16px;
    }
    .accounts {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .accounts button {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      text-align: left;
      cursor: pointer;
      transition:
        border-color 0.15s,
        background 0.15s;
      &:hover:not(:disabled) {
        border-color: var(--primary);
        background: var(--primary-soft);
        .go {
          color: var(--primary);
          transform: translateX(2px);
        }
      }
      &:disabled {
        cursor: progress;
        opacity: 0.7;
      }
    }
    .who {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .role {
      font-size: 12.5px;
      font-weight: 500;
      color: var(--text-3);
      &.manager {
        color: var(--primary);
      }
    }
    .can {
      margin-top: 4px;
      font-size: 13px;
      line-height: 1.45;
      color: var(--text-2);
    }
    .go {
      flex-shrink: 0;
      color: var(--text-3);
      transition: transform 0.15s;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 20px;
      color: var(--text-2);
      font-size: 13.5px;
      font-weight: 500;
      &:hover {
        color: var(--primary);
      }
    }
    @media (max-width: 480px) {
      .top {
        padding: 12px 16px;
      }
      .panel {
        padding: 22px 18px;
      }
      h1 {
        font-size: 21px;
      }
    }
  `,
})
export class SignIn {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);

  readonly returnUrl = input<string>();
  readonly expired = input(false, { transform: (v: unknown) => v !== undefined && v !== null });

  protected readonly accounts = ACCOUNTS;
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected signIn(account: DemoAccount): void {
    this.busy.set(account.id);
    this.error.set(null);
    this.auth.signIn(account.id).subscribe({
      next: () => {
        const target = this.returnUrl();
        // Only follow in-app staff URLs, never an arbitrary redirect.
        void this.router.navigateByUrl(target?.startsWith('/staff') ? target : '/staff');
      },
      error: (err: unknown) => {
        this.busy.set(null);
        this.error.set(errorMessage(err));
      },
    });
  }
}
