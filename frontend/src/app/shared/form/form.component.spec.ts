import { TestBed } from '@angular/core/testing';

import { FormComponent } from './form.component';
import { ComponentTester } from 'ngx-speculoos';
import { Component } from '@angular/core';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { FormControl, FormGroup, FormRecord } from '@angular/forms';
import { OibFormControl } from '../../../../../backend/shared/model/form.model';
import { formDirectives } from '../form-directives';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

@Component({
  template: ` <form [formGroup]="form">
    <div formGroupName="settings">
      <oib-form [parentForm]="form" [scanModes]="scanModes" [settingsSchema]="schema" [form]="form.controls.settings" />
    </div>
  </form>`,
  imports: [FormComponent, ...formDirectives]
})
class TestComponent {
  scanModes: Array<ScanModeDTO> = [];
  form = new FormGroup({
    settings: new FormRecord({
      myOibSelectField: new FormControl('DOT'),
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
        options: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
        translationKey: 'south.items.postgresql.serialization.delimiter',
        newRow: true,
        class: 'col-8',
        defaultValue: 'DOT',
        displayInViewMode: true
      },
      {
        key: 'myOibTextField',
        type: 'OibText',
        translationKey: 'south.items.postgresql.serialization.filename',
        newRow: false,
        class: 'col-4',
        displayInViewMode: true
      }
    ],
    [
      {
        key: 'myOibNumberField',
        type: 'OibNumber',
        translationKey: 'south.postgresql.port',
        newRow: true,
        class: 'col-3',
        defaultValue: 2223,
        validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
        displayInViewMode: true
      },
      {
        key: 'myOibTextAreaField',
        type: 'OibTextArea',
        translationKey: 'south.items.postgresql.query',
        newRow: false,
        class: 'col-3',
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'myOibNumberField', values: [2225] },
        displayInViewMode: true
      },
      {
        key: 'myOibSecretField',
        type: 'OibSecret',
        translationKey: 'south.postgresql.password',
        newRow: false,
        class: 'col-3',
        displayInViewMode: true
      },
      {
        key: 'myOibCheckboxField',
        type: 'OibCheckbox',
        translationKey: 'south.items.postgresql.date-time-fields.use-as-reference',
        defaultValue: false,
        newRow: true,
        displayInViewMode: true
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
      providers: [provideI18nTesting()]
    });

    tester = new FormComponentTester();
    tester.detectChanges();
  });

  it('should display form with two rows', () => {
    expect(tester.rows.length).toBe(2);
  });

  it('should display filled element', () => {
    expect(tester.oibSelectComponent.selectedLabel).toBe('Dot .');
    expect(tester.oibTextComponent.value).toBe('');
    expect(tester.oibNumberComponent.value).toBe('2224');
    expect(tester.oibTextAreaComponent.value).toBe('');
    expect(tester.oibSecretComponent.value).toBe('pass');
    expect(tester.oibCheckboxComponent).toBeChecked();
  });
});
