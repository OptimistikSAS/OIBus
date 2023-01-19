import { AfterViewInit, Component, ContentChild, ElementRef, forwardRef, Input, OnInit, TemplateRef } from '@angular/core';
import { ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, NonNullableFormBuilder, Validator } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { DateTime } from 'luxon';
import { Instant, LocalDate, LocalTime } from '../types';
import { NgTemplateOutlet } from '@angular/common';
import { NgbInputDatepicker, NgbTimepicker } from '@ng-bootstrap/ng-bootstrap';
import { DatepickerContainerComponent } from '../datepicker-container/datepicker-container.component';
import { formDirectives } from '../form-directives';

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
 * <oi-datetimepicker formControlName="from" timeZone="UTC"></oi-datetimepicker>
 * ```
 *
 * If inputs need to be passed to the datepicker and/or to the timepicker, then two ng-template (one for the datepicker,
 * one for the timepicker) can be passed as  the content of this component.
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
  styleUrls: ['./datetimepicker.component.scss'],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatetimepickerComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DatetimepickerComponent), multi: true }
  ],
  imports: [...formDirectives, NgTemplateOutlet, NgbTimepicker, DatepickerContainerComponent, NgbInputDatepicker],
  standalone: true
})
export class DatetimepickerComponent implements OnInit, AfterViewInit, ControlValueAccessor, Validator {
  @ContentChild('date')
  dateTemplate: TemplateRef<any> | null = null;

  @ContentChild('time')
  timeTemplate: TemplateRef<any> | null = null;

  @Input()
  timeZone = 'Europe/Paris';

  dateCtrl = this.fb.control(null as LocalDate | null);
  timeCtrl = this.fb.control(null as LocalTime | null);

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private fb: NonNullableFormBuilder, private element: ElementRef<HTMLElement>) {}

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
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
      const local = DateTime.fromISO(value).setZone(this.timeZone);
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

  ngOnInit() {
    combineLatest([this.dateCtrl.valueChanges, this.timeCtrl.valueChanges]).subscribe(
      ([date, time]: [LocalDate | null, LocalTime | null]) => {
        if (this.dateCtrl.valid && this.timeCtrl.valid && date && time) {
          const local = DateTime.fromFormat(`${date} ${time}`, 'yyyy-MM-dd HH:mm:ss', { zone: this.timeZone });
          this.onChange(local.toUTC().toISO());
        } else {
          this.onChange(null);
        }
      }
    );
  }

  ngAfterViewInit(): void {
    this.element.nativeElement.querySelectorAll('input').forEach(input => {
      input.addEventListener('blur', () => this.onTouched());
    });
  }
}
