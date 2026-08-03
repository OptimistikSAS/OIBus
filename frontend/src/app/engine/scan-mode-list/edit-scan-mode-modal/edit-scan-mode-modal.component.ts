import { Component, inject, ChangeDetectionStrategy, LOCALE_ID } from '@angular/core';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import {
  AbstractControl,
  AsyncValidatorFn,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { map, Observable, of, switchMap, take } from 'rxjs';
import { DateTime, WeekdayNumbers } from 'luxon';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ScanModeService } from '../../../services/scan-mode.service';
import {
  ActivationWindow,
  ActivationWindowRecurring,
  ActivationWindowDateRange,
  INTERVAL_UNITS,
  IntervalUnit,
  ScanModeCommandDTO,
  ScanModeDTO,
  ScanModeType,
  ValidatedCronExpression
} from '../../../../../../backend/shared/model/scan-mode.model';
import { Instant, LocalTime, Timezone } from '../../../../../../backend/shared/model/types';
import { DatetimePipe, formatDateTime } from '../../../shared/datetime.pipe';
import { DatetimepickerComponent } from '../../../shared/datetimepicker/datetimepicker.component';
import { DayOfWeekSelectorComponent } from '../../../shared/form/day-of-week-selector/day-of-week-selector.component';
import { CurrentUserService } from '../../../shared/current-user.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { activationWindowValidator, INTERVAL_UNIT_TO_MS, minIntervalValidator } from '../../../shared/form/validators';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';

@Component({
  selector: 'oib-edit-scan-mode-modal',
  templateUrl: './edit-scan-mode-modal.component.html',
  styleUrl: './edit-scan-mode-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    TranslatePipe,
    DatetimePipe,
    OI_FORM_VALIDATION_DIRECTIVES,
    SaveButtonComponent,
    NgbTooltip,
    DatetimepickerComponent,
    DayOfWeekSelectorComponent
  ]
})
export class EditScanModeModalComponent {
  private modal = inject(NgbActiveModal);
  private scanModeService = inject(ScanModeService);
  private fb = inject(NonNullableFormBuilder);
  private currentUserService = inject(CurrentUserService);
  private translateService = inject(TranslateService);
  private locale = inject(LOCALE_ID);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  scanMode: ScanModeDTO | null = null;
  private existingScanModes: Array<ScanModeDTO> = [];
  private scanModesLoaded = false;

  readonly intervalUnits = INTERVAL_UNITS;
  /** The timezone the recurring rule will be stamped with when saving. */
  readonly timezone: Timezone = this.currentUserService.getTimezone();
  /** Timezone the window was last saved with, when it differs from the current one. */
  persistedTimezone: Timezone | null = null;

  constructor() {
    // Load scan modes list for uniqueness validation asynchronously
    // Note: form is initialized as a class field, so it's available here
    this.scanModeService
      .list()
      .pipe(take(1))
      .subscribe({
        next: scanModes => {
          this.existingScanModes = scanModes;
          this.scanModesLoaded = true;
          // Update validation once loaded - form should be available by now
          this.form?.controls.name.updateValueAndValidity({ onlySelf: true, emitEvent: false });
        },
        error: () => {
          // If list fails, just mark as loaded with empty array to avoid blocking validation
          this.existingScanModes = [];
          this.scanModesLoaded = true;
        }
      });
  }

