import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OIBusScanModeAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusScanModeFormControlComponent } from './oibus-scan-mode-form-control.component';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  selector: 'oib-test-oibus-scan-mode-form-control-component',
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-scan-mode-form-control [allScanModes]="allScanModes" [scanModeAttribute]="scanModeAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, OIBusScanModeFormControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  scanModeAttribute: OIBusScanModeAttribute = {
    type: 'scan-mode',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.field-name',
    acceptableType: 'SUBSCRIPTION_AND_POLL'
  } as OIBusScanModeAttribute;

  allScanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;
  formGroup = new FormGroup({
    testGroup: new FormGroup({
      testKey: new FormControl('')
    })
  });
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly label = this.root.getByText('Field name');
  readonly field = this.root.getByCss('select');
  readonly options = this.root.getByCss('option');
}

describe('OIBusScanModeFormControlComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    tester.fixture.detectChanges();
  });

  test('should display a label with the correct translation key', async () => {
    await expect.element(tester.label).toBeInTheDocument();
  });

  test('should display a select with the correct form control name', async () => {
    await tester.field.selectOptions('Subscription');
    await expect.element(tester.field).toHaveValue('3: Object');
  });

  test('should display options for each selectable value', async () => {
    await expect.element(tester.options).toHaveLength(4); // One for the null option and one for each value
    await expect.element(tester.options.nth(1)).toHaveTextContent('scanMode1');
    await expect.element(tester.options.nth(2)).toHaveTextContent('scanMode2');
    await expect.element(tester.options.nth(3)).toHaveTextContent('Subscription');
  });
});
