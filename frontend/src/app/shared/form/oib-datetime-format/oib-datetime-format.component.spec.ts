import { TestBed } from '@angular/core/testing';

import { OibDatetimeFormatComponent } from './oib-datetime-format.component';
import { Component } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, FormRecord } from '@angular/forms';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-datetime-format key="myOibDateTimeFormat" label="Select field" formControlName="myOibDateTimeFormat"></oib-datetime-format>
    </div>
  </form>`,
  standalone: true,
  imports: [OibDatetimeFormatComponent, ...formDirectives]
})
class TestComponent {
  form = new FormGroup({
    settings: new FormRecord({
      myOibDateTimeFormat: new FormControl({
        type: new FormControl('unix-epoch-ms'),
        timezone: new FormControl('UTC'),
        field: new FormControl('timestamp')
      })
    })
  });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInputDatetimeType() {
    return this.select('#oib-datetime-type-input-myOibDateTimeFormat')!;
  }

  get oibFormInputTimezone() {
    return this.input('#oib-datetime-timezone-input-myOibDateTimeFormat')!;
  }

  get oibFormInputFormat() {
    return this.input('#oib-datetime-format-input-myOibDateTimeFormat')!;
  }

  get oibFormInputLocale() {
    return this.input('#oib-datetime-locale-input-myOibDateTimeFormat')!;
  }

  get example() {
    return this.element('#example')!;
  }
}

describe('OibDatetimeFormatComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have a select input', () => {
    tester.oibFormInputDatetimeType.selectLabel('Custom format');
    expect(tester.oibFormInputTimezone).not.toBeNull();
    expect(tester.oibFormInputFormat).not.toBeNull();
    expect(tester.oibFormInputLocale).not.toBeNull();

    tester.oibFormInputFormat.fillWith('yyyy-MM-dd HH:mm:ss.SSS');
    expect(tester.example).toContainText('Example with 2023-11-29T21:03:59.123Z: 2023-11-29 21:03:59.123');
  });

  it('should change value to Number', () => {
    tester.oibFormInputDatetimeType.selectLabel('UNIX Epoch (ms)');
    expect(tester.oibFormInputTimezone).toBeNull();
    expect(tester.oibFormInputFormat).toBeNull();
    expect(tester.oibFormInputLocale).toBeNull();

    expect(tester.example).toContainText('Example with 2023-11-29T21:03:59.123Z: 1701291839123');
  });

  it('should change value to Number', () => {
    tester.oibFormInputDatetimeType.selectLabel('UNIX Epoch (s)');
    expect(tester.oibFormInputTimezone).toBeNull();
    expect(tester.oibFormInputFormat).toBeNull();
    expect(tester.oibFormInputLocale).toBeNull();

    expect(tester.example).toContainText('Example with 2023-11-29T21:03:59.123Z: 1701291839');
  });
});
