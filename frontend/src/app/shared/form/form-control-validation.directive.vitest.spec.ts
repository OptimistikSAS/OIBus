import { FormControlValidationDirective } from './form-control-validation.directive';
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ComponentTester } from 'ngx-speculoos';
import { beforeEach, describe, expect, test } from 'vitest';

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
  imports: [ReactiveFormsModule, FormControlValidationDirective]
})
class FormComponent {
  personForm = new FormGroup({
    lastName: new FormControl('', Validators.required)
  });

  submit() {}
}

class FormComponentTester extends ComponentTester<FormComponent> {
  constructor() {
    super(FormComponent);
  }

  get lastName() {
    return this.input('#lastName')!;
  }

  get save() {
    return this.button('#save')!;
  }
}

describe('FormControlValidationDirective', () => {
  let tester: FormComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({});

    tester = new FormComponentTester();
    await tester.change();
  });

  test('should add the is-invalid CSS class when touched', () => {
    expect(tester.lastName.nativeElement).not.toHaveClass('is-invalid');

    tester.lastName.dispatchEventOfType('blur');

    expect(tester.lastName.nativeElement).toHaveClass('is-invalid');
  });

  test('should add the is-invalid CSS class when enclosing form is submitted', () => {
    expect(tester.lastName.nativeElement).not.toHaveClass('is-invalid');

    tester.save.click();

    expect(tester.lastName.nativeElement).toHaveClass('is-invalid');
  });
});
