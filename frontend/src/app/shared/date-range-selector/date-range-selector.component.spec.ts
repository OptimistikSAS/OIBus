import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormControl, Validators, FormBuilder } from '@angular/forms';
import { TranslatePipe, TranslateDirective, provideTranslateService } from '@ngx-translate/core';
import { Component, Input, Directive, Pipe, PipeTransform, ChangeDetectionStrategy } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DateTime } from 'luxon';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { DateRangeSelectorComponent, DateRange } from './date-range-selector.component';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, test, vi } from 'vitest';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

@Directive({ selector: '[oibTranslate]', standalone: true })
class MockTranslateDirective {
  @Input() translate = '';
}

@Component({
  selector: 'oib-test-date-range-selector-host-component',
  template: `
    <form [formGroup]="testForm">
      <oib-date-range-selector formControlName="dateRange" [startLabel]="startLabel" [endLabel]="endLabel" [defaultRange]="defaultRange" />
    </form>
  `,
  standalone: true,
  imports: [ReactiveFormsModule, DateRangeSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestHostComponent {
  testForm = TestBed.inject(FormBuilder).group({
    dateRange: new FormControl<DateRange | null>(null, Validators.required)
  });
  startLabel = 'custom.start';
  endLabel = 'custom.end';
  defaultRange = 'last-hour';
}

describe('DateRangeSelectorComponent', () => {
  let component: DateRangeSelectorComponent;
  let fixture: ComponentFixture<DateRangeSelectorComponent>;
  let hostComponent: TestHostComponent;
  let hostFixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, DateRangeSelectorComponent, TestHostComponent, MockTranslatePipe, MockTranslateDirective],
      providers: [provideHttpClientTesting(), provideTranslateService()],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    })
      .overrideComponent(DateRangeSelectorComponent, {
        remove: {
          imports: [TranslateDirective, TranslatePipe]
        },
        add: {
          imports: [MockTranslateDirective, MockTranslatePipe]
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(DateRangeSelectorComponent);
    component = fixture.componentInstance;

    hostFixture = TestBed.createComponent(TestHostComponent);
    hostComponent = hostFixture.componentInstance;
  });

  describe('Component Initialization', () => {
    test('should create', () => {
      expect(component).toBeTruthy();
    });

    test('should initialize with default values', () => {
      expect(component.startLabel).toBe('history-query.start');
      expect(component.endLabel).toBe('history-query.end');
      expect(component.defaultRange).toBe('last-day');
    });

    test('should initialize predefined ranges', () => {
      expect(component.predefinedRanges).toHaveLength(4);
      expect(component.predefinedRanges[0].key).toBe('last-minute');
      expect(component.predefinedRanges[1].key).toBe('last-10-minutes');
      expect(component.predefinedRanges[2].key).toBe('last-hour');
      expect(component.predefinedRanges[3].key).toBe('last-day');
    });

    test('should initialize internal form with default range', () => {
      expect(component.internalForm.controls.rangeType.value).toBe('last-day');
      expect(component.internalForm.controls.startTime.value).toBeTruthy();
      expect(component.internalForm.controls.endTime.value).toBeTruthy();
    });

    test('should setup form validation on init', () => {
      const startTimeControl = component.internalForm.controls.startTime;
      const endTimeControl = component.internalForm.controls.endTime;

      const spy = vi.spyOn(endTimeControl, 'updateValueAndValidity');

      component.ngOnInit();

      startTimeControl.setValue(DateTime.now().toISO()!);

      expect(spy).toHaveBeenCalledWith({
        emitEvent: false
      });
    });
  });

  describe('Input Properties', () => {
    test('should accept custom start and end labels', () => {
      component.startLabel = 'custom.start.label';
      component.endLabel = 'custom.end.label';

      expect(component.startLabel).toBe('custom.start.label');
      expect(component.endLabel).toBe('custom.end.label');
    });

    test('should accept custom default range', () => {
      component.defaultRange = 'last-hour';

      expect(component.defaultRange).toBe('last-hour');
    });
  });

  describe('Template Rendering', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    test('should render range type select with all options', () => {
      const select = fixture.debugElement.query(By.css('#range-type-select'));
      expect(select).toBeTruthy();

      const options = select.queryAll(By.css('option'));
      expect(options).toHaveLength(5);
    });

    test('should show predefined range info when not custom', () => {
      component.internalForm.controls.rangeType.setValue('last-hour');
      fixture.detectChanges();

      const summary = fixture.debugElement.query(By.css('.range-summary'));
      expect(summary).toBeTruthy();

      const datetimePickers = fixture.debugElement.queryAll(By.css('oib-datetimepicker'));
      expect(datetimePickers).toHaveLength(0);
    });

    test('should show datetime pickers when custom is selected', () => {
      component.internalForm.controls.rangeType.setValue('custom');
      fixture.detectChanges();

      const datetimePickers = fixture.debugElement.queryAll(By.css('oib-datetimepicker'));
      expect(datetimePickers).toHaveLength(2);

      const summary = fixture.debugElement.query(By.css('.range-summary'));
      expect(summary).toBeFalsy();
    });
  });

  describe('Predefined Range Calculations', () => {
    beforeEach(() => {
      vi.spyOn(DateTime, 'now').mockReturnValue(DateTime.utc(2024, 1, 1, 12, 0, 0) as DateTime<true>);
    });

    test('should calculate last minute range correctly', () => {
      const range = component.predefinedRanges[0];
      const result = range.calculate();

      expect(result.startTime).toBe('2024-01-01T11:59:00.000Z');
      expect(result.endTime).toBe('2024-01-01T12:00:00.000Z');
    });

    test('should calculate last 10 minutes range correctly', () => {
      const range = component.predefinedRanges[1];
      const result = range.calculate();

      expect(result.startTime).toBe('2024-01-01T11:50:00.000Z');
      expect(result.endTime).toBe('2024-01-01T12:00:00.000Z');
    });

    test('should calculate last hour range correctly', () => {
      const range = component.predefinedRanges[2];
      const result = range.calculate();

      expect(result.startTime).toBe('2024-01-01T11:00:00.000Z');
      expect(result.endTime).toBe('2024-01-01T12:00:00.000Z');
    });

    test('should calculate last day range correctly', () => {
      const range = component.predefinedRanges[3];
      const result = range.calculate();

      expect(result.startTime).toBe('2023-12-31T12:00:00.000Z');
      expect(result.endTime).toBe('2024-01-01T12:00:00.000Z');
    });
  });

  describe('getCurrentRangeDescription', () => {
    beforeEach(() => {
      vi.spyOn(DateTime, 'now').mockReturnValue(DateTime.utc(2024, 1, 1, 12, 0, 0) as DateTime<true>);
    });

    test('should return formatted range for predefined ranges', () => {
      component.internalForm.controls.rangeType.setValue('last-hour');

      const description = component.getCurrentRangeDescription();

      expect(description).toBeTruthy();
      expect(description).toContain(' - ');
    });

    test('should return custom range description when rangeType is custom', () => {
      component.internalForm.controls.rangeType.setValue('custom');
      component.internalForm.controls.startTime.setValue('2024-01-01T10:00:00.000Z');
      component.internalForm.controls.endTime.setValue('2024-01-01T11:00:00.000Z');

      const description = component.getCurrentRangeDescription();

      expect(description).toBeTruthy();
      expect(description).toContain(' - ');
    });

    test('should return empty string for custom range without dates', () => {
      component.internalForm.controls.rangeType.setValue('custom');
      component.internalForm.controls.startTime.setValue('');
      component.internalForm.controls.endTime.setValue('');

      const description = component.getCurrentRangeDescription();

      expect(description).toBe('');
    });

    test('should return empty string for unknown range type', () => {
      component.internalForm.controls.rangeType.setValue('unknown-range');

      const description = component.getCurrentRangeDescription();

      expect(description).toBe('');
    });
  });

  describe('ControlValueAccessor Implementation', () => {
    let onChangeSpy: ReturnType<typeof vi.fn>;
    let onTouchedSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onChangeSpy = vi.fn();
      onTouchedSpy = vi.fn();

      component.registerOnChange(onChangeSpy as unknown as (value: DateRange) => void);
      component.registerOnTouched(onTouchedSpy as unknown as () => void);
      component.ngOnInit();
    });

    describe('writeValue', () => {
      test('should update form with provided date range', () => {
        const dateRange: DateRange = {
          startTime: '2024-01-01T10:00:00.000Z',
          endTime: '2024-01-01T11:00:00.000Z'
        };

        component.writeValue(dateRange);

        expect(component.internalForm.controls.rangeType.value).toBe('custom');
        expect(component.internalForm.controls.startTime.value).toBe(dateRange.startTime);
        expect(component.internalForm.controls.endTime.value).toBe(dateRange.endTime);
      });

      test('should handle null value', () => {
        const initialRangeType = component.internalForm.controls.rangeType.value;

        component.writeValue(null);

        expect(component.internalForm.controls.rangeType.value).toBe(initialRangeType);
      });
    });

    describe('setDisabledState', () => {
      test('should disable form when disabled is true', () => {
        component.setDisabledState(true);

        expect(component.internalForm.disabled).toBe(true);
      });

      test('should enable form when disabled is false', () => {
        component.setDisabledState(false);

        expect(component.internalForm.disabled).toBe(false);
      });
    });

    describe('Form Changes', () => {
      beforeEach(() => {
        vi.spyOn(DateTime, 'now').mockReturnValue(DateTime.utc(2024, 1, 1, 12, 0, 0) as DateTime<true>);
      });

      test('should emit value when predefined range is selected', () => {
        component.internalForm.controls.rangeType.setValue('last-hour');

        expect(onChangeSpy).toHaveBeenCalledWith({
          startTime: '2024-01-01T11:00:00.000Z',
          endTime: '2024-01-01T12:00:00.000Z'
        });
        expect(onTouchedSpy).toHaveBeenCalled();
      });

      test('should emit the predefined range even when switching from custom mode with past dates', () => {
        component.writeValue({ startTime: '2020-01-01T00:00:00.000Z', endTime: '2020-06-01T00:00:00.000Z' });

        onChangeSpy.mockReset();
        onTouchedSpy.mockReset();

        component.internalForm.controls.rangeType.setValue('last-hour');

        expect(onChangeSpy).toHaveBeenCalledWith({
          startTime: '2024-01-01T11:00:00.000Z',
          endTime: '2024-01-01T12:00:00.000Z'
        });
        expect(onTouchedSpy).toHaveBeenCalled();
      });

      test('should emit value when custom dates are changed', () => {
        const dateRange: DateRange = {
          startTime: '2024-01-01T10:00:00.000Z',
          endTime: '2024-01-01T11:00:00.000Z'
        };

        component.internalForm.patchValue({
          rangeType: 'custom',
          startTime: dateRange.startTime,
          endTime: dateRange.endTime
        });

        expect(onChangeSpy).toHaveBeenCalledWith(dateRange);
        expect(onTouchedSpy).toHaveBeenCalled();
      });

      test('should not emit when form is invalid', () => {
        component.internalForm.controls.rangeType.setErrors({ required: true });
        onChangeSpy.mockReset();
        onTouchedSpy.mockReset();

        component.internalForm.controls.startTime.setValue('2024-01-01T10:00:00.000Z');

        expect(onChangeSpy).not.toHaveBeenCalled();
        expect(onTouchedSpy).not.toHaveBeenCalled();
      });

      test('should update internal form controls when predefined range is selected', () => {
        component.internalForm.controls.rangeType.setValue('last-minute');

        expect(component.internalForm.controls.startTime.value).toBe('2024-01-01T11:59:00.000Z');
        expect(component.internalForm.controls.endTime.value).toBe('2024-01-01T12:00:00.000Z');
      });
    });
  });

  describe('Integration with TestHost', () => {
    beforeEach(() => {
      hostFixture.detectChanges();
    });

    test('should work as a form control', () => {
      const dateRangeSelector = hostFixture.debugElement.query(By.directive(DateRangeSelectorComponent));
      expect(dateRangeSelector).toBeTruthy();

      const componentInstance = dateRangeSelector.componentInstance;
      expect(componentInstance).toBeInstanceOf(DateRangeSelectorComponent);
    });

    test('should respect input properties from host', () => {
      const dateRangeSelector = hostFixture.debugElement.query(By.directive(DateRangeSelectorComponent)).componentInstance;

      expect(dateRangeSelector.startLabel).toBe('custom.start');
      expect(dateRangeSelector.endLabel).toBe('custom.end');
      expect(dateRangeSelector.defaultRange).toBe('last-hour');
    });

    test('should update parent form when value changes', () => {
      const dateRangeSelector = hostFixture.debugElement.query(By.directive(DateRangeSelectorComponent)).componentInstance;

      dateRangeSelector.internalForm.controls.rangeType.setValue('last-hour');

      expect(hostComponent.testForm.controls.dateRange.value).toBeTruthy();
    });

    test('should default to the bound `defaultRange` preset (not "custom") and sync it to the parent form without any interaction', () => {
      // Host starts with a null dateRange and defaultRange = 'last-hour' (see TestHostComponent above).
      const dateRangeSelector = hostFixture.debugElement.query(By.directive(DateRangeSelectorComponent)).componentInstance;

      expect(dateRangeSelector.internalForm.controls.rangeType.value).toBe('last-hour');
      expect(hostComponent.testForm.controls.dateRange.value).toBeTruthy();
      expect(hostComponent.testForm.valid).toBe(true);
    });
  });

  describe('Component Destruction', () => {
    test('should complete destroy subject on ngOnDestroy', () => {
      const destroySpy = vi.spyOn((component as any)['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(destroySpy).toHaveBeenCalled();
    });

    test('should unsubscribe from observables on destroy', () => {
      const nextSpy = vi.spyOn((component as any)['destroy$'], 'next');

      component.ngOnDestroy();

      expect(nextSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle invalid predefined range key', () => {
      component.internalForm.controls.rangeType.setValue('invalid-range');

      expect(() => component.getCurrentRangeDescription()).not.toThrow();
    });

    test('should handle empty predefined ranges array', () => {
      component.predefinedRanges = [];

      const description = component.getCurrentRangeDescription();
      expect(description).toBe('');
    });
  });

  describe('Validation Cross-References', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    test('should trigger end time validation when start time changes', () => {
      const endTimeControl = component.internalForm.controls.endTime;
      const spy = vi.spyOn(endTimeControl, 'updateValueAndValidity');

      component.internalForm.controls.startTime.setValue('2024-01-01T10:00:00.000Z');

      expect(spy).toHaveBeenCalledWith({ emitEvent: false });
    });

    test('should trigger start time validation when end time changes', () => {
      const startTimeControl = component.internalForm.controls.startTime;
      const spy = vi.spyOn(startTimeControl, 'updateValueAndValidity');

      component.internalForm.controls.endTime.setValue('2024-01-01T11:00:00.000Z');

      expect(spy).toHaveBeenCalledWith({ emitEvent: false });
    });
  });
});
