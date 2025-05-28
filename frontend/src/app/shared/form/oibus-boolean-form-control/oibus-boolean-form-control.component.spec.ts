import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OIBusBooleanAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusBooleanFormControlComponent } from './oibus-boolean-form-control.component';

@Component({
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-boolean-form-control [booleanAttribute]="booleanAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, OIBusBooleanFormControlComponent]
})
class TestComponent {
  booleanAttribute: OIBusBooleanAttribute = {
    type: 'boolean',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.field-name'
  } as OIBusBooleanAttribute;

  formGroup = new FormGroup({
    testGroup: new FormGroup({
      testKey: new FormControl(false)
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

describe('OIBusBooleanFormControlComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    tester.detectChanges();
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
    tester.field.check();
    expect(tester.field).toBeChecked();
  });
});
