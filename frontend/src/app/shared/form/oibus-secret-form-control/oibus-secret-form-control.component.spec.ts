import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OIBusSecretAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusSecretFormControlComponent } from './oibus-secret-form-control.component';

@Component({
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-secret-form-control [secretAttribute]="secretAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, OIBusSecretFormControlComponent]
})
class TestComponent {
  secretAttribute: OIBusSecretAttribute = {
    type: 'secret',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.field-name'
  } as OIBusSecretAttribute;

  formGroup = new FormGroup({
    testGroup: new FormGroup({
      testKey: new FormControl('')
    })
  });
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get label() {
    return this.element('label')!;
  }

  get field() {
    return this.input('input')!;
  }
}

import { OIBUS_FORM_MODE } from '../oibus-form-mode.token';

describe('OIBusSecretFormControlComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
  });

  it('should render without placeholder when mode is create', async () => {
    const tester = new TestComponentTester();
    await tester.change();

    expect(tester.field.nativeElement.getAttribute('placeholder')).toBeNull();
  });

  it('should display placeholder when mode is edit', async () => {
    TestBed.overrideProvider(OIBUS_FORM_MODE, { useValue: () => 'edit' });
    const tester = new TestComponentTester();
    await tester.change();

    expect(tester.field.nativeElement.getAttribute('placeholder')).toBe('Leave empty to keep the existing secret');
  });
});
