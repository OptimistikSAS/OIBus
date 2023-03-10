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
    authTypes: ['none', 'bearer', 'api-key', 'basic', 'cert']
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

  get oibFormInputUsername() {
    return this.input('#oib-auth-username-input-myOibAuthentication')!;
  }

  get oibFormInputPassword() {
    return this.input('#oib-auth-password-input-myOibAuthentication')!;
  }

  get oibFormInputToken() {
    return this.input('#oib-auth-token-input-myOibAuthentication')!;
  }

  get oibFormInputCertPath() {
    return this.input('#oib-auth-cert-path-input-myOibAuthentication')!;
  }

  get oibFormInputKeyPath() {
    return this.input('#oib-auth-key-path-input-myOibAuthentication')!;
  }

  get oibFormInputKey() {
    return this.input('#oib-auth-api-key-input-myOibAuthentication')!;
  }

  get oibFormInputSecret() {
    return this.input('#oib-auth-api-secret-input-myOibAuthentication')!;
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
    expect(tester.oibFormInputAuthType).toHaveSelectedLabel('None');
    expect(tester.oibFormInputKey).toBeNull();
    expect(tester.oibFormInputSecret).toBeNull();
    expect(tester.oibFormInputUsername).toBeNull();
    expect(tester.oibFormInputPassword).toBeNull();
    expect(tester.oibFormInputToken).toBeNull();
    expect(tester.oibFormInputCertPath).toBeNull();
    expect(tester.oibFormInputKeyPath).toBeNull();
  });

  it('should change value', () => {
    tester.oibFormInputAuthType.selectLabel('Basic auth');
    expect(tester.oibFormInputKey).toBeNull();
    expect(tester.oibFormInputSecret).toBeNull();
    expect(tester.oibFormInputUsername).not.toBeNull();
    expect(tester.oibFormInputPassword).not.toBeNull();
    expect(tester.oibFormInputToken).toBeNull();
    expect(tester.oibFormInputCertPath).toBeNull();
    expect(tester.oibFormInputKeyPath).toBeNull();
    tester.oibFormInputUsername.fillWith('my username');
    tester.oibFormInputPassword.fillWith('my password');

    tester.oibFormInputAuthType.selectLabel('Bearer');
    expect(tester.oibFormInputKey).toBeNull();
    expect(tester.oibFormInputSecret).toBeNull();
    expect(tester.oibFormInputUsername).toBeNull();
    expect(tester.oibFormInputPassword).toBeNull();
    expect(tester.oibFormInputToken).not.toBeNull();
    expect(tester.oibFormInputCertPath).toBeNull();
    expect(tester.oibFormInputKeyPath).toBeNull();
    tester.oibFormInputToken.fillWith('my bearer');

    tester.oibFormInputAuthType.selectLabel('API key');
    expect(tester.oibFormInputKey).not.toBeNull();
    expect(tester.oibFormInputSecret).not.toBeNull();
    expect(tester.oibFormInputUsername).toBeNull();
    expect(tester.oibFormInputPassword).toBeNull();
    expect(tester.oibFormInputToken).toBeNull();
    expect(tester.oibFormInputCertPath).toBeNull();
    expect(tester.oibFormInputKeyPath).toBeNull();
    tester.oibFormInputKey.fillWith('my key');
    tester.oibFormInputSecret.fillWith('my secret');

    tester.oibFormInputAuthType.selectLabel('Certificate');
    expect(tester.oibFormInputKey).toBeNull();
    expect(tester.oibFormInputSecret).toBeNull();
    expect(tester.oibFormInputUsername).toBeNull();
    expect(tester.oibFormInputPassword).toBeNull();
    expect(tester.oibFormInputToken).toBeNull();
    expect(tester.oibFormInputCertPath).not.toBeNull();
    expect(tester.oibFormInputKeyPath).not.toBeNull();
    tester.oibFormInputKeyPath.fillWith('my key path');
    tester.oibFormInputCertPath.fillWith('my cert path');
  });
});
