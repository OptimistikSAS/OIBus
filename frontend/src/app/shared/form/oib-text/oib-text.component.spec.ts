import { TestBed } from '@angular/core/testing';

import { OibTextComponent } from './oib-text.component';
import { Component } from '@angular/core';
import { OibTextFormControl } from '../../../model/form.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, FormRecord } from '@angular/forms';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-text [key]="settings.key" [label]="settings.label" [formControlName]="settings.key"></oib-text>
    </div>
  </form>`,
  standalone: true,
  imports: [OibTextComponent, ...formDirectives]
})
class TestComponent {
  settings: OibTextFormControl = {
    key: 'myOibTextField',
    type: 'OibText',
    label: 'Text field'
  } as OibTextFormControl;
  form = new FormGroup({ settings: new FormRecord({ myOibTextField: new FormControl('') }) });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInput() {
    return this.input('#oib-text-input-myOibTextField')!;
  }
}

describe('OibTextComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OibTextComponent]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have a text input', () => {
    expect(tester.oibFormInput).not.toBeNull();
  });

  it('should change value', () => {
    tester.oibFormInput.fillWith('my new value');
    expect(tester.oibFormInput).toHaveValue('my new value');
  });
});
