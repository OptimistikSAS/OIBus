import { TestBed } from '@angular/core/testing';

import { OibTimezoneComponent } from './oib-timezone.component';
import { Component } from '@angular/core';
import { OibTimezoneFormControl } from '../../../model/form.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, FormRecord } from '@angular/forms';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-timezone [key]="settings.key" [label]="settings.label" [formControlName]="settings.key"></oib-timezone>
    </div>
  </form>`,
  standalone: true,
  imports: [OibTimezoneComponent, ...formDirectives]
})
class TestComponent {
  settings: OibTimezoneFormControl = {
    key: 'myOibTimezone',
    type: 'OibTimezone',
    label: 'Select field'
  } as OibTimezoneFormControl;
  form = new FormGroup({ settings: new FormRecord({ myOibTimezone: new FormControl('') }) });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInput() {
    return this.select('#oib-timezone-input-myOibTimezone')!;
  }
}

describe('OibTimezoneComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OibTimezoneComponent]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have a select input', () => {
    expect(tester.oibFormInput).not.toBeNull();
  });

  it('should change value', () => {
    tester.oibFormInput.selectLabel('Europe/Paris');
    expect(tester.oibFormInput).toHaveSelectedLabel('Europe/Paris');
  });
});
