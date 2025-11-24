import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OIBusCodeAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusCodeFormControlComponent } from './oibus-code-form-control.component';
import { By } from '@angular/platform-browser';

@Component({
  selector: 'test-oibus-code-form-control-component',
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-code-form-control [codeAttribute]="codeAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, OIBusCodeFormControlComponent]
})
class TestComponent {
  codeAttribute: OIBusCodeAttribute = {
    type: 'code',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.field-name',
    contentType: 'sql',
    defaultValue: null
  } as OIBusCodeAttribute;

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
    return this.debugElement.query(By.directive(OIBusCodeFormControlComponent))!;
  }
}

describe('OIBusCodeFormControlComponent', () => {
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
  });
});
