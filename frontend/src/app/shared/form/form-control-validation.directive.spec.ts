import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { FormControlValidationDirective } from './form-control-validation.directive';

@Component({
  selector: 'oib-test-form-control-validation-component',
  template: `
    <form [formGroup]="personForm" (ngSubmit)="submit()">
      <div class="form-group">
        <input class="form-control" id="lastName" formControlName="lastName" />
      </div>
      <button type="submit" id="save">Save</button>
    </form>
  `,
  imports: [ReactiveFormsModule, FormControlValidationDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class FormComponent {
  personForm = new FormGroup({
    lastName: new FormControl('', Validators.required)
  });

  submit() {}
}

class FormComponentTester {
  readonly fixture = TestBed.createComponent(FormComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly lastName = this.root.getByCss('#lastName');
  readonly save = this.root.getByRole('button', { name: 'Save' });
}

describe('FormControlValidationDirective', () => {
  let tester: FormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({});

    tester = new FormComponentTester();
  });

  test('should add the is-invalid CSS class when touched', async () => {
    await expect.element(tester.lastName).not.toHaveClass('is-invalid');

    await tester.lastName.click();
    await userEvent.tab();

    await expect.element(tester.lastName).toHaveClass('is-invalid');
  });

  test('should add the is-invalid CSS class when enclosing form is submitted', async () => {
    await expect.element(tester.lastName).not.toHaveClass('is-invalid');

    await tester.save.click();

    await expect.element(tester.lastName).toHaveClass('is-invalid');
  });
});
