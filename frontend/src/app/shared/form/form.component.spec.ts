import { TestBed } from '@angular/core/testing';

import { FormComponent } from './form.component';
import { ComponentTester } from 'ngx-speculoos';
import { Component } from '@angular/core';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ProxyDTO } from '../../../../../shared/model/proxy.model';
import { FormControl, FormGroup, FormRecord } from '@angular/forms';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { OibCodeBlockComponent } from './oib-code-block/oib-code-block.component';
import { formDirectives } from '../form-directives';

@Component({
  template: ` <form [formGroup]="form">
    <div formGroupName="settings">
      <oib-form [scanModes]="scanModes" [proxies]="proxies" [settingsSchema]="schema" [form]="form.controls.settings"></oib-form>
    </div>
  </form>`,
  standalone: true,
  imports: [FormComponent, ...formDirectives]
})
class TestComponent {
  scanModes: Array<ScanModeDTO> = [];
  proxies: Array<ProxyDTO> = [];
  form = new FormGroup({
    settings: new FormRecord({
      myOibSelectField: new FormControl('option2'),
      myOibTextField: new FormControl(null),
      myOibNumberField: new FormControl(2224),
      myOibTextAreaField: new FormControl(null),
      myOibSecretField: new FormControl('pass'),
      myOibCheckboxField: new FormControl(true)
    })
  });
  schema: Array<Array<OibFormControl>> = [
    [
      {
        key: 'myOibSelectField',
        type: 'OibSelect',
        options: ['option1', 'option2', 'option3'],
        label: 'Select field',
        newRow: true,
        class: 'col-8',
        defaultValue: 'option2',
        currentValue: null,
        validators: null,
        conditionalDisplay: null,
        readDisplay: true
      },
      {
        key: 'myOibTextField',
        type: 'OibText',
        label: 'Text field',
        newRow: false,
        class: 'col-4',
        defaultValue: null,
        currentValue: null,
        validators: null,
        conditionalDisplay: null,
        readDisplay: true
      }
    ],
    [
      {
        key: 'myOibNumberField',
        type: 'OibNumber',
        label: 'Number field',
        newRow: true,
        class: 'col-3',
        defaultValue: 2223,
        currentValue: 2224,
        validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
        conditionalDisplay: null,
        readDisplay: true
      },
      {
        key: 'myOibTextAreaField',
        type: 'OibTextArea',
        label: 'Text area field',
        newRow: false,
        class: 'col-3',
        defaultValue: null,
        currentValue: null,
        validators: [{ key: 'required' }],
        conditionalDisplay: { myOibNumberField: [2225] },
        readDisplay: true
      },
      {
        key: 'myOibSecretField',
        type: 'OibSecret',
        label: 'Secret field',
        newRow: false,
        class: 'col-3',
        defaultValue: null,
        currentValue: 'pass',
        validators: null,
        conditionalDisplay: null,
        readDisplay: true
      },
      {
        key: 'myOibCheckboxField',
        type: 'OibCheckbox',
        label: 'Checkbox field',
        defaultValue: false,
        newRow: true,
        class: null,
        currentValue: true,
        validators: null,
        conditionalDisplay: null,
        readDisplay: true
      }
    ]
  ];
}

class FormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get rows() {
    return this.elements('.row');
  }

  get oibSelectComponent() {
    return this.select('#OibSelect-myOibSelectField')!;
  }
  get oibTextComponent() {
    return this.input('#OibText-myOibTextField')!;
  }
  get oibNumberComponent() {
    return this.input('#OibNumber-myOibNumberField')!;
  }
  get oibTextAreaComponent() {
    return this.textarea('#OibTextArea-myOibTextAreaField')!;
  }
  get oibSecretComponent() {
    return this.input('#OibSecret-myOibSecretField')!;
  }
  get oibCheckboxComponent() {
    return this.input('#OibCheckbox-myOibCheckboxField')!;
  }
}
describe('FormComponent', () => {
  let tester: FormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormComponent, OibCodeBlockComponent]
    });

    tester = new FormComponentTester();
    tester.detectChanges();
  });

  it('should display form with two rows', () => {
    expect(tester.rows.length).toBe(2);
  });

  it('should display filled element', () => {
    expect(tester.oibSelectComponent.selectedLabel).toBe('option2');
    expect(tester.oibTextComponent.value).toBe('');
    expect(tester.oibNumberComponent.value).toBe('2224');
    expect(tester.oibTextAreaComponent.value).toBe('');
    expect(tester.oibSecretComponent.value).toBe('pass');
    expect(tester.oibCheckboxComponent).toBeChecked();
  });
});
