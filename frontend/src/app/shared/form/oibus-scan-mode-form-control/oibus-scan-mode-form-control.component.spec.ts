import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { OIBusScanModeAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ScanModeCreator } from '../../../engine/scan-mode-list/scan-mode-creator.service';
import { renderOIBusFormControl } from '../oibus-form-control.testing';
import { chooseSelectOrCreateEntry, selectOrCreateEntryNames } from '../select-or-create/select-or-create.testing';
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

  let scanModeCreator: MockObject<ScanModeCreator>;

  beforeEach(() => {
    scanModeCreator = createMock(ScanModeCreator, { createLabel: 'engine.scan-mode.create-new', created: signal([]) });
    TestBed.configureTestingModule({ providers: [provideI18nTesting(), { provide: ScanModeCreator, useValue: scanModeCreator }] });
    control = new FormControl<ScanModeDTO | null>(null);
  });

  test.each([
    {
      acceptableType: 'SUBSCRIPTION_AND_POLL',
      expected: ['No scan mode', 'scanMode1', 'scanMode2', 'Subscription', 'Create a new scan mode...']
    },
    { acceptableType: 'POLL', expected: ['No scan mode', 'scanMode1', 'scanMode2', 'Create a new scan mode...'] },
    // the created scan modes are polling ones
    { acceptableType: 'SUBSCRIPTION', expected: ['No scan mode', 'Subscription'] }
  ] as const)('should display the scan modes accepting $acceptableType', async ({ acceptableType, expected }) => {
    const tester = await renderOIBusFormControl(
      OIBusScanModeFormControlComponent,
      { scanModeAttribute: { ...scanModeAttribute, acceptableType }, allScanModes },
      'fieldName',
      control
    );

    expect(await selectOrCreateEntryNames(tester.root.getByLabelText('Field name'))).toEqual(expected);
  });

  test('should update the control with the selected scan mode', async () => {
    const tester = await renderOIBusFormControl(
      OIBusScanModeFormControlComponent,
      { scanModeAttribute, allScanModes },
      'fieldName',
      control
    );

    await chooseSelectOrCreateEntry(tester.root.getByLabelText('Field name'), 'Subscription');

    expect(control.value).toEqual(allScanModes.find(scanMode => scanMode.id === 'subscription'));
  });

  test('should select a created scan mode', async () => {
    const created: ScanModeDTO = { ...allScanModes[0], id: 'created', name: 'Created scan mode' };
    scanModeCreator.create.mockReturnValue(of(created));
    const tester = await renderOIBusFormControl(
      OIBusScanModeFormControlComponent,
      { scanModeAttribute, allScanModes },
      'fieldName',
      control
    );

    await chooseSelectOrCreateEntry(tester.root.getByLabelText('Field name'), 'Create a new scan mode...');

    expect(control.value).toBe(created);
  });
});
