import { ReactiveFormsModule, UntypedFormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgbInputDatepicker } from '@ng-bootstrap/ng-bootstrap';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { noAnimation } from '../test-utils';
import { DatepickerContainerComponent } from './datepicker-container.component';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  selector: 'oib-test-datepicker-container-component',
  template: `
    <oib-datepicker-container class="foo">
      <input class="form-control" [formControl]="dateCtrl" ngbDatepicker />
    </oib-datepicker-container>
  `,
  imports: [DatepickerContainerComponent, ReactiveFormsModule, NgbInputDatepicker],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  dateCtrl = new UntypedFormControl();
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly toggle = this.root.getByCss('.datepicker-toggle');
  readonly inputDatepicker = this.root.getByCss('input[ngbdatepicker]');
  readonly datepicker = page.getByCss('ngb-datepicker');
  readonly container = this.root.getByCss('oib-datepicker-container');
}

describe('DatepickerContainerComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [noAnimation, provideI18nTesting()]
    });

    tester = new TestComponentTester();
  });

  test('should display an input, a toggle button, and toggle the datepicker', async () => {
    await expect.element(tester.toggle).toBeInTheDocument();
    await expect.element(tester.inputDatepicker).toBeInTheDocument();
    await expect.element(tester.datepicker).not.toBeInTheDocument();

    await tester.toggle.click();
    await expect.element(tester.datepicker).toBeInTheDocument();

    await tester.toggle.click();
    await expect.element(tester.datepicker).not.toBeInTheDocument();
  });

  test('should have the input-group class in addition to its original class', async () => {
    await expect.element(tester.container).toHaveClass('input-group');
    await expect.element(tester.container).toHaveClass('foo');
  });
});
