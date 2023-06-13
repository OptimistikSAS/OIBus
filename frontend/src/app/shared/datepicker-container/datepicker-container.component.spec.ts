import { UntypedFormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { NgbDatepicker, NgbInputDatepicker } from '@ng-bootstrap/ng-bootstrap';
import { ComponentTester } from 'ngx-speculoos';
import { noAnimation } from '../test-utils';
import { DatepickerContainerComponent } from './datepicker-container.component';
import { formDirectives } from '../form-directives';

@Component({
  template: `
    <oib-datepicker-container class="foo">
      <input class="form-control" [formControl]="dateCtrl" ngbDatepicker />
    </oib-datepicker-container>
  `,
  imports: [DatepickerContainerComponent, ...formDirectives, NgbInputDatepicker],
  standalone: true
})
class TestComponent {
  dateCtrl = new UntypedFormControl();
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get toggle() {
    return this.button('.datepicker-toggle')!;
  }

  get inputDatepicker() {
    return this.element(NgbInputDatepicker)!;
  }

  get datepicker() {
    return this.element(NgbDatepicker)!;
  }

  get container() {
    return this.element('oib-datepicker-container')!;
  }
}

describe('DatepickerContainerComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [noAnimation]
    });

    tester = new TestComponentTester();
    tester.detectChanges();
  });

  it('should display an input, a toggle button, and toggle the datepicker', () => {
    expect(tester.toggle).not.toBeNull();
    expect(tester.inputDatepicker).not.toBeNull();
    expect(tester.datepicker).toBeNull();

    tester.toggle.click();
    expect(tester.datepicker).not.toBeNull();

    tester.toggle.click();
    expect(tester.datepicker).toBeNull();
  });

  it('should have the input-group class in addition to its original class', () => {
    expect(tester.container).toHaveClass('input-group');
    expect(tester.container).toHaveClass('foo');
  });
});
