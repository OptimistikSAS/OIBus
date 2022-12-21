import { TestBed } from '@angular/core/testing';

import { DefaultValidationErrorsComponent } from './default-validation-errors.component';
import { Component } from '@angular/core';
import { FormGroup, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ComponentTester } from 'ngx-speculoos';
import { ValdemortModule } from 'ngx-valdemort';
import { MockI18nModule } from '../../../../i18n/mock-i18n.spec';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  template: `
    <oib-default-validation-errors></oib-default-validation-errors>
    <form [formGroup]="form">
      <input formControlName="name" />
      <val-errors controlName="name"></val-errors>

      <input formControlName="age" type="number" id="age" />
      <val-errors controlName="age" [label]="'common.save' | translate"></val-errors>

      <button id="submit">Submit</button>
    </form>
  `,
  standalone: true,
  imports: [ValdemortModule, TranslateModule, ReactiveFormsModule, DefaultValidationErrorsComponent]
})
class TestComponent {
  form: FormGroup;

  constructor(fb: UntypedFormBuilder) {
    this.form = fb.group({
      name: ['', Validators.required],
      age: [null, Validators.min(18)]
    });
  }
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get age() {
    return this.input('#age')!;
  }

  get submit() {
    return this.button('#submit')!;
  }
}

describe('DefaultValidationErrorsComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MockI18nModule, ValdemortModule, ReactiveFormsModule, DefaultValidationErrorsComponent, TestComponent]
    });

    tester = new TestComponentTester();
    tester.detectChanges();
  });

  it('should display validation error with default message', () => {
    expect(tester.testElement).not.toContainText('This field is required');
    tester.submit.click();
    expect(tester.testElement).toContainText('This field is required');
  });

  it('should display validation error with i18ned labeled message', () => {
    expect(tester.testElement).not.toContainText('Save must be at least 18');
    tester.age.fillWith('15');
    tester.age.dispatchEventOfType('blur');
    expect(tester.testElement).toContainText('Save must be at least 18');
  });
});
