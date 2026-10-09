import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { NgbInputDatepicker, NgbTimepicker } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { provideCurrentUser } from '../current-user-testing';
import { DatepickerContainerComponent } from '../datepicker-container/datepicker-container.component';
import { provideNgbConfigTesting } from '../form/oi-ngb-testing';
import { DatetimepickerComponent } from './datetimepicker.component';

@Component({
  selector: 'oib-test-datetimepicker-component',
  template: '',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({
    from: null as string | null
  });
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly datetimepicker = page.getByCss('oib-datetimepicker');
  readonly date = this.datetimepicker.getByCss('input').nth(0);
  readonly hour = this.datetimepicker.getByCss('input').nth(1);
  readonly minute = this.datetimepicker.getByCss('input').nth(2);
  readonly second = this.datetimepicker.getByCss('input').nth(3);
  readonly toggler = page.getByCss('.fa-calendar-days');
  readonly firstWeekDay = page.getByCss('.ngb-dp-weekday').nth(0);
}

describe('DatetimepickerComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideNgbConfigTesting(), provideI18nTesting(), provideCurrentUser()]
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
      TestBed.overrideComponent(TestComponent, {
        add: {
          imports: [DatetimepickerComponent]
        }
      });
      tester = new TestComponentTester();
    });

    test('should display an empty date and 00:00 by default', async () => {
      await expect.element(tester.date).toHaveValue('');
      await expect.element(tester.hour).toHaveValue('00');
      await expect.element(tester.minute).toHaveValue('00');
      await expect.element(tester.second).not.toBeInTheDocument();

      expect(tester.componentInstance.form.value.from).toBeNull();
    });

    test('should allow entering a date and a time', async () => {
      await tester.datetimepicker.fillWithDate('02/10/2019');

      expect(tester.componentInstance.form.value.from).toBe('2019-10-01T22:00:00.000Z');
    });

    test('should display form control value', async () => {
      tester.componentInstance.form.setValue({ from: '2019-10-02T14:15:00Z' });

      await expect.element(tester.datetimepicker).toHaveDisplayedDate('02/10/2019 16:15');
    });

    test('should have null as model when missing piece', async () => {
      await tester.datetimepicker.fillWithDate('02/10/2019', '00', '00');
      expect(tester.componentInstance.form.value.from).not.toBeNull();

      await tester.minute.fill('');
      tester.minute.element().dispatchEvent(new Event('change', { bubbles: true }));

      await vi.waitFor(() => expect(tester.componentInstance.form.value.from).toBeNull());
    });

    test('should become touched when an input is blurred', async () => {
      expect(tester.fixture.componentInstance.form.touched).toBe(false);

      await expect.element(tester.minute).toBeInTheDocument();

      tester.minute.element().dispatchEvent(new Event('blur'));

      expect(tester.fixture.componentInstance.form.touched).toBe(true);
    });

    test('should become disabled when the control is disabled', async () => {
      tester.componentInstance.form.disable();

      await expect.element(tester.date).toBeDisabled();
      await expect.element(tester.hour).toBeDisabled();
      await expect.element(tester.minute).toBeDisabled();

      tester.componentInstance.form.enable();

      await expect.element(tester.date).toBeEnabled();
      await expect.element(tester.hour).toBeEnabled();
    });

    test('should validate the date and propagate the error', async () => {
      await tester.datetimepicker.fillWithDate('02/13/2019', '00', '00');

      expect(tester.componentInstance.form.value.from).toBeNull();
      expect(tester.componentInstance.form.get('from')!.getError('ngbDate')).not.toBeNull();
    });
  });

  describe('with label', () => {
    beforeEach(() => {
      TestBed.overrideTemplate(
        TestComponent,
        `<form [formGroup]="form"><oib-datetimepicker label="history-query.query-time-range.start" formControlName="from" /></form>`
      );
      TestBed.overrideComponent(TestComponent, { add: { imports: [DatetimepickerComponent] } });
      tester = new TestComponentTester();
    });

    test('should label the date input', async () => {
      await expect.element(page.getByLabelText('Start')).toHaveAttribute('ngbdatepicker');
      await page.getByLabelText('Start').fill('02/10/2019');
      await expect.element(tester.date).toHaveValue('02/10/2019');
    });
  });

  describe('with timezone', () => {
    beforeEach(() => {
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
    });

    test('should allow entering a date and a time', async () => {
      await tester.datetimepicker.fillWithDate('02/10/2019');

      expect(tester.componentInstance.form.value.from).toBe('2019-10-02T00:00:00.000Z');
    });

    test('should display form control value', async () => {
      tester.componentInstance.form.setValue({ from: '2019-10-02T14:15:00Z' });

      await expect.element(tester.datetimepicker).toHaveDisplayedDate('02/10/2019 14:15');
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
      TestBed.overrideComponent(TestComponent, {
        add: {
          imports: [DatetimepickerComponent, DatepickerContainerComponent, NgbInputDatepicker, NgbTimepicker]
        }
      });
      tester = new TestComponentTester();
    });

    test('should use custom templates', async () => {
      await expect.element(tester.second).toHaveValue('00');

      await tester.toggler.click();
      await expect.element(tester.firstWeekDay).toHaveTextContent('S');
    });
  });
});
