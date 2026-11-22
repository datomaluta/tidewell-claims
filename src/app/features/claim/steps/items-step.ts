import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  Injector,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Icon } from '../../../shared/ui/icon';
import { ClaimFormService } from '../claim-form.service';
import { FieldError } from '../field-error';

const MAX_ITEMS = 10;

@Component({
  selector: 'app-items-step',
  imports: [ReactiveFormsModule, FieldError, Icon, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="intro">
      List what was damaged or lost, with your best estimate of the cost to repair or replace it. A
      rough number is fine, the agent will check it with you.
    </p>

    <ol class="items" aria-describedby="items-error">
      @for (group of f.items.controls; track group; let i = $index) {
        <li class="item" [formGroup]="group">
          <span class="index" aria-hidden="true">{{ i + 1 }}</span>
          <div class="field desc">
            <label [for]="'items-' + i + '-description'">
              Item {{ i + 1 }}<span class="req" aria-hidden="true">*</span>
            </label>
            <input
              [id]="'items-' + i + '-description'"
              class="input"
              formControlName="description"
              placeholder="e.g. Rear bumper"
              [class.invalid]="f.invalid(group.controls.description)"
              [attr.aria-invalid]="f.invalid(group.controls.description)"
              [attr.aria-describedby]="'items-' + i + '-description-error'"
            />
            <app-field-error
              [path]="'items.' + i + '.description'"
              [id]="'items-' + i + '-description-error'"
            />
          </div>
          <div class="field cat">
            <label [for]="'items-' + i + '-category'">
              Category<span class="req" aria-hidden="true">*</span>
            </label>
            <select
              [id]="'items-' + i + '-category'"
              class="select"
              formControlName="category"
              [class.invalid]="f.invalid(group.controls.category)"
              [attr.aria-invalid]="f.invalid(group.controls.category)"
              [attr.aria-describedby]="'items-' + i + '-category-error'"
            >
              <option value="" disabled>Choose…</option>
              @for (c of f.categories(); track c.value) {
                <option [value]="c.value">{{ c.label }}</option>
              }
            </select>
            <app-field-error
              [path]="'items.' + i + '.category'"
              [id]="'items-' + i + '-category-error'"
            />
          </div>
          <div class="field amount">
            <label [for]="'items-' + i + '-amount'">
              Cost (USD)<span class="req" aria-hidden="true">*</span>
            </label>
            <div class="money">
              <span aria-hidden="true">$</span>
              <input
                [id]="'items-' + i + '-amount'"
                class="input"
                type="number"
                inputmode="decimal"
                min="1"
                formControlName="amount"
                [class.invalid]="f.invalid(group.controls.amount)"
                [attr.aria-invalid]="f.invalid(group.controls.amount)"
                [attr.aria-describedby]="'items-' + i + '-amount-error'"
              />
            </div>
            <app-field-error
              [path]="'items.' + i + '.amount'"
              [id]="'items-' + i + '-amount-error'"
            />
          </div>
          <button
            class="btn-icon danger remove"
            type="button"
            (click)="remove(i)"
            [disabled]="f.items.length === 1"
            [attr.aria-label]="'Remove item ' + (i + 1)"
            title="Remove item"
          >
            <app-icon name="trash" [size]="17" />
          </button>
        </li>
      }
    </ol>

    <button
      class="btn btn-secondary add"
      type="button"
      (click)="add()"
      [disabled]="f.items.length >= max"
    >
      <app-icon name="plus" [size]="16" /> Add another item
    </button>
    @if (f.items.length >= max) {
      <p class="hint">You can list up to {{ max }} items. Put the rest in one line as “Other”.</p>
    }

    @if (f.policy(); as p) {
      <div class="summary card" aria-live="polite">
        <div>
          <span>Total claimed</span>
          <strong [class.over]="f.total() > p.coverageLimit">
            {{ f.total() | currency: 'USD' : 'symbol' : '1.0-0' }}
          </strong>
        </div>
        <div>
          <span>Your deductible</span>
          <strong>− {{ p.deductible | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
        </div>
        <div class="estimate">
          <span>Estimated payout if approved</span>
          <strong>{{
            payout(p.deductible, p.coverageLimit) | currency: 'USD' : 'symbol' : '1.0-0'
          }}</strong>
        </div>
        <p class="hint">
          Coverage limit {{ p.coverageLimit | currency: 'USD' : 'symbol' : '1.0-0' }}.
        </p>
      </div>
    }
    <app-field-error path="items" id="items-error" />
  `,
  styles: `
    .intro {
      margin: 0 0 18px;
      color: var(--text-2);
      line-height: 1.55;
    }
    .items {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .item {
      display: grid;
      grid-template-columns: 28px minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 0.8fr) 34px;
      align-items: start;
      gap: 12px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      animation: appear 0.18s ease-out;
    }
    .index {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      margin-top: 26px;
      border-radius: 50%;
      background: var(--primary-soft);
      color: var(--primary);
      font-size: 13px;
      font-weight: 600;
    }
    .remove {
      margin-top: 26px;
    }
    .money {
      position: relative;
      span {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-3);
      }
      input {
        padding-left: 24px;
      }
    }
    .add {
      margin-top: 14px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 22px;
      padding: 16px 18px;
      box-shadow: none;
      background: var(--surface-2);
      div {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      span {
        font-size: 13px;
        color: var(--text-2);
      }
      strong {
        font-size: 18px;
        &.over {
          color: var(--danger);
        }
      }
      .estimate strong {
        color: var(--primary);
      }
      .hint {
        grid-column: 1 / -1;
      }
    }
    app-field-error[path='items'] {
      display: block;
      margin-top: 10px;
    }
    @keyframes appear {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
    @media (max-width: 760px) {
      .item {
        grid-template-columns: 28px minmax(0, 1fr) 34px;
        .desc,
        .cat,
        .amount {
          grid-column: 2;
        }
        .cat,
        .amount {
          margin-top: -2px;
        }
        .remove {
          grid-column: 3;
          grid-row: 1;
        }
      }
      .summary {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ItemsStep {
  protected readonly f = inject(ClaimFormService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly max = MAX_ITEMS;

  protected add(): void {
    this.f.addItem();
    const index = this.f.items.length - 1;
    // Move focus to the new row so keyboard and screen reader users land in it.
    afterNextRender(() => this.focus(`items-${index}-description`), { injector: this.injector });
  }

  protected remove(index: number): void {
    this.f.removeItem(index);
    const next = Math.min(index, this.f.items.length - 1);
    afterNextRender(() => this.focus(`items-${next}-description`), { injector: this.injector });
  }

  protected payout(deductible: number, limit: number): number {
    return Math.max(0, Math.min(this.f.total(), limit) - deductible);
  }

  private focus(id: string): void {
    this.host.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus();
  }
}
