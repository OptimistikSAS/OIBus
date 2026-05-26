import { TestBed } from '@angular/core/testing';

import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ComponentTester } from 'ngx-speculoos';
import { TestDatetimepicker } from './datetimepicker.test-utils';
import { DatepickerContainerComponent } from '../datepicker-container/datepicker-container.component';
import { DatetimepickerComponent } from './datetimepicker.component';
import { NgbInputDatepicker, NgbTimepicker } from '@ng-bootstrap/ng-bootstrap';
import { provideNgbConfigTesting } from '../form/oi-ngb-testing';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { provideCurrentUser } from '../current-user-testing-vitest';
import { beforeEach, describe, expect, test } from 'vitest';

@Component({
  selector: 'oib-test-datetimepicker-component',
  template: '',
  imports: [ReactiveFormsModule]
})
class TestComponent {
  private fb = inject(NonNullableFormBuilder);

  form = this.fb.group({
    from: null as string | null
  });
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get datetimepicker() {
    return this.custom('oib-datetimepicker', TestDatetimepicker)!;
  }

  get toggler() {
    return this.element<HTMLSpanElement>('.fa-calendar')!;
  }

  get firstWeekDay() {
    return this.element('.ngb-dp-weekday');
  }
}

describe('DatetimepickerComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideNgbConfigTesting(), provideI18nTesting(), provideCurrentUser()]
    });
  });

  describe('with default templates', () => {
    beforeEach(async () => {
      TestBed.overrideTemplate(
        TestComponent,
        `
        <form [formGroup]="form">
          <oib-datetimepicker formControlName="from"></oib-datetimepicker>
        </form>`
      );
      TestBed.overrideComponent(TestComponent, {
        add: {
          imports: [DatetimepickerComponent]
        }
      });
      tester = new TestComponentTester();
      await tester.change();
    });

    test('should display an empty date and 00:00 by default', () => {
      expect(tester.datetimepicker.date.nativeElement.value).toBe('');
      expect(tester.datetimepicker.hour.nativeElement.value).toBe('00');
      expect(tester.datetimepicker.minute.nativeElement.value).toBe('00');
      expect(tester.datetimepicker.second).toBeFalsy();

      expect(tester.componentInstance.form.value.from).toBeNull();
    });

    test('should allow entering a date and a time', () => {
      tester.datetimepicker.fillWith('02/10/2019');

      expect(tester.componentInstance.form.value.from).toBe('2019-10-01T22:00:00.000Z');
    });

    test('should display form control value', async () => {
      tester.componentInstance.form.setValue({ from: '2019-10-02T14:15:00Z' });
      await tester.change();

      expect(tester.datetimepicker.displayedValue).toBe('02/10/2019 16:15');
    });

    test('should have null as model when missing piece', () => {
      tester.datetimepicker.fillWith('02/10/2019', '00', '');

      expect(tester.componentInstance.form.value.from).toBeNull();
    });

    test('should become touched when an input is blurred', () => {
      expect(tester.componentInstance.form.touched).toBe(false);

      tester.datetimepicker.minute.dispatchEventOfType('blur');

      expect(tester.componentInstance.form.touched).toBe(true);
    });

    test('should become disabled when the control is disabled', async () => {
      expect(tester.componentInstance.form.touched).toBe(false);

      tester.componentInstance.form.disable();
      await tester.change();

      expect(tester.datetimepicker.date.nativeElement.disabled).toBe(true);
      expect(tester.datetimepicker.hour.nativeElement.disabled).toBe(true);
      expect(tester.datetimepicker.minute.nativeElement.disabled).toBe(true);
    });

    test('should validate the date and propagate the error', async () => {
      tester.datetimepicker.fillWith('02/13/2019', '00', '00');

      await tester.change();

      expect(tester.componentInstance.form.value.from).toBeNull();
      expect(tester.componentInstance.form.get('from')!.getError('ngbDate')).not.toBeNull();
    });
  });

  describe('with timezone', () => {
    beforeEach(async () => {
      TestBed.overrideTemplate(
        TestComponent,
        `
        <form [formGroup]="form">
          <oib-datetimepicker timezone="UTC" formControlName="from"></oib-datetimepicker>
        </form>`
      );
      TestBed.overrideComponent(TestComponent, {
        add: {
          imports: [DatetimepickerComponent]
        }
      });
      tester = new TestComponentTester();
      await tester.change();
    });

    test('should allow entering a date and a time', () => {
      tester.datetimepicker.fillWith('02/10/2019');

      expect(tester.componentInstance.form.value.from).toBe('2019-10-02T00:00:00.000Z');
    });

    test('should display form control value', async () => {
      tester.componentInstance.form.setValue({ from: '2019-10-02T14:15:00Z' });
      await tester.change();

      expect(tester.datetimepicker.displayedValue).toBe('02/10/2019 14:15');
    });
  });

  describe('with custom templates', () => {
    beforeEach(async () => {
      TestBed.overrideTemplate(
        TestComponent,
        `
        <form [formGroup]="form">
          <oib-datetimepicker formControlName="from">
            <ng-template #date let-formControl>
              <oib-datepicker-container>
                <input [formControl]="formControl" [firstDayOfWeek]="7" class="form-control" ngbDatepicker />
              </oib-datepicker-container>
            </ng-template>
            <ng-template #time let-formControl>
              <ngb-timepicker [formControl]="formControl" [seconds]="true"></ngb-timepicker>
            </ng-template>
          </oib-datetimepicker>
        </form>`
      );
      TestBed.overrideComponent(TestComponent, {
        add: {
          imports: [DatetimepickerComponent, DatepickerContainerComponent, NgbInputDatepicker, NgbTimepicker]
        }
      });
      tester = new TestComponentTester();
      await tester.change();
    });

    test('should use custom templates', () => {
      expect(tester.datetimepicker.second).toBeTruthy();
      expect(tester.datetimepicker.second!.nativeElement.value).toBe('00');

      tester.toggler.click();
      expect(tester.firstWeekDay!.textContent).toContain('S');
    });
  });
});
