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
  readonly south = this.root.getByCss('#south-connector');
  readonly north = this.root.getByCss('#north-connector');
  readonly component = this.fixture.componentInstance;

  /** The button of a mode of a side: "Duplicate existing" or "New settings" */
  mode(side: 'south' | 'north', name: 'Duplicate existing' | 'New settings') {
    return this[side].getByRole('button', { name, exact: true });
  }

  /** The card of an existing connector or of a type, by the name it starts with */
  card(side: 'south' | 'north', name: string) {
    return this[side].getByRole('button', { name: new RegExp(`^${name}`) });
  }

  cards(side: 'south' | 'north') {
    return this[side].getByCss('.connector-choice');
  }

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
  { id: 'console', category: 'debug', types: ['file'] },
  { id: 'file-writer', category: 'file', types: ['file'] }
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
    await expect.element(tester.mode('south', 'Duplicate existing')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tester.mode('north', 'Duplicate existing')).toHaveAttribute('aria-pressed', 'true');
    // the folder scanner does not support history queries
    await expect.element(tester.cards('south')).toHaveLength(2);
    await expect.element(tester.card('south', 'South 3')).toMatchTextContent(/OPC UA™/);

    await tester.card('south', 'South 3').click();
    await tester.card('north', 'North 2').click();

    await expect.element(tester.card('south', 'South 3')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tester.card('south', 'South 2')).toHaveAttribute('aria-pressed', 'false');
    expect(tester.choice()).toEqual({ northType: null, southType: null, northId: 'northId2', southId: 'southId3' });
  });

  test('should choose connector types, by category', async () => {
    const tester = new HistoryQueryConnectorsComponentTester();

    await tester.mode('south', 'New settings').click();
    await tester.mode('north', 'New settings').click();
    await expect.element(tester.mode('south', 'New settings')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tester.card('south', 'South 3')).not.toBeInTheDocument();
    // the folder scanner does not support history queries
    await expect.element(tester.cards('south')).toHaveLength(2);
    await expect.element(tester.south.getByRole('group', { name: 'Database' })).toBeInTheDocument();
    await expect.element(tester.card('south', 'Microsoft SQL Server™')).toMatchTextContent(/Query Microsoft SQL Server™ databases/);
    await tester.card('south', 'Microsoft SQL Server™').click();
    await tester.card('north', 'Console').click();

    expect(tester.choice()).toEqual({ northType: 'console', southType: 'mssql', northId: null, southId: null });
  });

  test('should require a South and a North', async () => {
    const tester = new HistoryQueryConnectorsComponentTester();

    await tester.card('south', 'South 2').click();

    expect(tester.choice()).toBeNull();
    await expect.element(tester.north.getByText('This field is required')).toBeInTheDocument();
    await expect.element(tester.south.getByText('This field is required')).not.toBeInTheDocument();
  });

  test('should only offer connector types when there is no existing connector', async () => {
    northConnectorService.list.mockReturnValue(of([]));
    southConnectorService.list.mockReturnValue(of([testData.south.listLight[0]]));
    const tester = new HistoryQueryConnectorsComponentTester();

    await expect.element(tester.mode('south', 'New settings')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tester.mode('south', 'Duplicate existing')).not.toBeInTheDocument();
    await expect.element(tester.mode('north', 'Duplicate existing')).not.toBeInTheDocument();

    await tester.card('south', 'OPC UA™').click();
    await tester.card('north', 'File writer').click();

    expect(tester.choice()).toEqual({ northType: 'file-writer', southType: 'opcua', northId: null, southId: null });
  });
});
