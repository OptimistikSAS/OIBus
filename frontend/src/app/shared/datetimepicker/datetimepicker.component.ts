import { NgTemplateOutlet } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  ElementRef,
  forwardRef,
  inject,
  input,
  TemplateRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validator
} from '@angular/forms';

import { NgbInputDatepicker, NgbTimepicker } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { DateTime } from 'luxon';
import { combineLatest } from 'rxjs';

import { Instant, LocalDate, LocalTime } from '@oibus/shared/common/types';

import { CurrentUserService } from '../current-user.service';
import { DatepickerContainerComponent } from '../datepicker-container/datepicker-container.component';

let nextId = 0;

/** The context of the custom date and time templates: the form control bound to the date or time picker */
interface PickerTemplateContext {
  $implicit: FormControl<string | null>;
}

/**
 * Component combining a ng-bootstrap input date picker and a ng-bootstrap time picker, which can be used
 * as a single form control component.
 * Its model is an Instant, i.e. an ISO-formatted string representing an Instant, such as 2019-10-02T12:45:00Z
 * By default, it allows entering hours and minutes, but not seconds.
 * If one of the pieces is missing, then the model is null.
 * The model is displayed using a timezone passed as input. If no timezone is passed, then the current user timezone is
 * used.
 *
 * Simple usage:
 *
 * ```
 * <oib-datetimepicker formControlName="from" timeZone="UTC"></oib-datetimepicker>
 * ```
 *
 * If inputs need to be passed to the datepicker and/or to the timepicker, then two ng-template (one for the datepicker,
 * one for the timepicker) can be passed as the content of this component.
 * They must have a template variable named `date` and `time`.
 * Both templates accept an implicit contextual argument which is the FormControl bound to the date or time picker.
 *
 * Example usage:
 *
 * ```
 * <oib-datetimepicker formControlName="from">
 *   <ng-template #date let-formControl>
 *     <oib-datepicker-container>
 *       <input [formControl]="formControl" [firstDayOfWeek]="7" class="form-control" ngbDatepicker />
 *     </oib-datepicker-container>
 *   </ng-template>
 *   <ng-template #time let-formControl>
 *     <ngb-timepicker [formControl]="formControl" [seconds]="true"></ngb-timepicker>
 *   </ng-template>
 * </oib-datetimepicker>
 * ```
 *
 * The above example customizes the datepicker by setting its first day of week to 7 (Sunday), and customizes
 * the time picker by making it display seconds in addition to hours and minutes.
 */
@Component({
  selector: 'oib-datetimepicker',
  templateUrl: './datetimepicker.component.html',
  styleUrl: './datetimepicker.component.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatetimepickerComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DatetimepickerComponent), multi: true }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, DatepickerContainerComponent, NgbInputDatepicker, ReactiveFormsModule, NgbTimepicker, TranslateDirective]
})
export class DatetimepickerComponent implements AfterViewInit, ControlValueAccessor, Validator {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly currentUserService = inject(CurrentUserService);

  readonly dateTemplate = contentChild<TemplateRef<PickerTemplateContext>>('date');

  readonly timeTemplate = contentChild<TemplateRef<PickerTemplateContext>>('time');

  readonly label = input('');
  readonly displaySeconds = input(false);
  readonly timezone = input(this.currentUserService.getTimezone());

  /** id of the default date input, labelled by the label */
  readonly dateInputId = `oib-datetimepicker-date-${nextId++}`;

  readonly dateCtrl = this.fb.control<string | null>(null);
  readonly timeCtrl = this.fb.control<string | null>(null);

  private onChange: (value: Instant | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    combineLatest([this.dateCtrl.valueChanges, this.timeCtrl.valueChanges])
      .pipe(takeUntilDestroyed())
      .subscribe(([date, time]: [LocalDate | null, LocalTime | null]) => {
        if (this.dateCtrl.valid && this.timeCtrl.valid && date && time) {
          const local = DateTime.fromFormat(`${date} ${time}`, 'yyyy-MM-dd HH:mm:ss', { zone: this.timezone() });
          this.onChange(local.toUTC().toISO());
        } else {
          this.onChange(null);
        }
      });
  }

  registerOnChange(fn: (value: Instant | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.dateCtrl.disable();
      this.timeCtrl.disable();
    } else {
      this.dateCtrl.enable();
      this.timeCtrl.enable();
    }
  }

  writeValue(value: Instant): void {
    if (value) {
      const local = DateTime.fromISO(value).setZone(this.timezone());
      this.dateCtrl.setValue(local.toFormat('yyyy-MM-dd'));
      this.timeCtrl.setValue(local.toFormat('HH:mm:ss'));
    } else {
      this.dateCtrl.setValue(null);
      this.timeCtrl.setValue('00:00:00');
    }
  }

  /**
   * If the underlying ngb-datepicker has a validation error,
   * then we propagate it.
   * This allows to display a validation message when the date is invalid.
   */
  validate() {
    if (this.dateCtrl.hasError('ngbDate')) {
      const error = this.dateCtrl.getError('ngbDate') as { invalid?: string };
      // the error can be `invalid` or `minDate` or `maxDate`, but we only care about invalid
      if (error.invalid) {
        return { ngbDate: this.dateCtrl.getError('ngbDate') };
      }
    }
    return null;
  }

  ngAfterViewInit(): void {
    this.element.nativeElement.querySelectorAll('input').forEach(input => {
      input.addEventListener('blur', () => this.onTouched());
    });
  }
}
