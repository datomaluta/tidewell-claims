import { HttpEventType } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormArray,
  FormGroup,
  NonNullableFormBuilder,
  Validators,
} from '@angular/forms';
import {
  Observable,
  Subscription,
  catchError,
  debounceTime,
  filter,
  firstValueFrom,
  map,
  of,
  startWith,
  switchMap,
  timer,
} from 'rxjs';
import { Api } from '../../core/api';
import { errorMessage } from '../../core/http/http-error';
import {
  ClaimDocument,
  ClaimInput,
  ClaimItem,
  HomeCause,
  ITEM_CATEGORIES,
  ItemCategory,
  Policy,
} from '../../core/models';
import { storage } from '../../core/storage';
import {
  FILE_RULES,
  POLICY_NUMBER_PATTERN,
  checkFile,
  errorText,
  minItems,
  normalizePolicyNumber,
  notInFuture,
  phoneNumber,
  policyNumberFormat,
  showError,
  sumAmounts,
  totalWithinLimit,
  withinPeriod,
} from '../../core/validators';

export interface StepDef {
  id: 'policy' | 'incident' | 'items' | 'documents' | 'review';
  title: string;
  control: AbstractControl;
}

export type LookupState = 'idle' | 'checking' | 'found' | 'notFound' | 'error';

export interface Upload {
  key: string;
  file: File;
  progress: number;
  state: 'uploading' | 'error';
  error?: string;
  sub?: Subscription;
}

interface Draft {
  savedAt: string;
  reached: number;
  value: unknown;
}

const DRAFT_KEY = 'tidewell.claim-draft';
const CURRENT_YEAR = new Date().getFullYear();

function itemGroup(fb: NonNullableFormBuilder, item?: Partial<ClaimItem>) {
  return fb.group({
    description: fb.control(item?.description ?? '', [
      Validators.required,
      Validators.maxLength(80),
    ]),
    category: fb.control<ItemCategory | ''>(item?.category ?? '', Validators.required),
    amount: fb.control<number | null>(item?.amount ?? null, [
      Validators.required,
      Validators.min(1),
      Validators.max(250_000),
    ]),
  });
}

export type ItemGroup = ReturnType<typeof itemGroup>;

/**
 * Owns the claim form for one wizard instance: the typed FormGroup, the rules that switch
 * fields on and off, policy lookup, uploads and the draft saved in localStorage.
 * Step components inject it instead of passing form groups down through inputs.
 */
@Injectable()
export class ClaimFormService {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(Api);
  private readonly destroyRef = inject(DestroyRef);

  readonly policy = signal<Policy | null>(null);
  readonly lookupState = signal<LookupState>('idle');
  readonly uploads = signal<Upload[]>([]);
  /** Object URLs for image previews, by document id. Only kept for this session. */
  readonly previews = signal<Record<string, string>>({});
  readonly lastSaved = signal<Date | null>(null);
  /** Index of the furthest step the user has reached. */
  readonly reached = signal(0);
  /** Autosave is paused while we ask whether to continue an old draft. */
  readonly autosave = signal(false);

  private readonly lookup: AsyncValidatorFn = (control) => {
    const number = normalizePolicyNumber(control.value ?? '');
    if (!POLICY_NUMBER_PATTERN.test(number)) return of(null);
    if (this.policy()?.number === number) return of(null);
    this.lookupState.set('checking');
    // Angular cancels this when the value changes again, so the timer works as a debounce.
    return timer(350).pipe(
      switchMap(() => this.api.policy(number)),
      map((policy) => {
        this.setPolicy(policy);
        this.lookupState.set('found');
        return null;
      }),
      catchError((err: { status?: number }) => {
        this.setPolicy(null);
        const notFound = err.status === 404;
        this.lookupState.set(notFound ? 'notFound' : 'error');
        return of(notFound ? { policyNotFound: true } : { lookupFailed: true });
      }),
    );
  };