  /**
   * Custom validator for the cron field.
   */
  private cronValidator: AsyncValidatorFn = control => {
    const cron: string = control.value;
    if (!cron) {
      return of(null);
    } else {
      return this.scanModeService.verifyCron(control.value).pipe(
        map(validatedCronExpression => {
          if (validatedCronExpression.isValid) {
            this.cronValidationResponse = validatedCronExpression;
            return null;
          } else {
            this.cronValidationResponse = null;
            return { cronErrorMessage: validatedCronExpression.errorMessage };
          }
        })
      );
    }
  };

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? '').toString().trim().toLowerCase();
      if (!value || !this.scanModesLoaded) {
        return null;
      }

      const isDuplicate = this.existingScanModes.some(scanMode => {
        if (this.scanMode && scanMode.id === this.scanMode.id) {
          return false;
        }
        return scanMode.name.trim().toLowerCase() === value;
      });

      return isDuplicate ? { mustBeUnique: true } : null;
    };
  }

  form = this.fb.group({
    name: this.fb.control('', {
      validators: [Validators.required, this.checkUniqueness()]
    }),
    description: this.fb.control(''),
    type: this.fb.control<ScanModeType>('cron'),
    cron: this.fb.control('', {
      validators: Validators.required,
      asyncValidators: this.cronValidator,
      updateOn: 'change'
    }),
    interval: this.fb.group(
      {
        value: this.fb.control<number | null>(null, {
          validators: [Validators.required, Validators.min(1)]
        }),
        unit: this.fb.control<IntervalUnit>('s', { validators: Validators.required })
      },
      { validators: [minIntervalValidator] }
    ),
    activationWindowEnabled: this.fb.control(false),
    activationWindow: this.fb.group(
      {
        start: this.fb.control<Instant | null>(null),
        end: this.fb.control<Instant | null>(null),
        daysOfWeek: this.fb.control<Array<number>>([]),
        timeStart: this.fb.control<LocalTime | null>(null),
        timeEnd: this.fb.control<LocalTime | null>(null)
      },
      { validators: [activationWindowValidator] }
    )
  });
  cronValidationResponse: ValidatedCronExpression | null = null;

  /**
   * Enable only the controls the current type and window toggle actually use. Disabled controls are
   * always valid and are excluded from `form.value`, so an unused cron cannot block saving.
   * Called explicitly rather than from a `valueChanges` subscription, which would re-enter during
   * `patchValue` and `reset`.
   */
  private updateEnablement(): void {
    const options = { emitEvent: false };
    if (this.form.controls.type.value === 'cron') {
      this.form.controls.cron.enable(options);
      this.form.controls.interval.disable(options);
    } else {
      this.form.controls.cron.disable(options);
      this.form.controls.interval.enable(options);
    }
    if (this.form.controls.activationWindowEnabled.value) {
      this.form.controls.activationWindow.enable(options);
    } else {
      this.form.controls.activationWindow.disable(options);
    }
  }

  selectType(type: ScanModeType): void {
    if (this.form.controls.type.value === type) {
      return;
    }
    this.form.controls.type.setValue(type);
    // setValue alone does not mark the form dirty, and canDismiss() keys off form.dirty.
    this.form.controls.type.markAsDirty();
    this.updateEnablement();
  }

  onActivationWindowToggle(): void {
    this.form.controls.activationWindowEnabled.markAsDirty();
    this.updateEnablement();
  }

  clearWindowBound(bound: 'start' | 'end'): void {
    this.form.controls.activationWindow.controls[bound].setValue(null);
    this.form.controls.activationWindow.markAsDirty();
  }

  /**
   * Prepares the component for creation.
   */
  prepareForCreation() {
    this.mode = 'create';
    this.scanMode = null;
    this.persistedTimezone = null;
    this.form.reset({
      name: '',
      description: '',
      type: 'cron',
      cron: '',
      interval: { value: null, unit: 's' },
      activationWindowEnabled: false,
      activationWindow: { start: null, end: null, daysOfWeek: [], timeStart: null, timeEnd: null }
    });
    this.cronValidationResponse = null;
    this.updateEnablement();
    this.form.controls.name.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(scanMode: ScanModeDTO) {
    this.mode = 'edit';
    this.scanMode = scanMode;

    const activationWindow = scanMode.activationWindow;
    const recurring = activationWindow?.recurring ?? null;
    this.persistedTimezone = recurring?.timezone ?? null;

    // Enable everything before patching so the result does not depend on the previous state of a
    // reused modal instance; updateEnablement() re-applies the correct state right after.
    this.form.enable({ emitEvent: false });

    this.form.patchValue({
      name: scanMode.name,
      description: scanMode.description,
      type: scanMode.type ?? 'cron',
      cron: scanMode.cron ?? '',
      interval: {
        value: scanMode.interval?.value ?? null,
        unit: scanMode.interval?.unit ?? 's'
      },
      activationWindowEnabled: !!activationWindow,
      activationWindow: {
        start: activationWindow?.dateRange?.start ?? null,
        end: activationWindow?.dateRange?.end ?? null,
        // All seven days stored means the same as "every day", which the UI shows as no selection.
        daysOfWeek: (recurring?.daysOfWeek ?? []).length === 7 ? [] : [...(recurring?.daysOfWeek ?? [])],
        timeStart: recurring?.timeOfDay?.start ?? null,
        timeEnd: recurring?.timeOfDay?.end ?? null
      }
    });

    this.cronValidationResponse = null;
    this.updateEnablement();
    this.form.markAsPristine();
    this.form.controls.name.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  canDismiss(): Observable<boolean> | boolean {
    if (this.form?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    // getRawValue rather than value: disabled controls are omitted from `value`, and it is typed
    // as a Partial.
    const formValue = this.form.getRawValue();
    const isCron = formValue.type === 'cron';

    const command: ScanModeCommandDTO = {
      name: formValue.name,
      description: formValue.description,
      type: formValue.type,
      cron: isCron ? formValue.cron : '',
      interval: isCron ? null : { value: Number(formValue.interval.value), unit: formValue.interval.unit },
      activationWindow: this.buildActivationWindow()
    };

    let obs: Observable<ScanModeDTO>;
    if (this.mode === 'create') {
      obs = this.scanModeService.create(command);
    } else {
      obs = this.scanModeService.update(this.scanMode!.id, command).pipe(switchMap(() => this.scanModeService.findById(this.scanMode!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(scanMode => {
      this.modal.close(scanMode);
    });
  }

  /**
   * Builds the activation window from the form, stamping the user's current timezone into the
   * recurring rule. An enabled but entirely blank window is persisted as "no window" rather than as
   * an object that gates nothing.
   */
  private buildActivationWindow(): ActivationWindow | null {
    if (!this.form.controls.activationWindowEnabled.value) {
      return null;
    }
    const value = this.form.controls.activationWindow.getRawValue();

    const dateRange: ActivationWindowDateRange | null =
      value.start || value.end ? { start: value.start ?? null, end: value.end ?? null } : null;

    const days = [...(value.daysOfWeek ?? [])].sort((a, b) => a - b);
    const hasDays = days.length > 0 && days.length < 7;
    const hasTimeOfDay = !!(value.timeStart && value.timeEnd);

    const recurring: ActivationWindowRecurring | null =
      hasDays || hasTimeOfDay
        ? {
            // Read fresh rather than from the cached field, so a timezone change while the modal is
            // open is honoured.
            timezone: this.currentUserService.getTimezone(),
            daysOfWeek: hasDays ? days : null,
            timeOfDay: hasTimeOfDay ? { start: value.timeStart!, end: value.timeEnd! } : null
          }
        : null;

    return dateRange || recurring ? { dateRange, recurring } : null;
  }

  /** The configured interval in milliseconds, or null when incomplete. */
  get intervalMs(): number | null {
    const { value, unit } = this.form.controls.interval.getRawValue();
    if (value === null || value === undefined || !unit) {
      return null;
    }
    const milliseconds = Number(value) * INTERVAL_UNIT_TO_MS[unit];
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }

  /**
   * Whether to show the sub-second advisory. Non-blocking: it never invalidates the form. Intervals
   * below the hard minimum are excluded so the advisory does not stack with the validation error.
   */
  get showSubSecondIntervalWarning(): boolean {
    const milliseconds = this.intervalMs;
    return this.form.controls.type.value === 'interval' && milliseconds !== null && milliseconds >= 10 && milliseconds < 1000;
  }

  /**
   * Whether the time-of-day window wraps past midnight. A lexicographic comparison is safe because
   * `<input type="time">` always produces zero-padded "HH:mm".
   */
  get isOvernight(): boolean {
    const { timeStart, timeEnd } = this.form.controls.activationWindow.getRawValue();
    return !!timeStart && !!timeEnd && timeEnd < timeStart;
  }

  /**
   * Human-readable rendition of the activation window, assembled from independently translated
   * clauses. Each clause is a whole phrase in its own key so translators can reorder words within
   * it; the clauses themselves are joined with a translatable separator, since which clauses are
   * present varies and ngx-translate cannot express that in a single key.
   */
  get activationWindowSummary(): string {
    if (!this.form.controls.activationWindowEnabled.value) {
      return '';
    }
    const value = this.form.controls.activationWindow.getRawValue();
    const clauses: Array<string> = [];

    const formatBound = (instant: Instant) => formatDateTime(instant, this.locale, this.timezone, 'medium')!;
    if (value.start && value.end) {
      clauses.push(
        this.translateService.instant('engine.scan-mode.summary.between-dates', {
          start: formatBound(value.start),
          end: formatBound(value.end)
        })
      );
    } else if (value.start) {
      clauses.push(this.translateService.instant('engine.scan-mode.summary.from-date', { start: formatBound(value.start) }));
    } else if (value.end) {
      clauses.push(this.translateService.instant('engine.scan-mode.summary.until-date', { end: formatBound(value.end) }));
    } else {
      clauses.push(this.translateService.instant('engine.scan-mode.summary.always'));
    }

    const days = [...(value.daysOfWeek ?? [])].sort((a, b) => a - b);
    if (days.length > 0 && days.length < 7) {
      clauses.push(
        this.translateService.instant('engine.scan-mode.summary.on-days', {
          days: days.map(day => this.dayLabel(day)).join(this.translateService.instant('engine.scan-mode.summary.day-separator'))
        })
      );
    }

    if (value.timeStart && value.timeEnd) {
      clauses.push(
        this.translateService.instant(
          this.isOvernight ? 'engine.scan-mode.summary.between-times-overnight' : 'engine.scan-mode.summary.between-times',
          { start: value.timeStart, end: value.timeEnd, timezone: this.timezone }
        )
      );
    } else {
      clauses.push(this.translateService.instant('engine.scan-mode.summary.all-day'));
    }

    return clauses.join(this.translateService.instant('engine.scan-mode.summary.separator'));
  }

  /** Locale-aware short day name, where 0 is Sunday and 6 is Saturday. */
  private dayLabel(day: number): string {
    return DateTime.fromObject({ weekday: (day === 0 ? 7 : day) as WeekdayNumbers })
      .setLocale(this.locale === 'en' ? 'en-GB' : this.locale)
      .toFormat('ccc');
  }

  /**
   * Returns the human-readable version of the cron expression.
   */
  get humanReadableCron() {
    return this.cronValidationResponse?.humanReadableForm ?? '';
  }

  /**
   * Returns the next 3 cron executions.
   */
  get nextCronExecutions() {
    return this.cronValidationResponse?.nextExecutions ?? [];
  }
}
