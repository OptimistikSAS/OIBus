import { TestBed } from '@angular/core/testing';

import { OibSecretComponent } from './oib-secret.component';
import { Component } from '@angular/core';
import { OibSecretFormControl } from '../../../model/form.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-secret [key]="settings.key" [label]="settings.label" [formControlName]="settings.key"></oib-secret>
    </div>
  </form>`,
  standalone: true,
  imports: [OibSecretComponent, ...formDirectives]
})
class TestComponent {
  settings: OibSecretFormControl = {
    key: 'myOibSecret',
    type: 'OibSecret',
    label: 'Checkbox field'
  } as OibSecretFormControl;
  form = new FormGroup({ settings: new FormGroup({ myOibSecret: new FormControl('') }) });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInput() {
    return this.input('#oib-secret-input-myOibSecret')!;
  }
}

describe('OibSecretComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OibSecretComponent]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have a secret input', () => {
    expect(tester.oibFormInput).not.toBeNull();
  });

  it('should change value', () => {
    tester.oibFormInput.fillWith('my new value');
    expect(tester.oibFormInput).toHaveValue('my new value');
  });
});
