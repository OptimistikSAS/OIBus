import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { HistoryQueryDTO } from '@oibus/shared/api/history-query.model';
import { HistoryTransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { HistoryQueryService } from '../../services/history-query.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { EditHistoryQueryTransformerModalComponent } from './edit-history-query-transformer-modal/edit-history-query-transformer-modal.component';
import { HistoryQueryTransformersComponent } from './history-query-transformers.component';

class HistoryQueryTransformersComponentTester {
  readonly fixture = TestBed.createComponent(HistoryQueryTransformersComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('tbody tr');
  readonly none = this.root.getByText('No transformer');
  readonly addButton = this.root.getByRole('button', { name: 'Add a transformer' });
  readonly emitted = vi.fn<(transformers: Array<HistoryTransformerDTOWithOptions> | null) => void>();

  constructor(inputs: {
    historyQuery: HistoryQueryDTO | null;
    saveChangesDirectly: boolean;
    transformersFromNorth?: Array<HistoryTransformerDTOWithOptions>;
  }) {
    this.fixture.componentRef.setInput('northManifest', testData.north.manifest);
    this.fixture.componentRef.setInput('transformers', testData.transformers.customList);
    this.fixture.componentRef.setInput('certificates', []);
    this.fixture.componentRef.setInput('scanModes', []);
    this.fixture.componentRef.setInput('southType', 'mssql');
    this.fixture.componentRef.setInput('historyQuery', inputs.historyQuery);
    this.fixture.componentRef.setInput('saveChangesDirectly', inputs.saveChangesDirectly);
    if (inputs.transformersFromNorth) {
      this.fixture.componentRef.setInput('transformersFromNorth', inputs.transformersFromNorth);
    }
    this.fixture.componentInstance.inMemoryTransformersWithOptions.subscribe(this.emitted);
  }

  cell(row: number, column: number) {
    return this.rows.nth(row).getByRole('cell').nth(column);
  }
}

const historyQuery = testData.historyQueries.list[0];
const [transformer1, transformer2] = historyQuery.northTransformers;
const newTransformer: HistoryTransformerDTOWithOptions = {
  id: 'temp_1',
  transformer: testData.transformers.customList[1],
  options: {},
  items: []
};

describe('HistoryQueryTransformersComponent', () => {
  let historyQueryService: MockObject<HistoryQueryService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<EditHistoryQueryTransformerModalComponent>;
  let transformerModal: MockObject<EditHistoryQueryTransformerModalComponent>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    historyQueryService.addOrEditTransformer.mockReturnValue(of(newTransformer));
    historyQueryService.removeTransformer.mockReturnValue(of(undefined));
    confirmationService.confirm.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    modalService = TestBed.inject(MockModalService);
    transformerModal = createMock(EditHistoryQueryTransformerModalComponent, { directSave: signal(true) });
  });

  test('should display the transformers of the history query', async () => {
    const tester = new HistoryQueryTransformersComponentTester({ historyQuery, saveChangesDirectly: true });

    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.cell(0, 0)).toHaveTextContent('item2');
    await expect.element(tester.cell(0, 1)).toHaveTextContent('my transformer 1');
    await expect.element(tester.cell(1, 0)).toHaveTextContent('All items');
    await expect.element(tester.cell(1, 1)).toHaveTextContent('my transformer 2');
  });

  test('should display the transformers from the north when creating a history query', async () => {
    const tester = new HistoryQueryTransformersComponentTester({ historyQuery: null, saveChangesDirectly: false });
    await expect.element(tester.none).toBeInTheDocument();

    tester.fixture.componentRef.setInput('transformersFromNorth', [newTransformer]);

    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.none).not.toBeInTheDocument();
  });

  test('should add a transformer in memory', async () => {
    modalService.mockClosedModal(transformerModal, newTransformer);
    const tester = new HistoryQueryTransformersComponentTester({ historyQuery: null, saveChangesDirectly: false });
    tester.fixture.componentRef.setInput('items', [testData.historyQueries.itemCommand]);

    await tester.addButton.click();

    expect(transformerModal.directSave()).toBe(false);
    const { id, name, enabled } = testData.historyQueries.itemCommand;
    expect(transformerModal.prepareForCreation).toHaveBeenCalledWith(
      'mssql',
      [],
      [],
      testData.transformers.customList,
      testData.north.manifest.types,
      [{ id, name, enabled }],
      null
    );
    await expect.element(tester.rows).toHaveLength(1);
    expect(historyQueryService.addOrEditTransformer).not.toHaveBeenCalled();
    expect(tester.emitted).toHaveBeenCalledWith([newTransformer]);
  });

  test('should add a transformer directly to the history query', async () => {
    modalService.mockClosedModal(transformerModal, { ...newTransformer });
    const tester = new HistoryQueryTransformersComponentTester({ historyQuery, saveChangesDirectly: true });

    await tester.addButton.click();

    expect(transformerModal.prepareForCreation).toHaveBeenCalledWith(
      'mssql',
      [],
      [],
      testData.transformers.customList,
      testData.north.manifest.types,
      historyQuery.items,
      historyQuery.id
    );
    expect(historyQueryService.addOrEditTransformer).toHaveBeenCalledWith(historyQuery.id, { ...newTransformer, id: '' });
    expect(notificationService.success).toHaveBeenCalledWith('history-query.transformers.added');
    expect(tester.emitted).toHaveBeenCalledWith(historyQuery.northTransformers);
  });

  test('should edit a transformer in memory', async () => {
    const editedTransformer: HistoryTransformerDTOWithOptions = { ...transformer1, options: { edited: true } };
    modalService.mockClosedModal(transformerModal, editedTransformer);
    const tester = new HistoryQueryTransformersComponentTester({ historyQuery, saveChangesDirectly: false });

    await tester.rows.nth(0).getByRole('button', { name: 'Edit transformer' }).click();

    expect(transformerModal.prepareForEdition).toHaveBeenCalledWith(
      'mssql',
      [],
      [],
      testData.transformers.customList,
      testData.north.manifest.types,
      historyQuery.items,
      transformer1,
      historyQuery.id
    );
    expect(historyQueryService.addOrEditTransformer).not.toHaveBeenCalled();
    expect(tester.emitted).toHaveBeenCalledWith([transformer2, editedTransformer]);
  });

  test('should edit a transformer directly in the history query', async () => {
    modalService.mockClosedModal(transformerModal, transformer1);
    const tester = new HistoryQueryTransformersComponentTester({ historyQuery, saveChangesDirectly: true });

    await tester.rows.nth(0).getByRole('button', { name: 'Edit transformer' }).click();

    expect(historyQueryService.addOrEditTransformer).toHaveBeenCalledWith(historyQuery.id, transformer1);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.transformers.edited');
  });

  test('should delete a transformer in memory', async () => {
    const tester = new HistoryQueryTransformersComponentTester({ historyQuery, saveChangesDirectly: false });

    await tester.rows.nth(0).getByRole('button', { name: 'Delete transformer' }).click();

    expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'history-query.transformers.confirm-deletion' });
    await expect.element(tester.rows).toHaveLength(1);
    expect(historyQueryService.removeTransformer).not.toHaveBeenCalled();
    expect(tester.emitted).toHaveBeenCalledWith([transformer2]);
  });

  test('should delete a transformer directly from the history query', async () => {
    const tester = new HistoryQueryTransformersComponentTester({ historyQuery, saveChangesDirectly: true });

    await tester.rows.nth(1).getByRole('button', { name: 'Delete transformer' }).click();

    expect(historyQueryService.removeTransformer).toHaveBeenCalledWith(historyQuery.id, transformer2.id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.transformers.removed');
    await expect.element(tester.rows).toHaveLength(1);
  });

  test('should open the audit history of a saved transformer', async () => {
    const auditModal = createMock(AuditHistoryModalComponent);
    TestBed.inject<MockModalService<AuditHistoryModalComponent>>(MockModalService).mockClosedModal(auditModal);
    const tester = new HistoryQueryTransformersComponentTester({ historyQuery, saveChangesDirectly: true });

    await tester.rows.nth(0).getByRole('button', { name: 'View transformer audit history' }).click();

    expect(auditModal.prepare).toHaveBeenCalledWith('history_query_transformer', transformer1.id);
  });

  test('should not display the audit history button when transformers are edited in memory', async () => {
    const tester = new HistoryQueryTransformersComponentTester({ historyQuery, saveChangesDirectly: false });

    await expect.element(tester.rows.nth(0).getByRole('button', { name: 'Edit transformer' })).toBeInTheDocument();
    await expect.element(tester.root.getByRole('button', { name: 'View transformer audit history' })).not.toBeInTheDocument();
  });
});
