import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { OIBusScanModeAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { renderOIBusFormControl } from '../oibus-form-control.testing';
import { OIBusScanModeFormControlComponent } from './oibus-scan-mode-form-control.component';

describe('OIBusScanModeFormControlComponent', () => {
  const scanModeAttribute: OIBusScanModeAttribute = {
    type: 'scan-mode',
    key: 'fieldName',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.field-name',
    acceptableType: 'SUBSCRIPTION_AND_POLL',
    validators: [],
    displayProperties: { row: 0, columns: 4, displayInViewMode: true }
  };
  const allScanModes = testData.scanMode.list;
  let control: FormControl<ScanModeDTO | null>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    control = new FormControl<ScanModeDTO | null>(null);
  });

  test.each([
    { acceptableType: 'SUBSCRIPTION_AND_POLL', expected: ['', 'scanMode1', 'scanMode2', 'Subscription'] },
    { acceptableType: 'POLL', expected: ['', 'scanMode1', 'scanMode2'] },
    { acceptableType: 'SUBSCRIPTION', expected: ['', 'Subscription'] }
  ] as const)('should display the scan modes accepting $acceptableType', async ({ acceptableType, expected }) => {
    const tester = await renderOIBusFormControl(
      OIBusScanModeFormControlComponent,
      { scanModeAttribute: { ...scanModeAttribute, acceptableType }, allScanModes },
      'fieldName',
      control
    );

    const options = tester.root.getByRole('option');
    await expect.element(options).toHaveLength(expected.length);
    expect(options.elements().map(option => option.textContent!.trim())).toEqual(expected);
  });

  test('should update the control with the selected scan mode', async () => {
    const tester = await renderOIBusFormControl(
      OIBusScanModeFormControlComponent,
      { scanModeAttribute, allScanModes },
      'fieldName',
      control
    );

    await tester.root.getByLabelText('Field name').selectOptions('Subscription');

    expect(control.value).toEqual(allScanModes.find(scanMode => scanMode.id === 'subscription'));
  });
});
