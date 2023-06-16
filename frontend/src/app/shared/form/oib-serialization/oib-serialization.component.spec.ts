import { TestBed } from '@angular/core/testing';

import { OibSerializationComponent } from './oib-serialization.component';
import { Component } from '@angular/core';
import { OibSerializationFormControl } from '../../../../../../shared/model/form.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, FormRecord, Validators } from '@angular/forms';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { DateTimeSerialization } from '../../../../../../shared/model/types';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-serialization [key]="settings.key" [label]="settings.label" [formControlName]="settings.key"></oib-serialization>
    </div>
  </form>`,
  standalone: true,
  imports: [OibSerializationComponent, ...formDirectives]
})
class TestComponent {
  settings: OibSerializationFormControl = {
    key: 'myOibSerialization',
    type: 'OibSerialization',
    label: 'Serialization'
  } as OibSerializationFormControl;

  form = new FormGroup({
    settings: new FormRecord({
      myOibSerialization: new FormControl({
        type: new FormControl('file'),
        filename: new FormControl('UTC'),
        delimiter: new FormControl('DOT'),
        compression: new FormControl(false),
        outputDateTimeFormat: new FormControl({
          type: 'specific-string',
          timezone: 'Europe/Paris',
          format: 'yyyy-MM-dd HH:mm:ss.SSS',
          locale: 'en-US'
        }),
        datetimeSerialization: new FormControl([[] as Array<DateTimeSerialization>, Validators.required])
      })
    })
  });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInputSerializationType() {
    return this.select('#oib-serialization-type-input-myOibSerialization')!;
  }

  get oibFormInputFilename() {
    return this.input('#oib-serialization-filename-input-myOibSerialization')!;
  }

  get oibFormInputDelimiter() {
    return this.select('#oib-serialization-delimiter-input-myOibSerialization')!;
  }

  get oibFormInputCompression() {
    return this.input('#oib-serialization-compression-input-myOibSerialization')!;
  }
}

describe('OibSerialization with csv', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should display CSV file input fields', () => {
    tester.oibFormInputSerializationType.selectLabel('CSV File');
    expect(tester.oibFormInputFilename).not.toBeNull();
    expect(tester.oibFormInputDelimiter).not.toBeNull();
    expect(tester.oibFormInputCompression).not.toBeNull();
  });
});

describe('OibSerialization with OIBus values', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have hide other fields than OIBus values', () => {
    tester.oibFormInputSerializationType.selectLabel('OIBus values');
    expect(tester.oibFormInputFilename).toBeNull();
    expect(tester.oibFormInputDelimiter).toBeNull();
    expect(tester.oibFormInputCompression).toBeNull();
  });
});
