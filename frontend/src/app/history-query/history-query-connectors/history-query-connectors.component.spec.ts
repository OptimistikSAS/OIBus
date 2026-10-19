import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { NorthType } from '@oibus/shared/connector/north-manifest.model';
import { SouthType } from '@oibus/shared/connector/south-manifest.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { HistoryQueryConnectorsComponent } from './history-query-connectors.component';

class HistoryQueryConnectorsComponentTester {
  readonly fixture = TestBed.createComponent(HistoryQueryConnectorsComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly fromExistingSouth = this.root.getByRole('checkbox', { name: 'From existing South' });
  readonly fromExistingNorth = this.root.getByRole('checkbox', { name: 'From existing North' });
  readonly southConnector = this.root.getByRole('combobox', { name: 'From existing South' });
  readonly northConnector = this.root.getByRole('combobox', { name: 'From existing North' });
  readonly southType = this.root.getByRole('combobox', { name: 'South type' });
  readonly northType = this.root.getByRole('combobox', { name: 'North type' });
  readonly component = this.fixture.componentInstance;

  /** The chosen connectors, as the page reads them once the form is valid */
  choice() {
    this.component.createForm.markAllAsTouched();
    return this.component.createForm.valid ? this.component.choice() : null;
  }
}

const historyModes = { subscription: false, lastPoint: false, lastFile: false, history: true };
const southTypes: Array<SouthType> = [
  { id: 'folder-scanner', category: 'file', modes: { ...historyModes, lastFile: true, history: false } },
  { id: 'mssql', category: 'database', modes: historyModes },
  { id: 'opcua', category: 'iot', modes: historyModes }
];
const northTypes: Array<NorthType> = [
  { id: 'console', category: 'debug', types: ['any'] },
  { id: 'file-writer', category: 'file', types: ['any'] }
];

describe('HistoryQueryConnectorsComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let southConnectorService: MockObject<SouthConnectorService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);

    northConnectorService.getNorthTypes.mockReturnValue(of(northTypes));
    northConnectorService.list.mockReturnValue(of(testData.north.listLight));
    southConnectorService.getSouthTypes.mockReturnValue(of(southTypes));
    southConnectorService.list.mockReturnValue(of(testData.south.listLight));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });
    // registers the default validation error messages
    TestBed.createComponent(DefaultValidationErrorsComponent);
  });

  test('should choose existing connectors supporting history queries', async () => {
    const tester = new HistoryQueryConnectorsComponentTester();
    await expect.element(tester.fromExistingSouth).toBeChecked();
    await expect.element(tester.fromExistingNorth).toBeChecked();
    await expect.element(tester.southType).not.toBeInTheDocument();
    await expect.element(tester.northType).not.toBeInTheDocument();
    // the folder scanner does not support history queries
    await expect.element(tester.southConnector.getByRole('option')).toHaveLength(2);

    await tester.southConnector.selectOptions('South 3 (opcua)');
    await tester.northConnector.selectOptions('North 2 (oianalytics)');

    expect(tester.choice()).toEqual({ northType: null, southType: null, northId: 'northId2', southId: 'southId3' });
  });

  test('should choose connector types', async () => {
    const tester = new HistoryQueryConnectorsComponentTester();

    await tester.fromExistingSouth.click();
    await tester.fromExistingNorth.click();
    await expect.element(tester.southConnector).not.toBeInTheDocument();
    await expect.element(tester.southType.getByRole('option')).toHaveLength(2);
    await tester.southType.selectOptions('Microsoft SQL Server™');
    await tester.northType.selectOptions('Console');

    expect(tester.choice()).toEqual({ northType: 'console', southType: 'mssql', northId: null, southId: null });
  });

  test('should require a South and a North', async () => {
    const tester = new HistoryQueryConnectorsComponentTester();

    await tester.southConnector.selectOptions('South 2 (mssql)');

    expect(tester.choice()).toBeNull();
    await expect.element(tester.root.getByText('This field is required')).toBeInTheDocument();
  });

  test('should only allow connector types when there is no existing connector', async () => {
    northConnectorService.list.mockReturnValue(of([]));
    southConnectorService.list.mockReturnValue(of([testData.south.listLight[0]]));
    const tester = new HistoryQueryConnectorsComponentTester();

    await expect.element(tester.fromExistingSouth).not.toBeChecked();
    await expect.element(tester.fromExistingSouth).toBeDisabled();
    await expect.element(tester.fromExistingNorth).not.toBeChecked();
    await expect.element(tester.fromExistingNorth).toBeDisabled();
    await expect.element(tester.southConnector).not.toBeInTheDocument();
    await expect.element(tester.northConnector).not.toBeInTheDocument();

    await tester.southType.selectOptions('OPC UA™');
    await tester.northType.selectOptions('File writer');

    expect(tester.choice()).toEqual({ northType: 'file-writer', southType: 'opcua', northId: null, southId: null });
  });
});
