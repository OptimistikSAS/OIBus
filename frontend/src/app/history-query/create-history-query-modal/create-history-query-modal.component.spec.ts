import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
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
import { CreateHistoryQueryModalComponent } from './create-history-query-modal.component';

class CreateHistoryQueryModalComponentTester {
  readonly fixture = TestBed.createComponent(CreateHistoryQueryModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly fromExistingSouth = this.root.getByRole('checkbox', { name: 'From existing South' });
  readonly fromExistingNorth = this.root.getByRole('checkbox', { name: 'From existing North' });
  readonly southConnector = this.root.getByRole('combobox', { name: 'From existing South' });
  readonly northConnector = this.root.getByRole('combobox', { name: 'From existing North' });
  readonly southType = this.root.getByRole('combobox', { name: 'South type' });
  readonly northType = this.root.getByRole('combobox', { name: 'North type' });
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
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

describe('CreateHistoryQueryModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let northConnectorService: MockObject<NorthConnectorService>;
  let southConnectorService: MockObject<SouthConnectorService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);

    northConnectorService.getNorthTypes.mockReturnValue(of(northTypes));
    northConnectorService.list.mockReturnValue(of(testData.north.listLight));
    southConnectorService.getSouthTypes.mockReturnValue(of(southTypes));
    southConnectorService.list.mockReturnValue(of(testData.south.listLight));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });
    // registers the default validation error messages
    TestBed.createComponent(DefaultValidationErrorsComponent);
  });

  test('should dismiss on cancel', async () => {
    const tester = new CreateHistoryQueryModalComponentTester();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should create from existing connectors supporting history queries', async () => {
    const tester = new CreateHistoryQueryModalComponentTester();
    await expect.element(tester.fromExistingSouth).toBeChecked();
    await expect.element(tester.fromExistingNorth).toBeChecked();
    await expect.element(tester.southType).not.toBeInTheDocument();
    await expect.element(tester.northType).not.toBeInTheDocument();
    // the folder scanner does not support history queries
    await expect.element(tester.southConnector.getByRole('option')).toHaveLength(2);

    await tester.southConnector.selectOptions('South 3 (opcua)');
    await tester.northConnector.selectOptions('North 2 (oianalytics)');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({ northType: null, southType: null, northId: 'northId2', southId: 'southId3' });
  });

  test('should create from connector types', async () => {
    const tester = new CreateHistoryQueryModalComponentTester();

    await tester.fromExistingSouth.click();
    await tester.fromExistingNorth.click();
    await expect.element(tester.southConnector).not.toBeInTheDocument();
    await expect.element(tester.southType.getByRole('option')).toHaveLength(2);
    await tester.southType.selectOptions('Microsoft SQL Server™');
    await tester.northType.selectOptions('Console');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({ northType: 'console', southType: 'mssql', northId: null, southId: null });
  });

  test('should not create without a South and a North', async () => {
    const tester = new CreateHistoryQueryModalComponentTester();

    await tester.southConnector.selectOptions('South 2 (mssql)');
    await tester.saveButton.click();

    expect(activeModal.close).not.toHaveBeenCalled();
    await expect.element(tester.root.getByText('This field is required')).toBeInTheDocument();
  });

  test('should only allow connector types when there is no existing connector', async () => {
    northConnectorService.list.mockReturnValue(of([]));
    southConnectorService.list.mockReturnValue(of([testData.south.listLight[0]]));
    const tester = new CreateHistoryQueryModalComponentTester();

    await expect.element(tester.fromExistingSouth).not.toBeChecked();
    await expect.element(tester.fromExistingSouth).toBeDisabled();
    await expect.element(tester.fromExistingNorth).not.toBeChecked();
    await expect.element(tester.fromExistingNorth).toBeDisabled();
    await expect.element(tester.southConnector).not.toBeInTheDocument();
    await expect.element(tester.northConnector).not.toBeInTheDocument();

    await tester.southType.selectOptions('OPC UA™');
    await tester.northType.selectOptions('File writer');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({ northType: 'file-writer', southType: 'opcua', northId: null, southId: null });
  });
});