  readonly form = this.fb.group({
    policy: this.fb.group({
      policyNumber: this.fb.control('', {
        validators: [Validators.required, policyNumberFormat],
        asyncValidators: [this.lookup],
      }),
      firstName: this.fb.control('', [Validators.required, Validators.maxLength(50)]),
      lastName: this.fb.control('', [Validators.required, Validators.maxLength(50)]),
      email: this.fb.control('', [Validators.required, Validators.email]),
      phone: this.fb.control('', [Validators.required, phoneNumber]),
    }),
    incident: this.fb.group({
      date: this.fb.control('', [
        Validators.required,
        notInFuture(),
        withinPeriod(() => {
          const p = this.policy();
          return p ? { from: p.validFrom, to: p.validTo } : null;
        }),
      ]),
      time: this.fb.control(''),
      location: this.fb.control('', [Validators.required, Validators.maxLength(120)]),
      description: this.fb.control('', [
        Validators.required,
        Validators.minLength(30),
        Validators.maxLength(1000),
      ]),
      policeReportNumber: this.fb.control({ value: '', disabled: true }, [
        Validators.required,
        Validators.pattern(/^[A-Za-z0-9-]{4,20}$/),
      ]),
      auto: this.fb.group({
        make: this.fb.control('', [Validators.required, Validators.maxLength(40)]),
        model: this.fb.control('', [Validators.required, Validators.maxLength(40)]),
        year: this.fb.control<number | null>(null, [
          Validators.required,
          Validators.min(1950),
          Validators.max(CURRENT_YEAR + 1),
        ]),
        plate: this.fb.control('', [Validators.required, Validators.maxLength(12)]),
        drivable: this.fb.control<boolean | null>(null, Validators.required),
        otherPartyInvolved: this.fb.control<boolean | null>(null, Validators.required),
        otherParty: this.fb.group({
          name: this.fb.control('', [Validators.required, Validators.maxLength(80)]),
          insurer: this.fb.control('', [Validators.required, Validators.maxLength(80)]),
          plate: this.fb.control('', Validators.maxLength(12)),
        }),
      }),
      home: this.fb.group({
        cause: this.fb.control<HomeCause | null>(null, Validators.required),
        rooms: this.fb.control<string[]>([], minItems(1)),
        habitable: this.fb.control<boolean | null>(null, Validators.required),
        needsAccommodation: this.fb.control(false),
      }),
    }),
    items: this.fb.array([itemGroup(this.fb)], {
      validators: [minItems(1), totalWithinLimit(() => this.policy()?.coverageLimit ?? null)],
    }),
    documents: this.fb.control<ClaimDocument[]>([], minItems(1)),
    review: this.fb.group({
      consent: this.fb.control(false, Validators.requiredTrue),
    }),
  });

  readonly steps: StepDef[] = [
    { id: 'policy', title: 'Policy and contact', control: this.form.controls.policy },
    { id: 'incident', title: 'What happened', control: this.form.controls.incident },
    { id: 'items', title: 'Damage and costs', control: this.form.controls.items },
    { id: 'documents', title: 'Photos and documents', control: this.form.controls.documents },
    { id: 'review', title: 'Review and submit', control: this.form.controls.review },
  ];

  /**
   * Bumped on every event of every control (value, status, touched, pristine). Template helpers
   * read it, so OnPush step components re-render when the form changes from anywhere, including
   * async validation and `markAllAsTouched()` called by the wizard.
   * We listen to each control, not just the root: a parent only emits when its own state
   * changes, so touching a second field in an already-touched group is silent at the root.
   */
  private readonly tick = signal(0);
  readonly version = this.tick.asReadonly();
  private readonly watched = new WeakSet<AbstractControl>();

