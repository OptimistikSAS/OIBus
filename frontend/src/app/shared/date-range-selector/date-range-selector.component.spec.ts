import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormControl, Validators, FormBuilder } from '@angular/forms';
import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, Input, Directive, Pipe, PipeTransform } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DateTime } from 'luxon';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { DateRangeSelectorComponent, DateRange } from './date-range-selector.component';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

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
  template: `
    <form [formGroup]="testForm">
      <oib-date-range-selector formControlName="dateRange" [startLabel]="startLabel" [endLabel]="endLabel" [defaultRange]="defaultRange" />
    </form>
  `,
  standalone: true,
  imports: [ReactiveFormsModule, DateRangeSelectorComponent]
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
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.startLabel).toBe('history-query.start');
      expect(component.endLabel).toBe('history-query.end');
      expect(component.defaultRange).toBe('last-day');
    });

    it('should initialize predefined ranges', () => {
      expect(component.predefinedRanges).toHaveSize(4);
      expect(component.predefinedRanges[0].key).toBe('last-minute');
      expect(component.predefinedRanges[1].key).toBe('last-10-minutes');
      expect(component.predefinedRanges[2].key).toBe('last-hour');
      expect(component.predefinedRanges[3].key).toBe('last-day');
    });

    it('should initialize internal form with default range', () => {
      expect(component.internalForm.controls.rangeType.value).toBe('last-day');
      expect(component.internalForm.controls.startTime.value).toBeTruthy();
      expect(component.internalForm.controls.endTime.value).toBeTruthy();
    });

    it('should setup form validation on init', () => {
      const startTimeControl = component.internalForm.controls.startTime;
      const endTimeControl = component.internalForm.controls.endTime;

      spyOn(endTimeControl, 'updateValueAndValidity');

      component.ngOnInit();

      startTimeControl.setValue(DateTime.now().toISO()!);

      expect(endTimeControl.updateValueAndValidity).toHaveBeenCalledWith({
        emitEvent: false
      });
    });
  });

  describe('Input Properties', () => {
    it('should accept custom start and end labels', () => {
      component.startLabel = 'custom.start.label';
      component.endLabel = 'custom.end.label';

      expect(component.startLabel).toBe('custom.start.label');
      expect(component.endLabel).toBe('custom.end.label');
    });

    it('should accept custom default range', () => {
      component.defaultRange = 'last-hour';

      expect(component.defaultRange).toBe('last-hour');
    });
  });

  describe('Template Rendering', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should render range type select with all options', () => {
      const select = fixture.debugElement.query(By.css('#range-type-select'));
      expect(select).toBeTruthy();

      const options = select.queryAll(By.css('option'));
      expect(options).toHaveSize(5); // 4 predefined + 1 custom
    });

    it('should show predefined range info when not custom', () => {
      component.internalForm.controls.rangeType.setValue('last-hour');
      fixture.detectChanges();

      const alert = fixture.debugElement.query(By.css('.alert-info'));
      expect(alert).toBeTruthy();

      const datetimePickers = fixture.debugElement.queryAll(By.css('oib-datetimepicker'));
      expect(datetimePickers).toHaveSize(0);
    });

    it('should show datetime pickers when custom is selected', () => {
      component.internalForm.controls.rangeType.setValue('custom');
      fixture.detectChanges();

      const datetimePickers = fixture.debugElement.queryAll(By.css('oib-datetimepicker'));
      expect(datetimePickers).toHaveSize(2);

      const alert = fixture.debugElement.query(By.css('.alert-info'));
      expect(alert).toBeFalsy();
    });
  });

  describe('Predefined Range Calculations', () => {
    beforeEach(() => {
      spyOn(DateTime, 'now').and.returnValue(DateTime.fromISO('2024-01-01T12:00:00.000Z') as DateTime);
    });

    it('should calculate last minute range correctly', () => {
      const range = component.predefinedRanges[0];
      const result = range.calculate();

      expect(result.startTime).toBe('2024-01-01T11:59:00.000Z');
      expect(result.endTime).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should calculate last 10 minutes range correctly', () => {
      const range = component.predefinedRanges[1];
      const result = range.calculate();

      expect(result.startTime).toBe('2024-01-01T11:50:00.000Z');
      expect(result.endTime).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should calculate last hour range correctly', () => {
      const range = component.predefinedRanges[2];
      const result = range.calculate();

      expect(result.startTime).toBe('2024-01-01T11:00:00.000Z');
      expect(result.endTime).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should calculate last day range correctly', () => {
      const range = component.predefinedRanges[3];
      const result = range.calculate();

      expect(result.startTime).toBe('2023-12-31T12:00:00.000Z');
      expect(result.endTime).toBe('2024-01-01T12:00:00.000Z');
    });
  });

  describe('getCurrentRangeDescription', () => {
    beforeEach(() => {
      spyOn(DateTime, 'now').and.returnValue(DateTime.fromISO('2024-01-01T12:00:00.000Z') as DateTime);
    });

    it('should return formatted range for predefined ranges', () => {
      component.internalForm.controls.rangeType.setValue('last-hour');

      const description = component.getCurrentRangeDescription();

      expect(description).toBeTruthy();
      expect(description).toContain(' - ');
    });

    it('should return custom range description when rangeType is custom', () => {
      component.internalForm.controls.rangeType.setValue('custom');
      component.internalForm.controls.startTime.setValue('2024-01-01T10:00:00.000Z');
      component.internalForm.controls.endTime.setValue('2024-01-01T11:00:00.000Z');

      const description = component.getCurrentRangeDescription();

      expect(description).toBeTruthy();
      expect(description).toContain(' - ');
    });

    it('should return empty string for custom range without dates', () => {
      component.internalForm.controls.rangeType.setValue('custom');
      component.internalForm.controls.startTime.setValue('');
      component.internalForm.controls.endTime.setValue('');

      const description = component.getCurrentRangeDescription();

      expect(description).toBe('');
    });

    it('should return empty string for unknown range type', () => {
      component.internalForm.controls.rangeType.setValue('unknown-range');

      const description = component.getCurrentRangeDescription();

      expect(description).toBe('');
    });
  });

  describe('ControlValueAccessor Implementation', () => {
    let onChangeSpy: jasmine.Spy;
    let onTouchedSpy: jasmine.Spy;

    beforeEach(() => {
      onChangeSpy = jasmine.createSpy('onChangeSpy');
      onTouchedSpy = jasmine.createSpy('onTouchedSpy');

      component.registerOnChange(onChangeSpy);
      component.registerOnTouched(onTouchedSpy);
      component.ngOnInit();
    });

    describe('writeValue', () => {
      it('should update form with provided date range', () => {
        const dateRange: DateRange = {
          startTime: '2024-01-01T10:00:00.000Z',
          endTime: '2024-01-01T11:00:00.000Z'
        };

        component.writeValue(dateRange);

        expect(component.internalForm.controls.rangeType.value).toBe('custom');
        expect(component.internalForm.controls.startTime.value).toBe(dateRange.startTime);
        expect(component.internalForm.controls.endTime.value).toBe(dateRange.endTime);
      });

      it('should handle null value', () => {
        const initialRangeType = component.internalForm.controls.rangeType.value;

        component.writeValue(null);

        expect(component.internalForm.controls.rangeType.value).toBe(initialRangeType);
      });
    });

    describe('setDisabledState', () => {
      it('should disable form when disabled is true', () => {
        component.setDisabledState(true);

        expect(component.internalForm.disabled).toBe(true);
      });

      it('should enable form when disabled is false', () => {
        component.setDisabledState(false);

        expect(component.internalForm.disabled).toBe(false);
      });
    });

    describe('Form Changes', () => {
      beforeEach(() => {
        spyOn(DateTime, 'now').and.returnValue(DateTime.fromISO('2024-01-01T12:00:00.000Z') as DateTime);
      });

      it('should emit value when predefined range is selected', () => {
        component.internalForm.controls.rangeType.setValue('last-hour');

        expect(onChangeSpy).toHaveBeenCalledWith({
          startTime: '2024-01-01T11:00:00.000Z',
          endTime: '2024-01-01T12:00:00.000Z'
        });
        expect(onTouchedSpy).toHaveBeenCalled();
      });

      it('should emit value when custom dates are changed', () => {
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

      it('should not emit when form is invalid', () => {
        component.internalForm.controls.rangeType.setErrors({ required: true });
        onChangeSpy.calls.reset();
        onTouchedSpy.calls.reset();

        component.internalForm.controls.startTime.setValue('2024-01-01T10:00:00.000Z');

        expect(onChangeSpy).not.toHaveBeenCalled();
        expect(onTouchedSpy).not.toHaveBeenCalled();
      });

      it('should update internal form controls when predefined range is selected', () => {
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

    it('should work as a form control', () => {
      const dateRangeSelector = hostFixture.debugElement.query(By.directive(DateRangeSelectorComponent));
      expect(dateRangeSelector).toBeTruthy();

      const componentInstance = dateRangeSelector.componentInstance;
      expect(componentInstance).toBeInstanceOf(DateRangeSelectorComponent);
    });

    it('should respect input properties from host', () => {
      const dateRangeSelector = hostFixture.debugElement.query(By.directive(DateRangeSelectorComponent)).componentInstance;

      expect(dateRangeSelector.startLabel).toBe('custom.start');
      expect(dateRangeSelector.endLabel).toBe('custom.end');
      expect(dateRangeSelector.defaultRange).toBe('last-hour');
    });

    it('should update parent form when value changes', () => {
      const dateRangeSelector = hostFixture.debugElement.query(By.directive(DateRangeSelectorComponent)).componentInstance;

      dateRangeSelector.internalForm.controls.rangeType.setValue('last-hour');

      expect(hostComponent.testForm.controls.dateRange.value).toBeTruthy();
    });
  });

  describe('Component Destruction', () => {
    it('should complete destroy subject on ngOnDestroy', () => {
      const destroySpy = spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(destroySpy).toHaveBeenCalled();
    });

    it('should unsubscribe from observables on destroy', () => {
      const nextSpy = spyOn(component['destroy$'], 'next');

      component.ngOnDestroy();

      expect(nextSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid predefined range key', () => {
      component.internalForm.controls.rangeType.setValue('invalid-range');

      expect(() => component.getCurrentRangeDescription()).not.toThrow();
    });

    it('should handle empty predefined ranges array', () => {
      component.predefinedRanges = [];

      const description = component.getCurrentRangeDescription();
      expect(description).toBe('');
    });
  });

  describe('Validation Cross-References', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should trigger end time validation when start time changes', () => {
      const endTimeControl = component.internalForm.controls.endTime;
      const spy = spyOn(endTimeControl, 'updateValueAndValidity');

      component.internalForm.controls.startTime.setValue('2024-01-01T10:00:00.000Z');

      expect(spy).toHaveBeenCalledWith({ emitEvent: false });
    });

    it('should trigger start time validation when end time changes', () => {
      const startTimeControl = component.internalForm.controls.startTime;
      const spy = spyOn(startTimeControl, 'updateValueAndValidity');

      component.internalForm.controls.endTime.setValue('2024-01-01T11:00:00.000Z');

      expect(spy).toHaveBeenCalledWith({ emitEvent: false });
    });
  });
});
