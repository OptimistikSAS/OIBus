import { TestBed } from '@angular/core/testing';

import { OibNumberComponent } from './oib-number.component';
import { Component } from '@angular/core';
import { OibNumberFormControl } from '../../../../../../shared/model/form.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, FormRecord } from '@angular/forms';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-number [key]="settings.key" [label]="settings.label" [formControlName]="settings.key"></oib-number>
    </div>
  </form>`,
  standalone: true,
  imports: [OibNumberComponent, ...formDirectives]
})
class TestComponent {
  settings: OibNumberFormControl = {
    key: 'myOibNumber',
    type: 'OibNumber',
    label: 'Number field'
  } as OibNumberFormControl;
  form = new FormGroup({ settings: new FormRecord({ myOibNumber: new FormControl('2225') }) });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInput() {
    return this.input('#oib-number-input-myOibNumber')!;
  }
}

describe('OibNumberComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OibNumberComponent]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have a number input', () => {
    expect(tester.oibFormInput).not.toBeNull();
  });

  it('should change value', () => {
    expect(tester.oibFormInput).toHaveValue('2225');
    tester.oibFormInput.fillWith('2223');
    expect(tester.oibFormInput).toHaveValue('2223');
  });
});
