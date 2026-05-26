import { TestBed } from '@angular/core/testing';

import { DefaultValidationErrorsComponent } from './default-validation-errors.component';
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ComponentTester } from 'ngx-speculoos';
import { ValdemortModule } from 'ngx-valdemort';
import { TranslatePipe } from '@ngx-translate/core';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { beforeEach, describe, expect, test } from 'vitest';

@Component({
  selector: 'oib-test-default-validation-errors-component',
  template: `
    <oib-default-validation-errors />
    <form [formGroup]="form">
      <input formControlName="name" />
      <val-errors controlName="name" />

      <input formControlName="age" type="number" id="age" />
      <val-errors controlName="age" [label]="'common.save' | translate" />

      <button id="submit">Submit</button>
    </form>
  `,
  imports: [ValdemortModule, ReactiveFormsModule, DefaultValidationErrorsComponent, TranslatePipe]
})
class TestComponent {
  form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    age: [null, Validators.min(18)]
  });
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

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    await tester.change();
  });

  test('should display validation error with default message', async () => {
    expect(tester.testElement.textContent).not.toContain('This field is required');
    await tester.submit.click();
    expect(tester.testElement.textContent).toContain('This field is required');
  });

  test('should display validation error with i18ned labeled message', async () => {
    expect(tester.testElement.textContent).not.toContain('Save must be at least 18');
    await tester.age.fillWith('15');
    await tester.age.dispatchEventOfType('blur');
    expect(tester.testElement.textContent).toContain('Save must be at least 18');
  });
});
