import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HOME_CAUSES, ITEM_CATEGORIES, ItemCategory } from '../../../core/models';
import { formatDate } from '../../../core/validators';
import { Icon } from '../../../shared/ui/icon';
import { ClaimFormService } from '../claim-form.service';
import { FieldError } from '../field-error';

@Component({
  selector: 'app-review-step',
  imports: [ReactiveFormsModule, FieldError, Icon, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (claim(); as c) {
      <p class="intro">
        Check your answers before you send the claim. You can still change anything.
      </p>

      <section class="block" aria-labelledby="r-policy">
        <header>
          <h3 id="r-policy">Policy and contact</h3>
          <button
            class="btn btn-ghost sm"
            type="button"
            (click)="edit.emit(0)"
            aria-label="Edit policy and contact"
          >
            <app-icon name="pencil" [size]="14" /> Edit
          </button>
        </header>
        <dl>
          <div>
            <dt>Policy</dt>
            <dd class="mono">{{ c.policyNumber }} ({{ c.type === 'auto' ? 'Auto' : 'Home' }})</dd>
          </div>
          <div>
            <dt>Name</dt>
            <dd>{{ c.claimant.firstName }} {{ c.claimant.lastName }}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{{ c.claimant.email }}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{{ c.claimant.phone }}</dd>
          </div>
        </dl>
      </section>

      <section class="block" aria-labelledby="r-incident">
        <header>
          <h3 id="r-incident">What happened</h3>
          <button
            class="btn btn-ghost sm"
            type="button"
            (click)="edit.emit(1)"
            aria-label="Edit what happened"
          >
            <app-icon name="pencil" [size]="14" /> Edit
          </button>
        </header>
        <dl>
          <div>
            <dt>When</dt>
            <dd>{{ date(c.incident.date) }}{{ c.incident.time ? ', ' + c.incident.time : '' }}</dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>{{ c.incident.location }}</dd>
          </div>
          @if (c.incident.auto; as a) {
            <div>
              <dt>Vehicle</dt>
              <dd>
                {{ a.vehicle.year }} {{ a.vehicle.make }} {{ a.vehicle.model }} ·
                {{ a.vehicle.plate }}
              </dd>
            </div>
            <div>
              <dt>Drivable</dt>
              <dd>{{ a.drivable ? 'Yes' : 'No' }}</dd>
            </div>
            <div>
              <dt>Other party</dt>
              <dd>
                @if (a.otherParty; as o) {
                  {{ o.name }}, insured with {{ o.insurer
                  }}{{ o.plate ? ' · ' + o.plate.toUpperCase() : '' }}
                } @else {
                  None
                }
              </dd>
            </div>
          }
          @if (c.incident.home; as h) {
            <div>
              <dt>Cause</dt>
              <dd>{{ cause(h.cause) }}</dd>
            </div>
            <div>
              <dt>Areas</dt>
              <dd>{{ h.rooms.join(', ') }}</dd>
            </div>
            <div>
              <dt>Livable</dt>
              <dd>
                {{ h.habitable ? 'Yes' : 'No'
                }}{{ h.needsAccommodation ? ', needs temporary accommodation' : '' }}
              </dd>
            </div>
          }
          @if (c.incident.policeReportNumber) {
            <div>
              <dt>Police report</dt>
              <dd class="mono">{{ c.incident.policeReportNumber }}</dd>
            </div>
          }
          <div class="wide">
            <dt>Description</dt>
            <dd class="pre">{{ c.incident.description }}</dd>
          </div>
        </dl>
      </section>

      <section class="block" aria-labelledby="r-items">
        <header>
          <h3 id="r-items">Damage and costs</h3>
          <button
            class="btn btn-ghost sm"
            type="button"
            (click)="edit.emit(2)"
            aria-label="Edit damage and costs"
          >
            <app-icon name="pencil" [size]="14" /> Edit
          </button>
        </header>
        <table>
          <caption class="sr-only">
            Claimed items
          </caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Category</th>
              <th scope="col" class="num">Cost</th>
            </tr>
          </thead>
          <tbody>
            @for (item of c.items; track $index) {
              <tr>
                <td>{{ item.description }}</td>
                <td>{{ category(item.category) }}</td>
                <td class="num">{{ item.amount | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colspan="2">Total</th>
              <td class="num">{{ f.total() | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section class="block" aria-labelledby="r-docs">
        <header>
          <h3 id="r-docs">Photos and documents</h3>
          <button
            class="btn btn-ghost sm"
            type="button"
            (click)="edit.emit(3)"
            aria-label="Edit photos and documents"
          >
            <app-icon name="pencil" [size]="14" /> Edit
          </button>
        </header>
        <ul class="docs">
          @for (d of c.documents; track d.id) {
            <li>
              <app-icon [name]="d.mimeType === 'application/pdf' ? 'file' : 'image'" [size]="16" />
              {{ d.name }}
            </li>
          }
        </ul>
      </section>
    }

    <div class="consent" [formGroup]="f.form.controls.review">
      <label class="check">
        <input
          id="review-consent"
          type="checkbox"
          formControlName="consent"
          data-summary-label="Confirmation"
          [attr.aria-invalid]="f.invalid('review.consent')"
          aria-describedby="review-consent-error"
        />
        <span>
          I confirm the information is true to the best of my knowledge, and I agree that Tidewell
          may contact me and the other parties named to assess this claim.
        </span>
      </label>
      <app-field-error
        path="review.consent"
        id="review-consent-error"
        [messages]="{ required: 'Tick the box to confirm your answers.' }"
      />
    </div>
  `,
  styles: `
    .intro {
      margin: 0 0 18px;
      color: var(--text-2);
    }
    .block {
      padding: 16px 0;
      border-top: 1px solid var(--border);
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      h3 {
        font-size: 15px;
      }
    }
    .sm {
      height: 30px;
      padding: 0 10px;
      font-size: 13px;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 24px;
      margin: 0;
      div.wide {
        grid-column: 1 / -1;
      }
      dt {
        font-size: 12.5px;
        color: var(--text-3);
      }
      dd {
        margin: 2px 0 0;
        overflow-wrap: anywhere;
      }
      .pre {
        white-space: pre-line;
        line-height: 1.5;
      }
    }
    table {
      width: 100%;
      border-collapse: collapse;
      th,
      td {
        padding: 8px 0;
        text-align: left;
        border-bottom: 1px solid var(--border);
      }
      thead th {
        font-size: 12.5px;
        font-weight: 500;
        color: var(--text-3);
      }
      tfoot th,
      tfoot td {
        border-bottom: 0;
        font-weight: 700;
      }
      .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
    }
    .docs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
      li {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: var(--radius-sm);
        background: var(--surface-2);
        font-size: 13px;
      }
    }
    .consent {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
      padding: 16px;
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      line-height: 1.5;
    }
    @media (max-width: 640px) {
      dl {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ReviewStep {
  protected readonly f = inject(ClaimFormService);
  readonly edit = output<number>();

  protected readonly claim = computed(() => {
    this.f.version();
    return this.f.policy() ? this.f.toInput() : null;
  });

  protected readonly date = formatDate;

  protected cause(value: string): string {
    return HOME_CAUSES.find((c) => c.value === value)?.label ?? value;
  }

  protected category(value: ItemCategory): string {
    const all = [...ITEM_CATEGORIES.auto, ...ITEM_CATEGORIES.home];
    return all.find((c) => c.value === value)?.label ?? value;
  }
}
