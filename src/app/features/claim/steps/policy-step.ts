import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { formatDate } from '../../../core/validators';
import { Icon } from '../../../shared/ui/icon';
import { ClaimFormService } from '../claim-form.service';
import { FieldError } from '../field-error';

@Component({
  selector: 'app-policy-step',
  imports: [ReactiveFormsModule, FieldError, Icon, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-grid" [formGroup]="f.form.controls.policy">
      <div class="field span-2">
        <label for="policy-policyNumber">
          Policy number<span class="req" aria-hidden="true">*</span>
        </label>
        <div class="lookup">
          <input
            id="policy-policyNumber"
            class="input mono"
            formControlName="policyNumber"
            placeholder="TWA-123456"
            autocomplete="off"
            spellcheck="false"
            [class.invalid]="f.invalid('policy.policyNumber')"
            [attr.aria-invalid]="f.invalid('policy.policyNumber')"
            aria-describedby="policy-policyNumber-hint policy-policyNumber-error policy-lookup"
          />
          <span class="lookup-state" id="policy-lookup" aria-live="polite">
            @switch (f.lookupState()) {
              @case ('checking') {
                <span class="spinner"></span> Checking…
              }
              @case ('found') {
                <app-icon name="circle-check" [size]="16" /> Policy found
              }
            }
          </span>
        </div>
        <p class="hint" id="policy-policyNumber-hint">
          It's on your policy documents and the Tidewell app. Demo: TWA-204518 or TWH-318840.
        </p>
        <app-field-error path="policy.policyNumber" id="policy-policyNumber-error" />
      </div>

      @if (f.policy(); as p) {
        <div class="policy card span-2" aria-label="Policy details">
          <span class="type-icon"><app-icon [name]="p.type === 'auto' ? 'car' : 'home'" /></span>
          <div class="policy-main">
            <strong>{{ p.type === 'auto' ? 'Auto' : 'Home' }} policy · {{ p.holderName }}</strong>
            <span>
              @if (p.vehicle; as v) {
                {{ v.year }} {{ v.make }} {{ v.model }} · {{ v.plate }}
              } @else {
                {{ p.address }}
              }
            </span>
          </div>
          <dl>
            <div>
              <dt>Covered</dt>
              <dd>{{ period(p.validFrom) }} – {{ period(p.validTo) }}</dd>
            </div>
            <div>
              <dt>Limit</dt>
              <dd>{{ p.coverageLimit | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
            </div>
            <div>
              <dt>Deductible</dt>
              <dd>{{ p.deductible | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
            </div>
          </dl>
        </div>
      }

      <h3 class="span-2 section">Your contact details</h3>

      <div class="field">
        <label for="policy-firstName"
          >First name<span class="req" aria-hidden="true">*</span></label
        >
        <input
          id="policy-firstName"
          class="input"
          formControlName="firstName"
          autocomplete="given-name"
          [class.invalid]="f.invalid('policy.firstName')"
          [attr.aria-invalid]="f.invalid('policy.firstName')"
          aria-describedby="policy-firstName-error"
        />
        <app-field-error path="policy.firstName" id="policy-firstName-error" />
      </div>

      <div class="field">
        <label for="policy-lastName">Last name<span class="req" aria-hidden="true">*</span></label>
        <input
          id="policy-lastName"
          class="input"
          formControlName="lastName"
          autocomplete="family-name"
          [class.invalid]="f.invalid('policy.lastName')"
          [attr.aria-invalid]="f.invalid('policy.lastName')"
          aria-describedby="policy-lastName-error"
        />
        <app-field-error path="policy.lastName" id="policy-lastName-error" />
      </div>

      <div class="field">
        <label for="policy-email">Email<span class="req" aria-hidden="true">*</span></label>
        <input
          id="policy-email"
          class="input"
          type="email"
          formControlName="email"
          autocomplete="email"
          [class.invalid]="f.invalid('policy.email')"
          [attr.aria-invalid]="f.invalid('policy.email')"
          aria-describedby="policy-email-hint policy-email-error"
        />
        <p class="hint" id="policy-email-hint">We send updates about your claim here.</p>
        <app-field-error path="policy.email" id="policy-email-error" />
      </div>

      <div class="field">
        <label for="policy-phone">Phone<span class="req" aria-hidden="true">*</span></label>
        <input
          id="policy-phone"
          class="input"
          type="tel"
          formControlName="phone"
          autocomplete="tel"
          placeholder="+1 503 555 0142"
          [class.invalid]="f.invalid('policy.phone')"
          [attr.aria-invalid]="f.invalid('policy.phone')"
          aria-describedby="policy-phone-error"
        />
        <app-field-error path="policy.phone" id="policy-phone-error" />
      </div>
    </div>
  `,
  styles: `
    .lookup {
      display: flex;
      align-items: center;
      gap: 12px;
      input {
        max-width: 240px;
        text-transform: uppercase;
        &::placeholder {
          text-transform: none;
        }
      }
    }
    .lookup-state {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--text-2);
      app-icon {
        color: var(--success);
      }
    }
    .policy {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px 16px;
      padding: 14px 16px;
      box-shadow: none;
      background: var(--surface-2);
      animation: appear 0.2s ease-out;
    }
    .type-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--primary-soft);
      color: var(--primary);
    }
    .policy-main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 200px;
      span {
        color: var(--text-2);
        font-size: 13px;
      }
    }
    dl {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 20px;
      margin: 0;
      dt {
        font-size: 12px;
        color: var(--text-3);
      }
      dd {
        margin: 0;
        font-weight: 500;
      }
    }
    .section {
      margin-top: 8px;
      font-size: 15px;
    }
    @keyframes appear {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
  `,
})
export class PolicyStep {
  protected readonly f = inject(ClaimFormService);
  protected readonly period = formatDate;
}
