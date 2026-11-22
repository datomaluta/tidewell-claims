import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validators for the claim form. They are plain functions (no Angular injection),
 * so they are easy to unit test and reuse.
 */

export const POLICY_NUMBER_PATTERN = /^TW[AH]-\d{6}$/;

/** "twa 204518" → "TWA-204518" style cleanup before validating or looking up. */
export function normalizePolicyNumber(value: string): string {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  return /^TW[AH]\d{6}$/.test(compact) ? `${compact.slice(0, 3)}-${compact.slice(3)}` : compact;
}

export const policyNumberFormat: ValidatorFn = (control) => {
  const value = control.value as string | null;
  if (!value) return null;
  return POLICY_NUMBER_PATTERN.test(normalizePolicyNumber(value)) ? null : { policyFormat: true };
};

export const phoneNumber: ValidatorFn = (control) => {
  const value = (control.value as string | null)?.trim();
  if (!value) return null;
  const digits = value.replace(/\D/g, '').length;
  return /^\+?[0-9\s().-]+$/.test(value) && digits >= 7 && digits <= 15 ? null : { phone: true };
};

/** Today's date in the user's time zone as yyyy-mm-dd. */
export function todayIso(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function notInFuture(today: () => string = todayIso): ValidatorFn {
  return (control) => {
    const value = control.value as string | null;
    return value && value > today() ? { futureDate: true } : null;
  };
}

export interface Period {
  from: string;
  to: string;
}

/** The incident date has to fall inside the policy period, which is only known after lookup. */
export function withinPeriod(period: () => Period | null): ValidatorFn {
  return (control) => {
    const value = control.value as string | null;
    const p = period();
    if (!value || !p) return null;
    return value < p.from || value > p.to ? { outsidePolicyPeriod: { ...p } } : null;
  };
}

/** For array values (FormArray or a control holding an array). */
export function minItems(min: number): ValidatorFn {
  return (control) => {
    const length = (control.value as unknown[] | null)?.length ?? 0;
    return length < min ? { minItems: { min, actual: length } } : null;
  };
}

/** Sums `amount` across a FormArray of items and compares it with the policy limit. */
export function totalWithinLimit(limit: () => number | null): ValidatorFn {
  return (control) => {
    const max = limit();
    if (max === null) return null;
    const total = sumAmounts(control.value as { amount: number | null }[]);
    return total > max ? { overLimit: { limit: max, total } } : null;
  };
}

export function sumAmounts(items: { amount: number | null }[] | null): number {
  return (items ?? []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

/** Server-style rule check for uploads. Returns a message or null if the file is fine. */
export const FILE_RULES = {
  maxBytes: 10 * 1024 * 1024,
  maxFiles: 8,
  types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
} as const;

export function checkFile(file: { name: string; size: number; type: string }): string | null {
  if (!(FILE_RULES.types as readonly string[]).includes(file.type)) {
    return `${file.name}: only JPG, PNG, WebP or PDF files can be uploaded.`;
  }
  if (file.size > FILE_RULES.maxBytes) return `${file.name}: files must be 10 MB or smaller.`;
  if (file.size === 0) return `${file.name}: this file is empty.`;
  return null;
}

/** Human readable message for the first error on a control. */
export function errorText(errors: ValidationErrors | null): string | null {
  if (!errors) return null;
  const [key, value] = Object.entries(errors)[0];
  switch (key) {
    case 'required':
      return 'This field is required.';
    case 'requiredTrue':
      return 'Please confirm to continue.';
    case 'email':
      return 'Enter a valid email address, like name@example.com.';
    case 'minlength':
      return `Enter at least ${value.requiredLength} characters (${value.actualLength} so far).`;
    case 'maxlength':
      return `Use ${value.requiredLength} characters or fewer.`;
    case 'min':
      return `Enter ${value.min} or more.`;
    case 'max':
      return `Enter ${value.max} or less.`;
    case 'phone':
      return 'Enter a valid phone number, like +1 503 555 0142.';
    case 'policyFormat':
      return 'Policy numbers look like TWA-123456 (auto) or TWH-123456 (home).';
    case 'policyNotFound':
      return "We couldn't find this policy. Check the number on your policy documents.";
    case 'lookupFailed':
      return "We couldn't check your policy right now. Please try again.";
    case 'futureDate':
      return "The date can't be in the future.";
    case 'outsidePolicyPeriod':
      return `Your policy covers ${formatDate(value.from)} to ${formatDate(value.to)}. The incident has to fall in that period.`;
    case 'minItems':
      return value.min === 1 ? 'Add at least one item.' : `Add at least ${value.min} items.`;
    case 'overLimit':
      return `The total (${money(value.total)}) is above your coverage limit of ${money(value.limit)}.`;
    default:
      return 'Check this field.';
  }
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function money(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

/** True when the control should show its error (touched or edited). */
export function showError(control: AbstractControl | null): boolean {
  return !!control && control.invalid && (control.touched || control.dirty);
}
