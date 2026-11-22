import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon, IconName } from '../../shared/ui/icon';

interface Step {
  icon: IconName;
  title: string;
  text: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="hero-text">
        <span class="badge pill"><app-icon name="shield" [size]="14" />Auto and home claims</span>
        <h1>Report a claim online in about ten minutes.</h1>
        <p>
          Tell us what happened, add photos and costs, and follow your claim until it's paid. Your
          answers are saved on this device as you go, so you can finish later.
        </p>
        <div class="cta">
          <a class="btn btn-primary lg" routerLink="/claim">
            File a claim <app-icon name="arrow-right" [size]="16" />
          </a>
          <a class="btn btn-secondary lg" routerLink="/track">Track a claim</a>
        </div>
      </div>

      <aside class="card demo" aria-labelledby="demo-title">
        <h2 id="demo-title"><app-icon name="info" [size]="16" /> Try it with a demo policy</h2>
        <dl>
          <div>
            <dt class="mono">TWA-204518</dt>
            <dd>Auto · Toyota Corolla · active</dd>
          </div>
          <div>
            <dt class="mono">TWH-318840</dt>
            <dd>Home · 14 Harbor Lane · active</dd>
          </div>
          <div>
            <dt class="mono">TWA-100233</dt>
            <dd>Auto · expired, to see date checks</dd>
          </div>
        </dl>
        <p class="hint">Staff can review submitted claims in the staff portal.</p>
      </aside>
    </section>

    <section class="steps" aria-labelledby="steps-title">
      <h2 id="steps-title">How it works</h2>
      <ol>
        @for (step of steps; track step.title; let i = $index) {
          <li class="card">
            <span class="num">{{ i + 1 }}</span>
            <app-icon [name]="step.icon" [size]="22" />
            <h3>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
          </li>
        }
      </ol>
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 1120px;
      margin: 0 auto;
      padding: 56px 24px 72px;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 48px;
      align-items: center;
    }
    .pill {
      background: var(--primary-soft);
      color: var(--primary);
    }
    h1 {
      margin: 16px 0 14px;
      font-size: clamp(32px, 5vw, 48px);
      line-height: 1.08;
      letter-spacing: -0.03em;
    }
    .hero-text p {
      margin: 0;
      max-width: 540px;
      font-size: 17px;
      line-height: 1.6;
      color: var(--text-2);
    }
    .cta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 28px;
    }
    .lg {
      height: 46px;
      padding: 0 20px;
      font-size: 15px;
    }
    .demo {
      padding: 22px;
      h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        app-icon {
          color: var(--primary);
        }
      }
      dl {
        display: grid;
        gap: 10px;
        margin: 16px 0;
      }
      dl div {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        background: var(--surface-2);
      }
      dt {
        font-weight: 600;
      }
      dd {
        margin: 0;
        color: var(--text-2);
        font-size: 13px;
      }
    }
    .steps {
      margin-top: 72px;
      h2 {
        font-size: 22px;
      }
      ol {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin: 20px 0 0;
        padding: 0;
        list-style: none;
      }
      li {
        position: relative;
        padding: 22px;
        app-icon {
          color: var(--primary);
        }
      }
      .num {
        position: absolute;
        top: 18px;
        right: 20px;
        font-size: 28px;
        font-weight: 700;
        color: var(--border);
      }
      h3 {
        margin: 14px 0 6px;
        font-size: 16px;
      }
      p {
        margin: 0;
        color: var(--text-2);
        line-height: 1.55;
      }
    }
    @media (max-width: 860px) {
      :host {
        padding: 32px 16px 56px;
      }
      .hero {
        grid-template-columns: 1fr;
        gap: 32px;
      }
      .steps ol {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Home {
  protected readonly steps: Step[] = [
    {
      icon: 'file',
      title: 'Tell us what happened',
      text: 'Your policy number, the date and place, and a short description in your own words.',
    },
    {
      icon: 'image',
      title: 'Add costs and photos',
      text: 'List what was damaged with estimated costs, then upload photos, receipts or a repair quote.',
    },
    {
      icon: 'circle-check',
      title: 'Follow the review',
      text: 'An agent reviews your claim, may ask for more details, and you see every step online.',
    },
  ];
}
