import { TestBed } from '@angular/core/testing';

import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ComponentTester } from 'ngx-speculoos';
import { TestDatetimepicker } from './datetimepicker.test-utils';
import { noAnimation } from '../test-utils';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { formDirectives } from '../form-directives';
import { DatetimepickerComponent } from './datetimepicker.component';
import { provideDatepicker } from '../datepicker.providers';
import { DatepickerContainerComponent } from '../datepicker-container/datepicker-container.component';
import { NgbInputDatepicker, NgbTimepicker } from '@ng-bootstrap/ng-bootstrap';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  template: '',
  standalone: true,
  imports: [
    DatetimepickerComponent,
    DatepickerContainerComponent,
    NgTemplateOutlet,
    NgbInputDatepicker,
    NgbTimepicker,
    ...formDirectives,
    MockI18nModule
  ],
  providers: [noAnimation, provideDatepicker()]
})
class TestComponent {
  form: FormGroup;
  constructor(fb: FormBuilder) {
    this.form = fb.group({
      from: null as string | null
    });
  }
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get datetimepicker() {
    return this.custom('oib-datetimepicker', TestDatetimepicker)!;
  }

  get toggle() {
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
      imports: [TestComponent]
    });
  });

  describe('with default templates', () => {
    beforeEach(() => {
      TestBed.overrideTemplate(
        TestComponent,
        `
        <form [formGroup]="form">
          <oib-datetimepicker formControlName="from"></oib-datetimepicker>
        </form>`
      );
      tester = new TestComponentTester();
      tester.detectChanges();
    });

    it('should display an empty date and 00:00 by default', () => {
      expect(tester.datetimepicker.date).toHaveValue('');
      expect(tester.datetimepicker.hour).toHaveValue('00');
      expect(tester.datetimepicker.minute).toHaveValue('00');
      expect(tester.datetimepicker.second).toBeFalsy();

      expect(tester.componentInstance.form.value.from).toBeNull();
    });

    it('should allow entering a date and a time', () => {
      tester.datetimepicker.fillWith('02/10/2019');

      expect(tester.componentInstance.form.value.from).toBe('2019-10-01T22:00:00.000Z');
    });

    it('should display form control value', () => {
      tester.componentInstance.form.setValue({ from: '2019-10-02T14:15:00Z' });
      tester.detectChanges();

      expect(tester.datetimepicker.displayedValue).toBe('02/10/2019 16:15');
    });

    it('should have null as model when missing piece', () => {
      tester.datetimepicker.fillWith('02/10/2019', '00', '');

      expect(tester.componentInstance.form.value.from).toBeNull();
    });

    it('should become touched when an input is blurred', () => {
      expect(tester.componentInstance.form.touched).toBe(false);

      tester.datetimepicker.minute.dispatchEventOfType('blur');

      expect(tester.componentInstance.form.touched).toBe(true);
    });

    it('should become disabled when the control is disabled', () => {
      expect(tester.componentInstance.form.touched).toBe(false);

      tester.componentInstance.form.disable();
      tester.detectChanges();

      expect(tester.datetimepicker.date.disabled).toBe(true);
      expect(tester.datetimepicker.hour.disabled).toBe(true);
      expect(tester.datetimepicker.minute.disabled).toBe(true);
    });

    it('should validate the date and propagate the error', () => {
      tester.datetimepicker.fillWith('02/13/2019', '00', '00');

      tester.detectChanges();

      expect(tester.componentInstance.form.value.from).toBeNull();
      expect(tester.componentInstance.form.get('from')!.getError('ngbDate')).not.toBeNull();
    });
  });

  describe('with timeZone', () => {
    beforeEach(() => {
      TestBed.overrideTemplate(
        TestComponent,
        `
        <form [formGroup]="form">
          <oib-datetimepicker timeZone="UTC" formControlName="from"></oib-datetimepicker>
        </form>`
      );
      tester = new TestComponentTester();
      tester.detectChanges();
    });

    it('should allow entering a date and a time', () => {
      tester.datetimepicker.fillWith('02/10/2019');

      expect(tester.componentInstance.form.value.from).toBe('2019-10-02T00:00:00.000Z');
    });

    it('should display form control value', () => {
      tester.componentInstance.form.setValue({ from: '2019-10-02T14:15:00Z' });
      tester.detectChanges();

      expect(tester.datetimepicker.displayedValue).toBe('02/10/2019 14:15');
    });
  });

  describe('with custom templates', () => {
    beforeEach(() => {
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
      tester = new TestComponentTester();
      tester.detectChanges();
    });

    it('should use custom templates', () => {
      expect(tester.datetimepicker.second).toBeTruthy();
      expect(tester.datetimepicker.second).toHaveValue('00');

      tester.toggle.click();
      expect(tester.firstWeekDay).toContainText('Su');
    });
  });
});
