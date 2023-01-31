import { TestBed } from '@angular/core/testing';

import { OibCheckboxComponent } from './oib-checkbox.component';
import { Component } from '@angular/core';
import { OibCheckboxFormControl } from '../../../../../../shared/model/form.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, FormRecord } from '@angular/forms';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-checkbox [key]="settings.key" [label]="settings.label" [formControlName]="settings.key"></oib-checkbox>
    </div>
  </form>`,
  standalone: true,
  imports: [OibCheckboxComponent, ...formDirectives]
})
class TestComponent {
  settings: OibCheckboxFormControl = {
    key: 'myOibCheckbox',
    type: 'OibCheckbox',
    label: 'Checkbox field'
  } as OibCheckboxFormControl;
  form = new FormGroup({ settings: new FormRecord({ myOibCheckbox: new FormControl('') }) });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInput() {
    return this.input('#oib-checkbox-myOibCheckbox')!;
  }
}

describe('OibCheckboxComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OibCheckboxComponent]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have a checkbox input', () => {
    expect(tester.oibFormInput).not.toBeNull();
  });

  it('should change value', () => {
    expect(tester.oibFormInput).not.toBeChecked();
    tester.oibFormInput.check();
    expect(tester.oibFormInput).toBeChecked();
  });
});
