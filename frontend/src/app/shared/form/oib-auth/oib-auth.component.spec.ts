import { TestBed } from '@angular/core/testing';

import { OibAuthComponent } from './oib-auth.component';
import { Component } from '@angular/core';
import { OibAuthenticationFormControl } from '../../../../../../shared/model/form.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, FormRecord } from '@angular/forms';
import { MockI18nModule } from '../../../../i18n/mock-i18n.spec';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-auth [key]="settings.key" [label]="settings.label" [formControlName]="settings.key" [authTypes]="settings.authTypes"></oib-auth>
    </div>
  </form>`,
  standalone: true,
  imports: [OibAuthComponent, ...formDirectives]
})
class TestComponent {
  settings: OibAuthenticationFormControl = {
    key: 'myOibAuthentication',
    type: 'OibAuthentication',
    label: 'Select field',
    authTypes: ['none', 'bearer', 'api-key', 'basic']
  } as OibAuthenticationFormControl;

  form = new FormGroup({
    settings: new FormRecord({
      myOibAuthentication: new FormControl({
        type: new FormControl('none'),
        key: new FormControl(''),
        secret: new FormControl('')
      })
    })
  });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInputAuthType() {
    return this.select('#oib-auth-type-input-myOibAuthentication')!;
  }

  get oibFormInputKey() {
    return this.input('#oib-auth-key-input-myOibAuthentication')!;
  }

  get oibFormInputSecret() {
    return this.input('#oib-auth-secret-input-myOibAuthentication')!;
  }
}

describe('OibAuthComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OibAuthComponent, MockI18nModule]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have a select input', () => {
    expect(tester.oibFormInputAuthType).not.toBeNull();
    expect(tester.oibFormInputKey).toBeNull();
    expect(tester.oibFormInputSecret).toBeNull();
  });

  it('should change value', () => {
    tester.oibFormInputAuthType.selectLabel('Basic auth');
    expect(tester.oibFormInputKey).not.toBeNull();
    expect(tester.oibFormInputSecret).not.toBeNull();
    tester.oibFormInputKey.fillWith('my username');
    tester.oibFormInputSecret.fillWith('my password');

    tester.oibFormInputAuthType.selectLabel('Bearer');
    expect(tester.oibFormInputKey).not.toBeNull();
    expect(tester.oibFormInputSecret).toBeNull();
    tester.oibFormInputKey.fillWith('my bearer');

    tester.oibFormInputAuthType.selectLabel('API key');
    expect(tester.oibFormInputKey).not.toBeNull();
    expect(tester.oibFormInputSecret).not.toBeNull();
    tester.oibFormInputKey.fillWith('my key');
    tester.oibFormInputSecret.fillWith('my secret');
  });
});
