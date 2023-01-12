import { TestBed } from '@angular/core/testing';

import { OibSelectComponent } from './oib-select.component';
import { Component } from '@angular/core';
import { OibSelectFormControl } from '../../../model/form.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, FormRecord } from '@angular/forms';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-select [options]="settings.options" [key]="settings.key" [label]="settings.label" [formControlName]="settings.key"></oib-select>
    </div>
  </form>`,
  standalone: true,
  imports: [OibSelectComponent, ...formDirectives]
})
class TestComponent {
  settings: OibSelectFormControl = {
    key: 'myOibSelect',
    type: 'OibSelect',
    label: 'Select field',
    options: ['options1', 'options2', 'options3']
  } as OibSelectFormControl;
  form = new FormGroup({ settings: new FormRecord({ myOibSelect: new FormControl('options2') }) });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInput() {
    return this.select('#oib-select-input-myOibSelect')!;
  }
}

describe('OibSelectComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OibSelectComponent]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have a select input', () => {
    expect(tester.oibFormInput).not.toBeNull();
  });

  it('should change value', () => {
    expect(tester.oibFormInput).toHaveSelectedLabel('options2');
    tester.oibFormInput.selectLabel('options3');
    expect(tester.oibFormInput).toHaveSelectedLabel('options3');
  });
});
