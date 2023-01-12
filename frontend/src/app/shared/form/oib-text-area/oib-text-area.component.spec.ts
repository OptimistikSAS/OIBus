import { TestBed } from '@angular/core/testing';

import { OibTextAreaComponent } from './oib-text-area.component';
import { Component } from '@angular/core';
import { OibTextAreaFormControl } from '../../../model/form.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, FormRecord } from '@angular/forms';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-text-area [key]="settings.key" [label]="settings.label" [formControlName]="settings.key"></oib-text-area>
    </div>
  </form>`,
  standalone: true,
  imports: [OibTextAreaComponent, ...formDirectives]
})
class TestComponent {
  settings: OibTextAreaFormControl = {
    key: 'myOibTextArea',
    type: 'OibTextArea',
    label: 'Text area field'
  } as OibTextAreaFormControl;
  form = new FormGroup({ settings: new FormRecord({ myOibTextArea: new FormControl('') }) });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInput() {
    return this.textarea('#oib-text-area-input-myOibTextArea')!;
  }
}

describe('OibTextAreaComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OibTextAreaComponent]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have a text area input', () => {
    expect(tester.oibFormInput).not.toBeNull();
  });

  it('should change value', () => {
    tester.oibFormInput.fillWith('my new value');
    expect(tester.oibFormInput).toHaveValue('my new value');
  });
});
