import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HOME_CAUSES, ROOMS } from '../../../core/models';
import { todayIso } from '../../../core/validators';
import { Icon } from '../../../shared/ui/icon';
import { ClaimFormService } from '../claim-form.service';
import { FieldError } from '../field-error';

@Component({
  selector: 'app-incident-step',
  imports: [ReactiveFormsModule, FieldError, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let incident = f.form.controls.incident;
    <div class="form-grid" [formGroup]="incident">
      <div class="field">
        <label for="incident-date"
          >Date of incident<span class="req" aria-hidden="true">*</span></label
        >
        <input
          id="incident-date"
          class="input"
          type="date"
          formControlName="date"
          [max]="today"
          [class.invalid]="f.invalid('incident.date')"
          [attr.aria-invalid]="f.invalid('incident.date')"
          aria-describedby="incident-date-error"
        />
        <app-field-error path="incident.date" id="incident-date-error" />
      </div>

      <div class="field">
        <label for="incident-time">Approximate time<span class="opt">(optional)</span></label>
        <input id="incident-time" class="input" type="time" formControlName="time" />
      </div>

      <div class="field span-2">
        <label for="incident-location"
          >Where did it happen?<span class="req" aria-hidden="true">*</span></label
        >
        <input
          id="incident-location"
          class="input"
          formControlName="location"
          placeholder="Street and city, or a description like “I-5 near exit 299”"
          autocomplete="street-address"
          [class.invalid]="f.invalid('incident.location')"
          [attr.aria-invalid]="f.invalid('incident.location')"
          aria-describedby="incident-location-error"
        />
        <app-field-error path="incident.location" id="incident-location-error" />
      </div>

      <div class="field span-2">
        <label for="incident-description">
          What happened?<span class="req" aria-hidden="true">*</span>
        </label>
        <textarea
          id="incident-description"
          class="textarea"
          rows="4"
          formControlName="description"
          [class.invalid]="f.invalid('incident.description')"
          [attr.aria-invalid]="f.invalid('incident.description')"
          aria-describedby="incident-description-hint incident-description-error"
        ></textarea>
        <div class="row-between">
          <p class="hint" id="incident-description-hint">
            A few sentences in your own words: what happened, and what was damaged.
          </p>
          <span class="hint count" [class.over]="description().length > 1000">
            {{ description().length }} / 1000
          </span>
        </div>
        <app-field-error path="incident.description" id="incident-description-error" />
      </div>

      @if (f.type() === 'auto') {
        <ng-container formGroupName="auto">
          <h3 class="span-2 section"><app-icon name="car" /> Your vehicle</h3>

          <div class="field">
            <label for="auto-make">Make<span class="req" aria-hidden="true">*</span></label>
            <input
              id="auto-make"
              class="input"
              formControlName="make"
              [class.invalid]="f.invalid('incident.auto.make')"
              [attr.aria-invalid]="f.invalid('incident.auto.make')"
              aria-describedby="auto-make-error"
            />
            <app-field-error path="incident.auto.make" id="auto-make-error" />
          </div>
          <div class="field">
            <label for="auto-model">Model<span class="req" aria-hidden="true">*</span></label>
            <input
              id="auto-model"
              class="input"
              formControlName="model"
              [class.invalid]="f.invalid('incident.auto.model')"
              [attr.aria-invalid]="f.invalid('incident.auto.model')"
              aria-describedby="auto-model-error"
            />
            <app-field-error path="incident.auto.model" id="auto-model-error" />
          </div>
          <div class="field">
            <label for="auto-year">Year<span class="req" aria-hidden="true">*</span></label>
            <input
              id="auto-year"
              class="input"
              type="number"
              inputmode="numeric"
              formControlName="year"
              [class.invalid]="f.invalid('incident.auto.year')"
              [attr.aria-invalid]="f.invalid('incident.auto.year')"
              aria-describedby="auto-year-error"
            />
            <app-field-error path="incident.auto.year" id="auto-year-error" />
          </div>
          <div class="field">
            <label for="auto-plate"
              >License plate<span class="req" aria-hidden="true">*</span></label
            >
            <input
              id="auto-plate"
              class="input mono upper"
              formControlName="plate"
              [class.invalid]="f.invalid('incident.auto.plate')"
              [attr.aria-invalid]="f.invalid('incident.auto.plate')"
              aria-describedby="auto-plate-error"
            />
            <app-field-error path="incident.auto.plate" id="auto-plate-error" />
          </div>

          <fieldset class="span-2" aria-describedby="auto-drivable-error">
            <legend class="legend">
              Can the car be driven safely?<span class="req" aria-hidden="true">*</span>
            </legend>
            <div class="choices">
              <label class="choice" [class.invalid]="f.invalid('incident.auto.drivable')">
                <input id="auto-drivable" type="radio" formControlName="drivable" [value]="true" />
                <span class="mark"></span> Yes
              </label>
              <label class="choice" [class.invalid]="f.invalid('incident.auto.drivable')">
                <input type="radio" formControlName="drivable" [value]="false" />
                <span class="mark"></span> No, it needs towing
              </label>
            </div>
            <app-field-error path="incident.auto.drivable" id="auto-drivable-error" />
          </fieldset>

          <fieldset class="span-2" aria-describedby="auto-otherPartyInvolved-error">
            <legend class="legend">
              Was another vehicle or person involved?<span class="req" aria-hidden="true">*</span>
            </legend>
            <div class="choices">
              <label class="choice" [class.invalid]="f.invalid('incident.auto.otherPartyInvolved')">
                <input
                  id="auto-otherPartyInvolved"
                  type="radio"
                  formControlName="otherPartyInvolved"
                  [value]="true"
                />
                <span class="mark"></span> Yes
              </label>
              <label class="choice" [class.invalid]="f.invalid('incident.auto.otherPartyInvolved')">
                <input type="radio" formControlName="otherPartyInvolved" [value]="false" />
                <span class="mark"></span> No
              </label>
            </div>
            <app-field-error
              path="incident.auto.otherPartyInvolved"
              id="auto-otherPartyInvolved-error"
            />
          </fieldset>

          @if (f.value('incident.auto.otherPartyInvolved') === true) {
            <div class="nested span-2" formGroupName="otherParty">
              <p class="nested-title">The other party</p>
              <div class="form-grid">
                <div class="field">
                  <label for="other-name"
                    >Driver's name<span class="req" aria-hidden="true">*</span></label
                  >
                  <input
                    id="other-name"
                    class="input"
                    formControlName="name"
                    [class.invalid]="f.invalid('incident.auto.otherParty.name')"
                    [attr.aria-invalid]="f.invalid('incident.auto.otherParty.name')"
                    aria-describedby="other-name-error"
                  />
                  <app-field-error path="incident.auto.otherParty.name" id="other-name-error" />
                </div>
                <div class="field">
                  <label for="other-insurer"
                    >Their insurer<span class="req" aria-hidden="true">*</span></label
                  >
                  <input
                    id="other-insurer"
                    class="input"
                    formControlName="insurer"
                    [class.invalid]="f.invalid('incident.auto.otherParty.insurer')"
                    [attr.aria-invalid]="f.invalid('incident.auto.otherParty.insurer')"
                    aria-describedby="other-insurer-error"
                  />
                  <app-field-error
                    path="incident.auto.otherParty.insurer"
                    id="other-insurer-error"
                  />
                </div>
                <div class="field">
                  <label for="other-plate"
                    >Their license plate<span class="opt">(optional)</span></label
                  >
                  <input id="other-plate" class="input mono upper" formControlName="plate" />
                </div>
              </div>
            </div>
          }
        </ng-container>
      }

      @if (f.type() === 'home') {
        <ng-container formGroupName="home">
          <h3 class="span-2 section"><app-icon name="home" /> Your home</h3>

          <fieldset class="span-2" aria-describedby="home-cause-error">
            <legend class="legend">
              What caused the damage?<span class="req" aria-hidden="true">*</span>
            </legend>
            <div class="choices">
              @for (cause of causes; track cause.value; let first = $first) {
                <label class="choice" [class.invalid]="f.invalid('incident.home.cause')">
                  <input
                    type="radio"
                    formControlName="cause"
                    [value]="cause.value"
                    [id]="first ? 'home-cause' : null"
                  />
                  <span class="mark"></span> {{ cause.label }}
                </label>
              }
            </div>
            <app-field-error path="incident.home.cause" id="home-cause-error" />
          </fieldset>

          <fieldset class="span-2" aria-describedby="home-rooms-error">
            <legend class="legend">
              Which areas were affected?<span class="req" aria-hidden="true">*</span>
            </legend>
            <div class="choices">
              @for (room of rooms; track room; let first = $first) {
                <label class="choice checkbox" [class.invalid]="f.invalid('incident.home.rooms')">
                  <input
                    type="checkbox"
                    [id]="first ? 'home-rooms' : null"
                    [checked]="selectedRooms().includes(room)"
                    (change)="toggleRoom(room)"
                  />
                  <span class="mark"><app-icon name="check" [size]="13" [stroke]="3" /></span>
                  {{ room }}
                </label>
              }
            </div>
            <app-field-error
              path="incident.home.rooms"
              id="home-rooms-error"
              [messages]="{ minItems: 'Choose at least one area.' }"
            />
          </fieldset>

          <fieldset class="span-2" aria-describedby="home-habitable-error">
            <legend class="legend">
              Can you still live in the home?<span class="req" aria-hidden="true">*</span>
            </legend>
            <div class="choices">
              <label class="choice" [class.invalid]="f.invalid('incident.home.habitable')">
                <input
                  id="home-habitable"
                  type="radio"
                  formControlName="habitable"
                  [value]="true"
                />
                <span class="mark"></span> Yes
              </label>
              <label class="choice" [class.invalid]="f.invalid('incident.home.habitable')">
                <input type="radio" formControlName="habitable" [value]="false" />
                <span class="mark"></span> No
              </label>
            </div>
            <app-field-error path="incident.home.habitable" id="home-habitable-error" />
          </fieldset>

          @if (f.value('incident.home.habitable') === false) {
            <label class="check span-2 nested">
              <input type="checkbox" formControlName="needsAccommodation" />
              <span>
                <strong>I need help with temporary accommodation</strong><br />
                <span class="muted">Your policy can cover a hotel while repairs are done.</span>
              </span>
            </label>
          }
        </ng-container>
      }

      @if (!incident.controls.policeReportNumber.disabled) {
        <div class="field span-2 police">
          <label for="incident-police"
            >Police report number<span class="req" aria-hidden="true">*</span></label
          >
          <input
            id="incident-police"
            class="input mono upper"
            formControlName="policeReportNumber"
            placeholder="PR-12345"
            [class.invalid]="f.invalid('incident.policeReportNumber')"
            [attr.aria-invalid]="f.invalid('incident.policeReportNumber')"
            aria-describedby="incident-police-hint incident-police-error"
          />
          <p class="hint" id="incident-police-hint">
            We need it when
            {{ f.type() === 'home' ? 'something was stolen' : 'another party is involved' }}.
          </p>
          <app-field-error
            path="incident.policeReportNumber"
            id="incident-police-error"
            [messages]="{ pattern: 'Use 4–20 letters, numbers or dashes, like PR-12345.' }"
          />
        </div>
      }
    </div>
  `,
  styles: `
    .row-between {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .count {
      flex-shrink: 0;
      &.over {
        color: var(--danger);
      }
    }
    .section {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      padding-top: 18px;
      border-top: 1px solid var(--border);
      font-size: 15px;
      app-icon {
        color: var(--primary);
      }
    }
    .upper {
      text-transform: uppercase;
    }
    .nested {
      padding: 16px;
      border-left: 3px solid var(--primary);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      background: var(--surface-2);
      animation: appear 0.2s ease-out;
    }
    .nested-title {
      margin: 0 0 12px;
      font-weight: 600;
    }
    @keyframes appear {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
  `,
})
export class IncidentStep {
  protected readonly f = inject(ClaimFormService);
  protected readonly today = todayIso();
  protected readonly causes = HOME_CAUSES;
  protected readonly rooms = ROOMS;

  protected description(): string {
    return this.f.value<string>('incident.description') ?? '';
  }

  protected selectedRooms(): string[] {
    return this.f.value<string[]>('incident.home.rooms') ?? [];
  }

  protected toggleRoom(room: string): void {
    const control = this.f.form.controls.incident.controls.home.controls.rooms;
    const rooms = control.value.includes(room)
      ? control.value.filter((r) => r !== room)
      : [...control.value, room];
    control.setValue(rooms);
    control.markAsDirty();
    control.markAsTouched();
  }
}