  private watch(control: AbstractControl): void {
    if (!this.watched.has(control)) {
      this.watched.add(control);
      control.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.tick.update((n) => n + 1);
        // Controls added later (new item rows) are picked up on the next event.
        if (control === this.form) this.watch(this.form);
      });
    }
    if (control instanceof FormGroup || control instanceof FormArray) {
      Object.values(control.controls).forEach((child) => this.watch(child));
    }
  }

  readonly type = computed(() => this.policy()?.type ?? null);
  readonly categories = computed(() => {
    const type = this.type();
    return type ? ITEM_CATEGORIES[type] : [];
  });

  constructor() {
    this.watch(this.form);

    this.disable(this.form.controls.incident.controls.auto);
    this.disable(this.form.controls.incident.controls.home);

    const { policyNumber } = this.form.controls.policy.controls;
    policyNumber.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (this.policy() && this.policy()!.number !== normalizePolicyNumber(value)) {
        this.setPolicy(null);
      }
      if (!POLICY_NUMBER_PATTERN.test(normalizePolicyNumber(value))) this.lookupState.set('idle');
    });

    const { auto, home } = this.form.controls.incident.controls;
    auto.controls.otherPartyInvolved.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.applyRules());
    home.controls.cause.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applyRules());

    this.form.valueChanges
      .pipe(
        debounceTime(600),
        filter(() => this.autosave() && this.form.dirty),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.saveDraft());

    this.destroyRef.onDestroy(() => {
      this.uploads().forEach((u) => u.sub?.unsubscribe());
      Object.values(this.previews()).forEach((url) => URL.revokeObjectURL(url));
    });
  }

  /* ------------------------------ template helpers ------------------------------ */

  /** Reactive read of a control's value by path, e.g. `value('incident.auto.drivable')`. */
  value<T = unknown>(path: string): T {
    this.tick();
    return this.form.get(path)?.value as T;
  }

  invalid(path: string | AbstractControl): boolean {
    this.tick();
    return showError(typeof path === 'string' ? this.form.get(path) : path);
  }

  error(path: string | AbstractControl): string | null {
    this.tick();
    const control = typeof path === 'string' ? this.form.get(path) : path;
    return showError(control) ? errorText(control!.errors) : null;
  }

  status(control: AbstractControl): string {
    this.tick();
    return control.status;
  }

  readonly total = computed(() => {
    this.tick();
    return sumAmounts(this.form.controls.items.getRawValue());
  });

  get items(): FormArray<ItemGroup> {
    return this.form.controls.items;
  }

  /* ------------------------------------ rules ----------------------------------- */

  private setPolicy(policy: Policy | null): void {
    this.policy.set(policy);
    const { auto, home } = this.form.controls.incident.controls;
    if (policy?.type === 'auto') {
      this.enable(auto);
      this.disable(home);
      const vehicle = policy.vehicle;
      if (vehicle && !auto.controls.make.value) {
        auto.patchValue({ ...vehicle }, { emitEvent: false });
      }
    } else if (policy?.type === 'home') {
      this.enable(home);
      this.disable(auto);
    } else {
      this.disable(auto);
      this.disable(home);
    }

    // Prefill the policy holder's name when the contact fields are still empty.
    const contact = this.form.controls.policy.controls;
    if (policy && !contact.firstName.value && !contact.lastName.value) {
      const [first, ...rest] = policy.holderName.split(' ');
      contact.firstName.setValue(first);
      contact.lastName.setValue(rest.join(' '));
    }

    this.applyRules();
    // Validators that depend on the policy (date range, coverage limit) need a re-run.
    this.form.controls.incident.controls.date.updateValueAndValidity();
    this.items.updateValueAndValidity();
    this.tick.update((n) => n + 1);
  }

  /** Switches dependent fields on or off. Disabled controls skip validation and submission. */
  private applyRules(): void {
    const type = this.type();
    const { auto, home, policeReportNumber } = this.form.controls.incident.controls;
    const otherParty = type === 'auto' && auto.controls.otherPartyInvolved.value === true;
    const theft = type === 'home' && home.controls.cause.value === 'theft';

    if (otherParty) this.enable(auto.controls.otherParty);
    else this.disable(auto.controls.otherParty);

    if (otherParty || theft) this.enable(policeReportNumber);
    else this.disable(policeReportNumber);
  }

  private enable(control: AbstractControl): void {
    if (control.disabled) control.enable({ emitEvent: false });
  }

  private disable(control: AbstractControl): void {
    if (control.enabled) control.disable({ emitEvent: false });
  }

  /* ------------------------------------ items ----------------------------------- */

  addItem(): void {
    this.items.push(itemGroup(this.fb));
    this.items.markAsDirty();
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
    this.items.markAsDirty();
  }

  /* ----------------------------------- uploads ---------------------------------- */

  readonly documentCount = computed(() => {
    this.tick();
    return this.form.controls.documents.value.length + this.uploads().length;
  });

  /** Validates and uploads files. Returns messages for files that were refused up front. */
  addFiles(files: File[]): string[] {
    const problems: string[] = [];
    for (const file of files) {
      if (this.documentCount() >= FILE_RULES.maxFiles) {
        problems.push(`You can add up to ${FILE_RULES.maxFiles} files.`);
        break;
      }
      const problem = checkFile(file);
      if (problem) {
        problems.push(problem);
        continue;
      }
      const upload: Upload = { key: crypto.randomUUID(), file, progress: 0, state: 'uploading' };
      this.uploads.update((list) => [...list, upload]);
      this.start(upload);
    }
    return problems;
  }

  retryUpload(key: string): void {
    const upload = this.uploads().find((u) => u.key === key);
    if (upload) this.start(upload);
  }

  cancelUpload(key: string): void {
    this.uploads()
      .find((u) => u.key === key)
      ?.sub?.unsubscribe();
    this.uploads.update((list) => list.filter((u) => u.key !== key));
  }

  removeDocument(id: string): void {
    const docs = this.form.controls.documents;
    docs.setValue(docs.value.filter((d) => d.id !== id));
    docs.markAsDirty();
    const url = this.previews()[id];
    if (url) URL.revokeObjectURL(url);
  }

  private start(upload: Upload): void {
    this.patchUpload(upload.key, { state: 'uploading', progress: 0, error: undefined });
    const sub = this.api.upload(upload.file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.patchUpload(upload.key, {
            progress: Math.round((event.loaded / event.total) * 100),
          });
        }
        if (event.type === HttpEventType.Response && event.body) {
          const doc = event.body;
          if (upload.file.type.startsWith('image/')) {
            this.previews.update((p) => ({ ...p, [doc.id]: URL.createObjectURL(upload.file) }));
          }
          this.uploads.update((list) => list.filter((u) => u.key !== upload.key));
          const docs = this.form.controls.documents;
          docs.setValue([...docs.value, doc]);
          docs.markAsDirty();
          docs.markAsTouched();
        }
      },
      error: (err: unknown) =>
        this.patchUpload(upload.key, { state: 'error', error: errorMessage(err) }),
    });
    this.patchUpload(upload.key, { sub });
  }

  private patchUpload(key: string, patch: Partial<Upload>): void {
    this.uploads.update((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  }

  /* ---------------------------------- validation --------------------------------- */

  /** Resolves once async validation (the policy lookup) has finished. */
  settled(control: AbstractControl = this.form): Promise<string> {
    return firstValueFrom(
      (control.statusChanges as Observable<string>).pipe(
        startWith(control.status),
        filter((s) => s !== 'PENDING'),
      ),
    );
  }

  /** Index of the first step with errors, or -1. */
  firstInvalidStep(): number {
    return this.steps.findIndex((s) => s.control.invalid);
  }

  /* ------------------------------------ draft ----------------------------------- */

  readDraft(): Draft | null {
    return storage.get<Draft | null>(DRAFT_KEY, null);
  }

  saveDraft(): void {
    const savedAt = new Date();
    storage.set(DRAFT_KEY, {
      savedAt: savedAt.toISOString(),
      reached: this.reached(),
      value: this.form.getRawValue(),
    } satisfies Draft);
    this.lastSaved.set(savedAt);
  }

  clearDraft(): void {
    storage.remove(DRAFT_KEY);
    this.lastSaved.set(null);
  }

  /** Restores a saved draft. Waits for the policy lookup so dependent fields are switched on. */
  async restore(draft: Draft): Promise<void> {
    const value = draft.value as ReturnType<ClaimFormService['form']['getRawValue']>;
    this.items.clear({ emitEvent: false });
    for (const item of value.items ?? []) this.items.push(itemGroup(this.fb), { emitEvent: false });
    if (!this.items.length) this.items.push(itemGroup(this.fb), { emitEvent: false });

    // The policy first, so the auto/home sections are enabled before their values land.
    this.form.controls.policy.patchValue(value.policy);
    await this.settled(this.form.controls.policy.controls.policyNumber);
    this.form.patchValue(value);
    this.applyRules();
    this.form.markAsDirty();
    this.reached.set(Math.min(draft.reached ?? 0, this.steps.length - 1));
    this.lastSaved.set(new Date(draft.savedAt));
  }

  /* ----------------------------------- submit ----------------------------------- */

  toInput(): ClaimInput {
    const policy = this.policy()!;
    const v = this.form.getRawValue();
    const { incident } = v;
    const controls = this.form.controls.incident.controls;
    const otherParty = controls.auto.controls.otherParty.enabled;

    return {
      policyNumber: policy.number,
      type: policy.type,
      claimant: {
        firstName: v.policy.firstName.trim(),
        lastName: v.policy.lastName.trim(),
        email: v.policy.email.trim(),
        phone: v.policy.phone.trim(),
      },
      incident: {
        date: incident.date,
        time: incident.time,
        location: incident.location.trim(),
        description: incident.description.trim(),
        policeReportNumber: controls.policeReportNumber.enabled
          ? incident.policeReportNumber.trim().toUpperCase()
          : null,
        auto:
          policy.type === 'auto'
            ? {
                vehicle: {
                  make: incident.auto.make.trim(),
                  model: incident.auto.model.trim(),
                  year: Number(incident.auto.year),
                  plate: incident.auto.plate.trim().toUpperCase(),
                },
                drivable: incident.auto.drivable === true,
                otherPartyInvolved: otherParty,
                otherParty: otherParty ? { ...incident.auto.otherParty } : null,
              }
            : null,
        home:
          policy.type === 'home'
            ? {
                cause: incident.home.cause!,
                rooms: incident.home.rooms,
                habitable: incident.home.habitable === true,
                needsAccommodation:
                  incident.home.habitable === false && incident.home.needsAccommodation,
              }
            : null,
      },
      items: v.items.map((item) => ({
        description: item.description.trim(),
        category: item.category as ItemCategory,
        amount: Number(item.amount),
      })),
      documents: v.documents,
    };
  }
}
