import { TestBed } from '@angular/core/testing';

import { DefaultValidationErrorsComponent } from './default-validation-errors.component';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ValdemortModule } from 'ngx-valdemort';
import { TranslatePipe } from '@ngx-translate/core';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

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
  imports: [ValdemortModule, ReactiveFormsModule, DefaultValidationErrorsComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    age: [null, Validators.min(18)]
  });
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly age = this.root.getByCss('#age');
  readonly submit = this.root.getByRole('button', { name: 'Submit' });
}

describe('DefaultValidationErrorsComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    tester.fixture.detectChanges();
  });

  test('should display validation error with default message', async () => {
    await expect.element(tester.root).not.toHaveTextContent('This field is required');
    await tester.submit.click();
    tester.fixture.detectChanges();
    await expect.element(tester.root).toHaveTextContent('This field is required');
  });

  test('should display validation error with i18ned labeled message', async () => {
    await expect.element(tester.root).not.toHaveTextContent('Save must be at least 18');
    await tester.age.fill('15');
    tester.age.element().dispatchEvent(new Event('blur'));
    tester.fixture.detectChanges();
    await expect.element(tester.root).toHaveTextContent('Save must be at least 18');
  });
});
