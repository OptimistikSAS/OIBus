import { Component, forwardRef, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { DatetimepickerComponent } from '../datetimepicker/datetimepicker.component';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { DateTime } from 'luxon';
import { Instant } from '../../../../../backend/shared/model/types';
import { Subject, takeUntil } from 'rxjs';
import { dateTimeRangeValidatorBuilder } from '../form/validators';

export interface DateRange {
  startTime: Instant;
  endTime: Instant;
}

export interface PredefinedRange {
  key: string;
  translationKey: string;
  calculate: () => DateRange;
}

@Component({
  selector: 'oib-date-range-selector',
  templateUrl: './date-range-selector.component.html',
  imports: [TranslateDirective, TranslatePipe, DatetimepickerComponent, ValidationErrorsComponent, ReactiveFormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateRangeSelectorComponent),
      multi: true
    }
  ]
})
export class DateRangeSelectorComponent implements OnInit, OnDestroy, ControlValueAccessor {
  private fb = inject(NonNullableFormBuilder);
  private destroy$ = new Subject<void>();

  @Input() startLabel = 'history-query.start';
  @Input() endLabel = 'history-query.end';
  @Input() defaultRange = 'last-day';

  predefinedRanges: Array<PredefinedRange> = [
    {
      key: 'last-minute',
      translationKey: 'date-range.last-minute',
      calculate: () => this.calculateRange({ minutes: 1 })
    },
    {
      key: 'last-10-minutes',
      translationKey: 'date-range.last-10-minutes',
      calculate: () => this.calculateRange({ minutes: 10 })
    },
    {
      key: 'last-hour',
      translationKey: 'date-range.last-hour',
      calculate: () => this.calculateRange({ hours: 1 })
    },
    {
      key: 'last-day',
      translationKey: 'date-range.last-day',
      calculate: () => this.calculateRange({ days: 1 })
    }
  ];

  internalForm = this.fb.group({
    rangeType: [this.defaultRange as string, Validators.required],
    startTime: [DateTime.now().minus({ days: 1 }).toUTC().toISO()!, [dateTimeRangeValidatorBuilder('start')]],
    endTime: [DateTime.now().toUTC().toISO()!, [dateTimeRangeValidatorBuilder('end')]]
  });

  // ControlValueAccessor implementation
  private onChange: (value: DateRange) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit() {
    this.setupFormValidation();
    this.watchFormChanges();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  writeValue(value: DateRange | null): void {
    if (value) {
      this.internalForm.patchValue(
        {
          rangeType: 'custom',
          startTime: value.startTime,
          endTime: value.endTime
        },
        { emitEvent: false }
      );
    }
  }

  registerOnChange(fn: (value: DateRange) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.internalForm.disable();
    } else {
      this.internalForm.enable();
    }
  }

  getCurrentRangeDescription(): string {
    const rangeType = this.internalForm.controls.rangeType.value;
    if (rangeType === 'custom') {
      return this.getCustomRangeDescription();
    }

    const range = this.predefinedRanges.find(r => r.key === rangeType);
    if (range) {
      const calculated = range.calculate();
      return this.formatDateRange(calculated);
    }
    return '';
  }

  private calculateRange(duration: Record<string, number>): DateRange {
    const now = DateTime.now().toUTC();
    return {
      startTime: now.minus(duration).toISO()!,
      endTime: now.toISO()!
    };
  }

  private setupFormValidation(): void {
    // Setup cross-validation for custom date inputs
    this.internalForm.controls.startTime.valueChanges.subscribe(() => {
      this.internalForm.controls.endTime.updateValueAndValidity({
        emitEvent: false
      });
    });

    this.internalForm.controls.endTime.valueChanges.subscribe(() => {
      this.internalForm.controls.startTime.updateValueAndValidity({
        emitEvent: false
      });
    });
  }

  private watchFormChanges(): void {
    this.internalForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.emitValue();
    });
  }

  private getCustomRangeDescription(): string {
    const startTime = this.internalForm.controls.startTime.value;
    const endTime = this.internalForm.controls.endTime.value;

    if (startTime && endTime) {
      return this.formatDateRange({ startTime, endTime });
    }
    return '';
  }

  private formatDateRange(range: DateRange): string {
    const start = DateTime.fromISO(range.startTime).toLocaleString(DateTime.DATETIME_SHORT);
    const end = DateTime.fromISO(range.endTime).toLocaleString(DateTime.DATETIME_SHORT);
    return `${start} - ${end}`;
  }

  private emitValue(): void {
    const formValue = this.internalForm.value;
    let dateRange: DateRange;

    if (formValue.rangeType === 'custom') {
      dateRange = {
        startTime: formValue.startTime!,
        endTime: formValue.endTime!
      };
    } else {
      const range = this.predefinedRanges.find(r => r.key === formValue.rangeType);
      if (range) {
        dateRange = range.calculate();
        // Update the internal form controls for consistency
        this.internalForm.patchValue(
          {
            startTime: dateRange.startTime,
            endTime: dateRange.endTime
          },
          { emitEvent: false }
        );
      } else {
        return;
      }
    }

    if (this.internalForm.valid) {
      this.onChange(dateRange);
      this.onTouched();
    }
  }
}
