import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';

interface SubmittedState {
  number: string;
  lastName: string;
  email: string;
  total: number;
}

@Component({
  selector: 'app-claim-submitted',
  imports: [RouterLink, Icon, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="card done">
        <span class="badge-icon"><app-icon name="circle-check" [size]="30" /></span>
        <h1>Your claim has been sent</h1>
        <p class="lead">
          Your claim number is <strong class="mono">{{ number() }}</strong>. Keep it handy, you'll
          need it to check progress or when you call us.
        </p>
        @if (info; as i) {
          <p class="muted">
            We'll send updates to {{ i.email }}. Total claimed:
            {{ i.total | currency: 'USD' : 'symbol' : '1.0-0' }}.
          </p>
        }

        <h2>What happens next</h2>
        <ol class="next">
          <li>
            <strong>An agent picks up your claim</strong>
            <span>Usually within one working day.</span>
          </li>
          <li>
            <strong>We review it</strong>
            <span>If we need anything else, you'll see a message on the tracking page.</span>
          </li>
          <li>
            <strong>Decision and payment</strong>
            <span>Approved claims are paid to your account on file within 5 working days.</span>
          </li>
        </ol>

        <div class="actions">
          <a class="btn btn-primary" routerLink="/track" [state]="trackState()">
            Track this claim <app-icon name="arrow-right" [size]="16" />
          </a>
          <a class="btn btn-secondary" routerLink="/">Back to home</a>
        </div>
      </div>
    </div>
  `,
  styles: `
    .wrap {
      max-width: 640px;
      margin: 0 auto;
      padding: 48px 24px 72px;
    }
    .done {
      padding: 36px;
      text-align: center;
    }
    .badge-icon {
      display: inline-grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--success-soft);
      color: var(--success);
    }
    h1 {
      margin: 16px 0 10px;
      font-size: 26px;
      outline: none;
    }
    .lead {
      margin: 0 0 6px;
      font-size: 16px;
      line-height: 1.55;
      color: var(--text-2);
    }
    h2 {
      margin: 28px 0 12px;
      font-size: 16px;
      text-align: left;
    }
    .next {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding-left: 20px;
      text-align: left;
      li {
        padding-left: 4px;
      }
      strong,
      span {
        display: block;
      }
      span {
        color: var(--text-2);
      }
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      margin-top: 28px;
    }
    @media (max-width: 560px) {
      .wrap {
        padding: 24px 16px 48px;
      }
      .done {
        padding: 24px 18px;
      }
    }
  `,
})
export class ClaimSubmitted {
  readonly number = input.required<string>();
  /** Passed in router state by the wizard; missing after a reload, which is fine. */
  protected readonly info = (history.state?.claim ?? null) as SubmittedState | null;

  protected trackState(): { number: string; lastName: string } {
    return { number: this.number(), lastName: this.info?.lastName ?? '' };
  }
}
