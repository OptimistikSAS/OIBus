import { CdkCopyToClipboard } from '@angular/cdk/clipboard';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { HistoryQueryDTO, HistoryQueryItemCommandDTO } from '@oibus/shared/api/history-query.model';
import { LogDTO } from '@oibus/shared/api/logs.model';
import { HistoryQueryMetrics } from '@oibus/shared/domain/engine.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject, stubRoute } from '../../../test/vitest-create-mock';
import { CertificateService } from '../../services/certificate.service';
import { EngineService } from '../../services/engine.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { LogService } from '../../services/log.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { TransformerService } from '../../services/transformer.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { provideCurrentUser } from '../../shared/current-user-testing';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { SouthExploreModalComponent } from '../../shared/south-explore-modal/south-explore-modal.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { emptyPage } from '../../shared/utils/page.utils';
import { WindowService } from '../../shared/window.service';
import { EditHistoryQueryItemModalComponent } from '../history-query-items/edit-history-query-item-modal/edit-history-query-item-modal.component';
import { ImportHistoryQueryItemsModalComponent } from '../history-query-items/import-history-query-items-modal/import-history-query-items-modal.component';
import { HistoryQueryDetailComponent } from './history-query-detail.component';

class HistoryQueryDetailComponentTester {
  readonly fixture = TestBed.createComponent(HistoryQueryDetailComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly metrics = this.root.getByCss('oib-history-metrics');
  readonly items = this.root.getByCss('tr.south-item');
  readonly exploreButton = this.root.getByRole('button', { name: 'Explore' });
  readonly testNorthButton = this.root.getByCss('#test-connection-north');
  readonly testSouthButton = this.root.getByCss('#test-connection-south');
  readonly pauseButton = this.root.getByRole('button', { name: 'Pause history query' });
  readonly resumeButton = this.root.getByRole('button', { name: 'Resume history query' });
  readonly restartButton = this.root.getByRole('button', { name: 'Restart history query' });
  readonly addItemButton = this.root.getByRole('button', { name: 'Add a new item' });
  readonly exportButton = this.root.getByRole('button', { name: 'Export' });
  readonly importButton = this.root.getByRole('button', { name: 'Import' });
  readonly deleteAllButton = this.root.getByRole('button', { name: 'Delete all' });
  readonly searchItems = this.root.getByRole('textbox', { name: 'Enter text to filter items' });
  readonly statusFilter = this.root.getByRole('combobox', { name: 'Status' });
  readonly selectAllButton = this.root.getByRole('button', { name: 'Select all' });
  readonly unselectAllButton = this.root.getByRole('button', { name: 'Unselect all' });
  readonly massActions = this.root.getByRole('button', { name: /Mass actions/ });

  item(index: number) {
    return this.items.nth(index);
  }

  itemName(index: number) {
    return this.items.nth(index).getByRole('cell').nth(2);
  }
}

const finishedMetrics: HistoryQueryMetrics = {
  ...testData.historyQueries.metrics,
  north: { ...testData.historyQueries.metrics.north, currentCacheSize: 0 },
  historyMetrics: { ...testData.historyQueries.metrics.historyMetrics, intervalProgress: 1 }
};

describe('HistoryQueryDetailComponent', () => {
  let historyQuery: HistoryQueryDTO;
  let historyQueryService: MockObject<HistoryQueryService>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let notificationService: MockObject<NotificationService>;
  let confirmationService: MockObject<ConfirmationService>;

  beforeEach(() => {
    historyQuery = structuredClone(testData.historyQueries.list[0]);
    historyQueryService = createMock(HistoryQueryService);
    const northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);
    const scanModeService = createMock(ScanModeService);
    const certificateService = createMock(CertificateService);
    const transformerService = createMock(TransformerService);
    const engineService = createMock(EngineService, { info$: of(testData.engine.oIBusInfo) });
    const logService = createMock(LogService);
    notificationService = createMock(NotificationService);
    confirmationService = createMock(ConfirmationService);

    historyQueryService.findById.mockImplementation(() => of(historyQuery));
    historyQueryService.getMetrics.mockReturnValue(of(testData.historyQueries.metrics));
    northConnectorService.getNorthManifest.mockReturnValue(of(testData.north.manifest));
    southConnectorService.getSouthManifest.mockReturnValue(of(testData.south.manifest));
    scanModeService.list.mockReturnValue(of(testData.scanMode.list));
    certificateService.list.mockReturnValue(of([]));
    transformerService.list.mockReturnValue(of([]));
    logService.search.mockReturnValue(of(emptyPage<LogDTO>()));
    confirmationService.confirm.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        provideCurrentUser(),
        provideModalTesting(),
        { provide: ActivatedRoute, useValue: stubRoute({ params: { historyQueryId: historyQuery.id } }) },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TransformerService, useValue: transformerService },
        { provide: EngineService, useValue: engineService },
        { provide: LogService, useValue: logService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: WindowService, useValue: createMock(WindowService, { languageToUse: () => 'en' }) }
      ]
    });
  });

  function mockModal<T>(componentInstance: T, result: unknown = '') {
    TestBed.inject<MockModalService<T>>(MockModalService).mockClosedModal(componentInstance, result);
  }

  test('should display the history query, its metrics and its items', async () => {
    const tester = new HistoryQueryDetailComponentTester();

    await expect.element(tester.title).toMatchTextContent(`History query ${historyQuery.name}`);
    expect(historyQueryService.findById).toHaveBeenCalledWith(historyQuery.id);
    await expect.element(tester.metrics).toBeInTheDocument();
    expect(historyQueryService.getMetrics).toHaveBeenCalledWith(historyQuery.id);
    await expect.element(tester.items).toHaveLength(2);
    await expect.element(tester.itemName(0)).toHaveTextContent('item1');
    await expect.element(tester.itemName(1)).toHaveTextContent('item2');
  });

  test('should show the explore button only when the south manifest supports exploration', async () => {
    southConnectorService.getSouthManifest.mockReturnValue(of({ ...testData.south.manifest, explore: false }));
    const tester = new HistoryQueryDetailComponentTester();

    await expect.element(tester.testSouthButton).toBeInTheDocument();
    await expect.element(tester.exploreButton).not.toBeInTheDocument();
  });

  test('should open the explore modal wired to the history query explore endpoints', async () => {
    const exploreModal = createMock(SouthExploreModalComponent);
    mockModal(exploreModal);
    historyQueryService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    historyQueryService.browseExplore.mockReturnValue(of({ entries: [] }));
    historyQueryService.closeExplore.mockReturnValue(of(undefined));
    const tester = new HistoryQueryDetailComponentTester();

    await tester.exploreButton.click();

    expect(exploreModal.prepare).toHaveBeenCalledWith(historyQuery.id, historyQuery.southSettings, historyQuery.southType, {
      start: expect.any(Function),
      browse: expect.any(Function),
      close: expect.any(Function)
    });
    const api = exploreModal.prepare.mock.calls[0][3]!;
    api.start(historyQuery.southSettings, historyQuery.southType);
    expect(historyQueryService.startExplore).toHaveBeenCalledWith(historyQuery.id, historyQuery.southSettings, historyQuery.southType);
    api.browse('sessionId', null);
    expect(historyQueryService.browseExplore).toHaveBeenCalledWith(historyQuery.id, 'sessionId', null);
    api.close('sessionId');
    expect(historyQueryService.closeExplore).toHaveBeenCalledWith(historyQuery.id, 'sessionId');
  });

  test.each(['north', 'south'] as const)('should test the %s connection', async type => {
    const testModal = createMock(TestConnectionResultModalComponent);
    mockModal(testModal);
    const tester = new HistoryQueryDetailComponentTester();

    await (type === 'north' ? tester.testNorthButton : tester.testSouthButton).click();

    expect(testModal.runHistoryQueryTest).toHaveBeenCalledWith(
      type,
      historyQuery.id,
      type === 'north' ? historyQuery.northSettings : historyQuery.southSettings,
      type === 'north' ? historyQuery.northType : historyQuery.southType
    );
  });

  test('should open the audit history of the history query and of its items', async () => {
    const auditModal = createMock(AuditHistoryModalComponent);
    mockModal(auditModal);
    const tester = new HistoryQueryDetailComponentTester();

    await tester.root.getByRole('button', { name: 'View history query audit history' }).click();
    expect(auditModal.prepare).toHaveBeenCalledWith('history_query', historyQuery.id);

    await tester.item(1).getByRole('button', { name: 'View item audit history' }).click();
    expect(auditModal.prepare).toHaveBeenLastCalledWith('history_query_item', historyQuery.items[1].id);
  });

  test('should notify the copy of the cache path', async () => {
    const tester = new HistoryQueryDetailComponentTester();
    await expect.element(tester.title).toBeInTheDocument();
    const copyIcon = tester.fixture.debugElement.query(By.directive(CdkCopyToClipboard));

    copyIcon.triggerEventHandler('cdkCopyToClipboardCopied', true);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.cache-path-copy.success');

    copyIcon.triggerEventHandler('cdkCopyToClipboardCopied', false);
    expect(notificationService.error).toHaveBeenCalledWith('history-query.cache-path-copy.error');
  });

  test('should pause the history query and resume it', async () => {
    historyQueryService.pause.mockReturnValue(of(undefined));
    historyQueryService.start.mockReturnValue(of(undefined));
    const tester = new HistoryQueryDetailComponentTester();
    await expect.element(tester.metrics).toBeInTheDocument();

    historyQuery = { ...historyQuery, status: 'PAUSED' };
    await tester.pauseButton.click();

    expect(historyQueryService.pause).toHaveBeenCalledWith(historyQuery.id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.paused', { name: historyQuery.name });
    await expect.element(tester.resumeButton).toBeInTheDocument();
    const metricsCalls = historyQueryService.getMetrics.mock.calls.length;

    historyQuery = { ...historyQuery, status: 'RUNNING' };
    await tester.resumeButton.click();

    expect(historyQueryService.start).toHaveBeenCalledWith(historyQuery.id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.started', { name: historyQuery.name });
    await expect.element(tester.pauseButton).toBeInTheDocument();
    // the metrics polling restarts
    await expect.poll(() => historyQueryService.getMetrics.mock.calls.length).toBeGreaterThan(metricsCalls);
  });

  test('should display the history query as finished once all the data is retrieved and sent', async () => {
    historyQueryService.getMetrics.mockReturnValue(of(finishedMetrics));
    const tester = new HistoryQueryDetailComponentTester();

    await expect.element(tester.restartButton).toBeInTheDocument();
    await expect.element(tester.pauseButton).not.toBeInTheDocument();
  });

  test('should filter and sort the items', async () => {
    historyQuery.items[0].enabled = false;
    const tester = new HistoryQueryDetailComponentTester();

    await tester.searchItems.fill('2');
    await expect.element(tester.items).toHaveLength(1);
    await expect.element(tester.itemName(0)).toHaveTextContent('item2');

    await tester.searchItems.fill('');
    await tester.statusFilter.selectOptions('Disabled');
    await expect.element(tester.items).toHaveLength(1);
    await expect.element(tester.itemName(0)).toHaveTextContent('item1');

    await tester.searchItems.fill('none');
    await expect.element(tester.root.getByText('No items match the search criteria')).toBeInTheDocument();

    await tester.searchItems.fill('');
    await tester.statusFilter.selectOptions('All statuses');
    const nameHeader = tester.root.getByRole('button', { name: 'Name' });
    await nameHeader.click();
    await nameHeader.click();
    await expect.element(tester.itemName(0)).toHaveTextContent('item2');
    await expect.element(tester.itemName(1)).toHaveTextContent('item1');
  });

  test('should create an item', async () => {
    const itemModal = createMock(EditHistoryQueryItemModalComponent);
    const command: HistoryQueryItemCommandDTO = testData.historyQueries.itemCommand;
    mockModal(itemModal, command);
    historyQueryService.createItem.mockReturnValue(of(historyQuery.items[0]));
    const tester = new HistoryQueryDetailComponentTester();

    await tester.addItemButton.click();

    expect(itemModal.prepareForCreation).toHaveBeenCalledWith(
      historyQuery.items,
      historyQuery.id,
      null,
      { type: testData.south.manifest.id, settings: historyQuery.southSettings },
      testData.south.manifest
    );
    expect(historyQueryService.createItem).toHaveBeenCalledWith(historyQuery.id, command);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.created');
    expect(historyQueryService.findById).toHaveBeenCalledTimes(2);
  });

  test('should edit an item', async () => {
    const itemModal = createMock(EditHistoryQueryItemModalComponent);
    const command: HistoryQueryItemCommandDTO = { ...testData.historyQueries.itemCommand, id: historyQuery.items[1].id };
    mockModal(itemModal, command);
    historyQueryService.updateItem.mockReturnValue(of(undefined));
    const tester = new HistoryQueryDetailComponentTester();

    await tester.item(1).getByRole('button', { name: 'Edit item' }).click();

    expect(itemModal.prepareForEdition).toHaveBeenCalledWith(
      historyQuery.items,
      historyQuery.items[1],
      historyQuery.id,
      null,
      { type: testData.south.manifest.id, settings: historyQuery.southSettings },
      testData.south.manifest,
      1
    );
    expect(historyQueryService.updateItem).toHaveBeenCalledWith(historyQuery.id, command.id, command);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.updated');
  });

  test('should duplicate an item', async () => {
    const itemModal = createMock(EditHistoryQueryItemModalComponent);
    mockModal(itemModal, testData.historyQueries.itemCommand);
    historyQueryService.createItem.mockReturnValue(of(historyQuery.items[0]));
    const tester = new HistoryQueryDetailComponentTester();

    await tester.item(0).getByRole('button', { name: 'Duplicate item' }).click();

    expect(itemModal.prepareForCopy).toHaveBeenCalledWith(
      historyQuery.items,
      historyQuery.items[0],
      historyQuery.id,
      null,
      { type: testData.south.manifest.id, settings: historyQuery.southSettings },
      testData.south.manifest
    );
    expect(historyQueryService.createItem).toHaveBeenCalledWith(historyQuery.id, testData.historyQueries.itemCommand);
  });

  test('should delete an item and all the items', async () => {
    historyQueryService.deleteItem.mockReturnValue(of(undefined));
    historyQueryService.deleteAllItems.mockReturnValue(of(undefined));
    const tester = new HistoryQueryDetailComponentTester();

    await tester.item(0).getByRole('button', { name: 'Delete item' }).click();
    expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'history-query.items.confirm-deletion' });
    expect(historyQueryService.deleteItem).toHaveBeenCalledWith(historyQuery.id, historyQuery.items[0].id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.deleted');

    await tester.deleteAllButton.click();
    expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'history-query.items.confirm-delete-all' });
    expect(historyQueryService.deleteAllItems).toHaveBeenCalledWith(historyQuery.id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.all-deleted');
  });

  test('should enable, disable and delete the selected items', async () => {
    historyQueryService.enableItems.mockReturnValue(of(undefined));
    historyQueryService.disableItems.mockReturnValue(of(undefined));
    historyQueryService.deleteItems.mockReturnValue(of(undefined));
    const itemIds = historyQuery.items.map(item => item.id);
    const tester = new HistoryQueryDetailComponentTester();
    await expect.element(tester.massActions).not.toBeInTheDocument();

    await tester.item(0).getByRole('checkbox').click();
    await expect.element(tester.massActions).toHaveTextContent('Mass actions (1 items)');
    await tester.selectAllButton.click();
    await expect.element(tester.selectAllButton).toBeDisabled();
    await tester.massActions.click();
    await tester.root.getByRole('button', { name: 'Enable', exact: true }).click();
    expect(historyQueryService.enableItems).toHaveBeenCalledWith(historyQuery.id, itemIds);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.enabled-multiple', { count: '2' });
    await expect.element(tester.massActions).not.toBeInTheDocument();

    await tester.item(1).getByRole('checkbox').click();
    await tester.massActions.click();
    await tester.root.getByRole('button', { name: 'Disable', exact: true }).click();
    expect(historyQueryService.disableItems).toHaveBeenCalledWith(historyQuery.id, [itemIds[1]]);

    await tester.selectAllButton.click();
    await tester.massActions.click();
    await tester.root.getByRole('button', { name: 'Delete', exact: true }).click();
    expect(confirmationService.confirm).toHaveBeenCalledWith({
      messageKey: 'history-query.items.delete-multiple-message',
      interpolateParams: { count: '2' }
    });
    expect(historyQueryService.deleteItems).toHaveBeenCalledWith(historyQuery.id, itemIds);
  });

  test('should unselect all the items', async () => {
    const tester = new HistoryQueryDetailComponentTester();

    await tester.selectAllButton.click();
    await expect.element(tester.item(0).getByRole('checkbox')).toBeChecked();
    await tester.unselectAllButton.click();

    await expect.element(tester.item(0).getByRole('checkbox')).not.toBeChecked();
    await expect.element(tester.unselectAllButton).toBeDisabled();
  });

  test('should export the items', async () => {
    const exportModal = createMock(ExportItemModalComponent);
    mockModal(exportModal, { filename: 'items.csv', delimiter: ';' });
    historyQueryService.exportItems.mockReturnValue(of(undefined));
    const tester = new HistoryQueryDetailComponentTester();

    await tester.exportButton.click();

    expect(exportModal.prepare).toHaveBeenCalledWith(historyQuery.name);
    expect(historyQueryService.exportItems).toHaveBeenCalledWith(historyQuery.id, 'items.csv', ';');
  });

  test('should import items', async () => {
    const importModal = createMock(ImportHistoryQueryItemsModalComponent);
    const items = [testData.historyQueries.itemCommand];
    mockModal(importModal, { items, eraseExisting: true });
    historyQueryService.importItems.mockReturnValue(of(undefined));
    const tester = new HistoryQueryDetailComponentTester();

    await tester.importButton.click();

    expect(importModal.prepare).toHaveBeenCalledWith(
      testData.south.manifest,
      ['name', 'enabled', 'settings_objectArray', 'settings_objectSettings', 'settings_objectValue'],
      ['scanMode'],
      true,
      expect.any(Function)
    );
    expect(historyQueryService.importItems).toHaveBeenCalledWith(historyQuery.id, items, true);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.imported');
  });
});
