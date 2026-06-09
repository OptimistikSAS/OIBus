import { FormControlValidationDirective } from './form-control-validation.directive';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  selector: 'oib-test-form-control-validation-component',
  template: `
    <form [formGroup]="personForm" (ngSubmit)="submit()">
      <div class="form-group">
        <input class="form-control" id="lastName" formControlName="lastName" />
      </div>
      <button id="save">Save</button>
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
    tester.fixture.detectChanges();
  });

  test('should add the is-invalid CSS class when touched', async () => {
    await expect.element(tester.lastName).not.toHaveClass('is-invalid');

    tester.lastName.element().dispatchEvent(new Event('blur'));
    tester.fixture.detectChanges();

    await expect.element(tester.lastName).toHaveClass('is-invalid');
  });

  test('should add the is-invalid CSS class when enclosing form is submitted', async () => {
    await expect.element(tester.lastName).not.toHaveClass('is-invalid');

    await tester.save.click();
    tester.fixture.detectChanges();

    await expect.element(tester.lastName).toHaveClass('is-invalid');
  });
});
