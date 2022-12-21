import { FormControlValidationDirective } from './form-control-validation.directive';
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ComponentTester } from 'ngx-speculoos';

@Component({
  template: `
    <form [formGroup]="personForm" (ngSubmit)="submit()">
      <div class="form-group">
        <input class="form-control" id="lastName" formControlName="lastName" />
      </div>
      <button id="save">Save</button>
    </form>
  `,
  standalone: true,
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormComponent, ReactiveFormsModule]
    });

    tester = new FormComponentTester();
    tester.detectChanges();
  });

  it('should add the is-invalid CSS class when touched', () => {
    expect(tester.lastName).not.toHaveClass('is-invalid');

    tester.lastName.dispatchEventOfType('blur');

    expect(tester.lastName).toHaveClass('is-invalid');
  });

  it('should add the is-invalid CSS class when enclosing form is submitted', () => {
    expect(tester.lastName).not.toHaveClass('is-invalid');

    tester.save.click();

    expect(tester.lastName).toHaveClass('is-invalid');
  });
});
