import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ClaimDocument } from '../../../core/models';
import { FileDrop } from '../../../shared/upload/file-drop';
import { ClaimFormService } from '../claim-form.service';
import { FieldError } from '../field-error';

@Component({
  selector: 'app-documents-step',
  imports: [FieldError, FileDrop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="intro">
      Add at least one photo of the damage. Repair quotes, receipts and the police report help the
      agent decide faster.
    </p>

    <app-file-drop
      inputId="documents"
      describedBy="documents-error"
      [uploader]="f.uploader"
      [documents]="documents()"
      [invalid]="f.invalid('documents')"
      (removed)="f.removeDocument($event)"
      (picked)="f.form.controls.documents.markAsTouched()"
    >
      <app-field-error
        path="documents"
        id="documents-error"
        [messages]="{ minItems: 'Add at least one photo or document.' }"
      />
    </app-file-drop>
  `,
  styles: `
    .intro {
      margin: 0 0 18px;
      color: var(--text-2);
      line-height: 1.55;
    }
    app-field-error {
      display: flex;
      margin-top: 12px;
    }
  `,
})
export class DocumentsStep {
  protected readonly f = inject(ClaimFormService);

  protected documents(): ClaimDocument[] {
    return this.f.value<ClaimDocument[]>('documents') ?? [];
  }
}
