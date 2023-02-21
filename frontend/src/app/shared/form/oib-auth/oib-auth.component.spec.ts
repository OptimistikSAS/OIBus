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
    authTypes: ['none', 'bearer']
  } as OibAuthenticationFormControl;

  form = new FormGroup({ settings: new FormRecord({ myOibTimezone: new FormControl('') }) });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInput() {
    return this.select('#oib-auth-key-input-myOibAuthentication')!;
  }
}

fdescribe('OibTimezoneComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OibAuthComponent, MockI18nModule]
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
