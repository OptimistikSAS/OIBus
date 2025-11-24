import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OIBusNumberAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusNumberFormControlComponent } from './oibus-number-form-control.component';

@Component({
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-number-form-control [numberAttribute]="numberAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, OIBusNumberFormControlComponent]
})
class TestComponent {
  numberAttribute: OIBusNumberAttribute = {
    type: 'number',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.field-name'
  } as OIBusNumberAttribute;

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

describe('OIBusNumberFormControlComponent', () => {
  let tester: TestComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    await tester.change();
  });

  it('should create the component', () => {
    expect(tester.componentInstance).toBeDefined();
  });

  it('should display a label with the correct translation key', () => {
    expect(tester.label).toBeDefined();
    expect(tester.label).toContainText('Field name');
  });

  it('should display an input with the correct form control name', () => {
    expect(tester.field).toBeDefined();
    tester.field.fillWith('123');
    expect(tester.field).toHaveValue('123');
  });
});
