import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OIBusScanModeAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusScanModeFormControlComponent } from './oibus-scan-mode-form-control.component';
import testData from '../../../../../../backend/src/tests/utils/test-data';

@Component({
  selector: 'test-oibus-scan-mode-form-control-component',
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-scan-mode-form-control [allScanModes]="allScanModes" [scanModeAttribute]="scanModeAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, TranslateModule, OIBusScanModeFormControlComponent]
})
class TestComponent {
  scanModeAttribute: OIBusScanModeAttribute = {
    type: 'scan-mode',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.field-name',
    acceptableType: 'SUBSCRIPTION_AND_POLL'
  } as OIBusScanModeAttribute;

  allScanModes = testData.scanMode.list;
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
    return this.select('select')!;
  }

  get options() {
    return this.elements('option')!;
  }
}

describe('OIBusScanModeFormControlComponent', () => {
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

  it('should display a select with the correct form control name', () => {
    expect(tester.field).toBeDefined();
    tester.field.selectLabel('Subscription');
    expect(tester.field).toHaveSelectedLabel('Subscription');
  });

  it('should display options for each selectable value', () => {
    expect(tester.options.length).toBe(4); // One for the null option and one for each value
    expect(tester.options[1]).toContainText('scanMode1');
    expect(tester.options[2]).toContainText('scanMode2');
    expect(tester.options[3]).toContainText('Subscription');
  });
});
