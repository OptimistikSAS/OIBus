import { CdkCopyToClipboard } from '@angular/cdk/clipboard';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { firstValueFrom, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { HistoryQueryDTO, HistoryQueryItemCommandDTO } from '@oibus/shared/api/history-query.model';
import { LogDTO } from '@oibus/shared/api/logs.model';
import { ServerTrustStateDTO, TrustedServerIdentityDTO } from '@oibus/shared/api/server-identity.model';
import { HistoryQueryMetrics } from '@oibus/shared/domain/engine.model';
import { PresentedServerIdentity, ServerIdentity } from '@oibus/shared/domain/server-identity.model';

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
import { fakeModal, MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { METRICS_REFRESH_INTERVAL_MS } from '../../shared/polling';
import { ServerTrustModalComponent } from '../../shared/server-trust/server-trust-modal/server-trust-modal.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { emptyPage } from '../../shared/utils/page.utils';
import { WindowService } from '../../shared/window.service';
import EditWorkflowModalComponent from '../../south/south-workflows/edit-workflow-modal/edit-workflow-modal.component';
import { ExploreWizardResult } from '../../south/south-workflows/edit-workflow-modal/explore-wizard';
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
  readonly addItemButton = this.root.getByRole('button', { name: 'Add', exact: true });
  /** The menu of the actions on all the items: managing their groups, importing, exporting and deleting them */
  readonly itemsMenu = this.root.getByCss('#items-menu');
  readonly exportButton = this.root.getByCss('#export-items');
  readonly importButton = this.root.getByCss('#import-button');
  readonly deleteAllButton = this.root.getByCss('#delete-all');
  readonly searchItems = this.root.getByCss('oib-item-table').getByRole('textbox', { name: 'Search' });
  readonly statusFilter = this.root.getByRole('combobox', { name: 'Status' });
  readonly selectAllButton = this.root.getByRole('button', { name: 'Select all' });
  readonly unselectAllButton = this.root.getByRole('button', { name: 'Unselect all' });
  readonly massActions = this.root.getByRole('button', { name: /Mass actions/ });
  readonly serverNotTrusted = this.root.getByCss('#server-not-trusted-status');

  /** The panel of the trust of a side in the identity of its server */
  serverTrustPanel(side: 'south' | 'north') {
    return this.root.getByCss(`#${side}-server-trust`);
  }

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

const identity: ServerIdentity = { type: 'ssh-host-key', fingerprint: 'SHA256:presented', details: { keyType: 'ssh-ed25519' } };
const trustedIdentity: TrustedServerIdentityDTO = {
  ...identity,
  fingerprint: 'SHA256:trusted',
  trustedBy: { id: 'userId1', friendlyName: 'admin' },
  trustedAt: '2026-01-01T00:00:00.000Z'
};
const pending: PresentedServerIdentity = { identity, status: 'changed' };
const trustedState: ServerTrustStateDTO = { identity: trustedIdentity, trustOnFirstUse: false, pending: null };
const pendingState: ServerTrustStateDTO = { identity: trustedIdentity, trustOnFirstUse: false, pending };
const sides = ['south', 'north'] as const;

describe('HistoryQueryDetailComponent', () => {
  let historyQuery: HistoryQueryDTO;
  let historyQueryService: MockObject<HistoryQueryService>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let northConnectorService: MockObject<NorthConnectorService>;
  let notificationService: MockObject<NotificationService>;
  let confirmationService: MockObject<ConfirmationService>;

  beforeEach(() => {
    historyQuery = structuredClone(testData.historyQueries.list[0]);
    historyQueryService = createMock(HistoryQueryService);
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);
    const scanModeService = createMock(ScanModeService, { created: signal([]) });
    const certificateService = createMock(CertificateService, { created: signal([]) });
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

    await expect.element(tester.title).toHaveTextContent(historyQuery.name);
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

  test('should open the explore wizard wired to the history query explore endpoints', async () => {
    const wizard = createMock(EditWorkflowModalComponent);
    mockModal(wizard);
    const tester = new HistoryQueryDetailComponentTester();

    await tester.exploreButton.click();

    expect(wizard.prepareForExploration).toHaveBeenCalledWith({
      southId: historyQuery.id,
      exploreConnectorId: historyQuery.id,
      exploreApi: { start: expect.any(Function), browse: expect.any(Function), close: expect.any(Function) },
      southSettings: historyQuery.southSettings,
      manifest: testData.south.manifest,
      existingItems: historyQuery.items,
      discover: expect.any(Function),
      saveItems: expect.any(Function)
    });
    // there is no synchronisation, nor schedule, for a history query
    const options = wizard.prepareForExploration.mock.calls[0][0];
    expect(options.sync).toBeUndefined();
    expect(options.schedule).toBeUndefined();
    options.exploreApi!.start(testData.south.list[0].settings, 'folder-scanner');
    expect(historyQueryService.startExplore).toHaveBeenCalledWith(historyQuery.id, testData.south.list[0].settings, 'folder-scanner');
    options.exploreApi!.browse('sessionId', null);
    expect(historyQueryService.browseExplore).toHaveBeenCalledWith(historyQuery.id, 'sessionId', null);
    options.exploreApi!.close('sessionId');
    expect(historyQueryService.closeExplore).toHaveBeenCalledWith(historyQuery.id, 'sessionId');
  });

  test('should let the explore wizard add its items, discovering them through the history query', async () => {
    const wizard = createMock(EditWorkflowModalComponent);
    const discovered = { ...testData.south.itemCommand, id: null, name: 'Reactor/Temperature' };
    mockModal(wizard, { kind: 'items', commands: [discovered] } satisfies ExploreWizardResult);
    historyQueryService.importItems.mockReturnValue(of(undefined));
    const tester = new HistoryQueryDetailComponentTester();

    await tester.exploreButton.click();
    // the wizard saves its items before it closes: closing with them saves nothing more
    expect(historyQueryService.importItems).not.toHaveBeenCalled();
    wizard.prepareForExploration.mock.calls[0][0].saveItems!([discovered]).subscribe();

    expect(historyQueryService.importItems).toHaveBeenCalledTimes(1);
    historyQueryService.discoverItems.mockReturnValue(of([]));
    wizard.prepareForExploration.mock.calls[0][0].discover!({ nodeIds: ['ns=1;s=Reactor'] }, { name: '{{path}}' });
    expect(historyQueryService.discoverItems).toHaveBeenCalledWith(
      historyQuery.id,
      historyQuery.southType,
      historyQuery.southSettings,
      { nodeIds: ['ns=1;s=Reactor'] },
      { name: '{{path}}' }
    );
    expect(historyQueryService.importItems).toHaveBeenCalledWith(historyQuery.id, [
      {
        id: '',
        name: 'Reactor/Temperature',
        description: discovered.description,
        enabled: discovered.enabled,
        settings: discovered.settings
      }
    ]);
    expect(notificationService.success).toHaveBeenCalledWith('south.add-discovered-items.added', { count: '1' });
  });

  test('should give the explore wizard the error of the items it could not add', async () => {
    const wizard = createMock(EditWorkflowModalComponent);
    mockModal(wizard);
    historyQueryService.importItems.mockReturnValue(throwError(() => new Error('duplicate name')));
    const tester = new HistoryQueryDetailComponentTester();

    await tester.exploreButton.click();
    const error = vi.fn();
    wizard.prepareForExploration.mock.calls[0][0].saveItems!([testData.south.itemCommand]).subscribe({ error });

    expect(error).toHaveBeenCalledWith(new Error('duplicate name'));
    expect(notificationService.success).not.toHaveBeenCalled();
  });

  test('should open the item modal with the item the tables checked give, to complete', async () => {
    const itemModal = createMock(EditHistoryQueryItemModalComponent);
    const discovered = { ...testData.south.itemCommand, id: null, name: 'measures_tags' };
    vi.spyOn(TestBed.inject(MockModalService), 'open')
      .mockReturnValueOnce(fakeModal(createMock(EditWorkflowModalComponent), Promise.resolve({ kind: 'item', command: discovered })))
      .mockReturnValueOnce(fakeModal(itemModal, new Promise(() => undefined)));
    const tester = new HistoryQueryDetailComponentTester();

    await tester.exploreButton.click();

    await vi.waitFor(() =>
      expect(itemModal.prepareForCreation).toHaveBeenCalledWith(
        historyQuery.items,
        historyQuery.id,
        null,
        { type: testData.south.manifest.id, settings: historyQuery.southSettings },
        testData.south.manifest,
        null,
        { id: '', name: 'measures_tags', description: discovered.description, enabled: discovered.enabled, settings: discovered.settings }
      )
    );
    expect(historyQueryService.importItems).not.toHaveBeenCalled();
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
    // the connectors do not check the identity of their server
    expect(testModal.allowServerTrust).not.toHaveBeenCalled();
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
      testData.south.manifest,
      null,
      null
    );
    expect(historyQueryService.createItem).toHaveBeenCalledWith(historyQuery.id, command);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.created');
    expect(historyQueryService.findById).toHaveBeenCalledTimes(2);
  });

  test('should create items in a row, each one starting from the one saved before', async () => {
    const firstCommand: HistoryQueryItemCommandDTO = { ...testData.historyQueries.itemCommand, name: 'item3' };
    const nextCommand: HistoryQueryItemCommandDTO = { ...testData.historyQueries.itemCommand, name: 'item4' };
    const firstModal = createMock(EditHistoryQueryItemModalComponent, { addAnother: true });
    const nextModal = createMock(EditHistoryQueryItemModalComponent, { addAnother: false });
    const open = vi
      .spyOn(TestBed.inject(MockModalService), 'open')
      .mockReturnValueOnce(fakeModal(firstModal, Promise.resolve(firstCommand)))
      .mockReturnValueOnce(fakeModal(nextModal, Promise.resolve(nextCommand)));
    historyQueryService.createItem.mockReturnValue(of(historyQuery.items[0]));
    const tester = new HistoryQueryDetailComponentTester();

    await tester.addItemButton.click();

    await vi.waitFor(() => expect(historyQueryService.createItem).toHaveBeenCalledTimes(2));
    // the history query reloads in the background: the next item is checked against the first one too
    expect(nextModal.prepareForCreation).toHaveBeenCalledWith(
      [...historyQuery.items, firstCommand],
      historyQuery.id,
      null,
      { type: testData.south.manifest.id, settings: historyQuery.southSettings },
      testData.south.manifest,
      firstCommand,
      null
    );
    expect(historyQueryService.createItem).toHaveBeenNthCalledWith(1, historyQuery.id, firstCommand);
    expect(historyQueryService.createItem).toHaveBeenNthCalledWith(2, historyQuery.id, nextCommand);
    // the last one was saved with the main action: no other item
    expect(open).toHaveBeenCalledTimes(2);
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

    await tester.itemsMenu.click();

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

    await tester.itemsMenu.click();

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

    await tester.itemsMenu.click();

    await tester.importButton.click();

    expect(importModal.prepare).toHaveBeenCalledWith(
      testData.south.manifest,
      ['name', 'enabled', 'settings_objectArray', 'settings_objectSettings', 'settings_objectValue'],
      ['description', 'scanMode'],
      true,
      expect.any(Function)
    );
    expect(historyQueryService.importItems).toHaveBeenCalledWith(historyQuery.id, items, true);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.imported');
  });

  test('should not check the identities of the servers when the connectors do not', async () => {
    historyQuery = { ...historyQuery, status: 'PAUSED' };
    historyQueryService.start.mockReturnValue(of(undefined));
    const tester = new HistoryQueryDetailComponentTester();
    await expect.element(tester.resumeButton).toBeInTheDocument();

    await tester.resumeButton.click();

    expect(historyQueryService.start).toHaveBeenCalledWith(historyQuery.id);
    expect(historyQueryService.retrieveServerIdentity).not.toHaveBeenCalled();
    expect(historyQueryService.getServerTrust).not.toHaveBeenCalled();
    await expect.element(tester.serverTrustPanel('south')).not.toBeInTheDocument();
    await expect.element(tester.serverTrustPanel('north')).not.toBeInTheDocument();
  });

  describe('server identity', () => {
    beforeEach(() => {
      northConnectorService.getNorthManifest.mockReturnValue(of({ ...testData.north.manifest, serverIdentity: 'ssh-host-key' }));
      southConnectorService.getSouthManifest.mockReturnValue(of({ ...testData.south.manifest, serverIdentity: 'x509' }));
      historyQueryService.getServerTrust.mockReturnValue(of(trustedState));
      historyQueryService.trustServerIdentity.mockReturnValue(of(undefined));
      historyQueryService.start.mockReturnValue(of(undefined));
      historyQueryService.pause.mockReturnValue(of(undefined));
    });

    afterEach(() => vi.useRealTimers());

    test('should poll the trust of both sides in the identities of their servers', async () => {
      vi.useFakeTimers();
      const tester = new HistoryQueryDetailComponentTester();
      await vi.waitFor(() => expect(historyQueryService.getServerTrust).toHaveBeenCalledTimes(2));
      expect(historyQueryService.getServerTrust).toHaveBeenCalledWith(historyQuery.id, 'south');
      expect(historyQueryService.getServerTrust).toHaveBeenCalledWith(historyQuery.id, 'north');

      await expect.element(tester.serverTrustPanel('south')).toMatchTextContent(/Identity of the South server\s*Trusted by admin on/);
      await expect.element(tester.serverTrustPanel('north')).toMatchTextContent(/Identity of the North server\s*Trusted by admin on/);
      await expect.element(tester.serverNotTrusted).not.toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(METRICS_REFRESH_INTERVAL_MS);
      expect(historyQueryService.getServerTrust).toHaveBeenCalledTimes(4);

      tester.fixture.destroy();
      await vi.advanceTimersByTimeAsync(METRICS_REFRESH_INTERVAL_MS);
      expect(historyQueryService.getServerTrust).toHaveBeenCalledTimes(4);
    });

    test.each(sides)('should show that the server is not trusted when the %s refused its identity', async side => {
      historyQueryService.getServerTrust.mockImplementation((_historyId, trustSide) =>
        of(trustSide === side ? pendingState : trustedState)
      );
      const tester = new HistoryQueryDetailComponentTester();

      await expect.element(tester.serverNotTrusted).toHaveTextContent('Server not trusted');
      const other = side === 'south' ? 'north' : 'south';
      await expect.element(tester.serverTrustPanel(side).getByRole('button', { name: 'Review and trust' })).toBeVisible();
      await expect.element(tester.serverTrustPanel(other)).toBeInTheDocument();
      await expect.element(tester.serverTrustPanel(other).getByRole('button', { name: 'Review and trust' })).not.toBeInTheDocument();
    });

    test.each(sides)('should review and trust the identity the %s refused', async side => {
      historyQueryService.getServerTrust.mockImplementation((_historyId, trustSide) =>
        of(trustSide === side ? pendingState : trustedState)
      );
      const trustModal = createMock(ServerTrustModalComponent);
      mockModal(trustModal, 'trust');
      const tester = new HistoryQueryDetailComponentTester();
      const reviewButton = tester.serverTrustPanel(side).getByRole('button', { name: 'Review and trust' });
      await expect.element(reviewButton).toBeVisible();
      historyQueryService.getServerTrust.mockReturnValue(of(trustedState));

      await reviewButton.click();

      expect(trustModal.prepare).toHaveBeenCalledWith('review', pending, trustedIdentity);
      expect(historyQueryService.trustServerIdentity).toHaveBeenCalledWith(historyQuery.id, side, 'SHA256:presented');
      expect(notificationService.success).toHaveBeenCalledWith('server-trust.trusted', { name: historyQuery.name });
      // the trust and the history query are read again
      await expect.element(tester.serverNotTrusted).not.toBeInTheDocument();
      expect(historyQueryService.findById).toHaveBeenCalledTimes(2);
    });

    test.each(sides)('should trust the identity of the %s server from the connection test', async side => {
      const testModal = createMock(TestConnectionResultModalComponent);
      mockModal(testModal);
      const tester = new HistoryQueryDetailComponentTester();

      await (side === 'north' ? tester.testNorthButton : tester.testSouthButton).click();

      expect(testModal.allowServerTrust).toHaveBeenCalledWith({ trusted: null, trust: expect.any(Function) });
      expect(testModal.runHistoryQueryTest).toHaveBeenCalled();
      await firstValueFrom(testModal.allowServerTrust.mock.lastCall![0].trust(identity));
      expect(historyQueryService.trustServerIdentity).toHaveBeenCalledWith(historyQuery.id, side, 'SHA256:presented');
      expect(historyQueryService.findById).toHaveBeenCalledTimes(2);
    });

    describe('start', () => {
      const southPresented: PresentedServerIdentity = { identity, status: 'unknown' };
      const northIdentity: ServerIdentity = { ...identity, fingerprint: 'SHA256:north' };
      const northPresented: PresentedServerIdentity = { identity: northIdentity, status: 'changed' };

      beforeEach(() => {
        historyQuery = { ...historyQuery, status: 'PAUSED' };
        historyQueryService.retrieveServerIdentity.mockImplementation((_historyId, side) =>
          of(side === 'south' ? southPresented : northPresented)
        );
      });

      test('should review the identities of the south then north servers before starting', async () => {
        const southModal = createMock(ServerTrustModalComponent);
        const northModal = createMock(ServerTrustModalComponent);
        vi.spyOn(TestBed.inject(MockModalService), 'open')
          .mockReturnValueOnce(fakeModal(southModal, Promise.resolve('trust')))
          .mockReturnValueOnce(fakeModal(northModal, Promise.resolve('skip')));
        const tester = new HistoryQueryDetailComponentTester();
        await expect.element(tester.resumeButton).toBeInTheDocument();

        await tester.resumeButton.click();

        await vi.waitFor(() => expect(historyQueryService.start).toHaveBeenCalledWith(historyQuery.id));
        expect(historyQueryService.retrieveServerIdentity).toHaveBeenNthCalledWith(
          1,
          historyQuery.id,
          'south',
          historyQuery.southSettings,
          historyQuery.southType
        );
        expect(historyQueryService.retrieveServerIdentity).toHaveBeenNthCalledWith(
          2,
          historyQuery.id,
          'north',
          historyQuery.northSettings,
          historyQuery.northType
        );
        expect(southModal.prepare).toHaveBeenCalledWith('start', southPresented, null);
        expect(northModal.prepare).toHaveBeenCalledWith('start', northPresented, null);
        // only the south identity is trusted, before the north one is reviewed
        expect(historyQueryService.trustServerIdentity).toHaveBeenCalledTimes(1);
        expect(historyQueryService.trustServerIdentity).toHaveBeenCalledWith(historyQuery.id, 'south', 'SHA256:presented');
        expect(historyQueryService.trustServerIdentity.mock.invocationCallOrder[0]).toBeLessThan(
          historyQueryService.retrieveServerIdentity.mock.invocationCallOrder[1]
        );
        expect(historyQueryService.retrieveServerIdentity.mock.invocationCallOrder[1]).toBeLessThan(
          historyQueryService.start.mock.invocationCallOrder[0]
        );
        expect(notificationService.success).toHaveBeenCalledWith('history-query.started', { name: historyQuery.name });
      });

      test('should not start when the review of an identity is cancelled', async () => {
        TestBed.inject<MockModalService<ServerTrustModalComponent>>(MockModalService).mockDismissedModal(
          createMock(ServerTrustModalComponent)
        );
        const tester = new HistoryQueryDetailComponentTester();
        await expect.element(tester.resumeButton).toBeInTheDocument();

        await tester.resumeButton.click();

        expect(historyQueryService.retrieveServerIdentity).toHaveBeenCalledTimes(1);
        expect(historyQueryService.trustServerIdentity).not.toHaveBeenCalled();
        expect(historyQueryService.start).not.toHaveBeenCalled();
        await expect.element(tester.resumeButton).toBeEnabled();
      });

      test('should start directly when the identities are trusted', async () => {
        historyQueryService.retrieveServerIdentity.mockReturnValue(of({ identity, status: 'trusted' }));
        const tester = new HistoryQueryDetailComponentTester();
        await expect.element(tester.resumeButton).toBeInTheDocument();

        // no modal is set up: opening one would fail
        await tester.resumeButton.click();

        expect(historyQueryService.retrieveServerIdentity).toHaveBeenCalledTimes(2);
        expect(historyQueryService.start).toHaveBeenCalledWith(historyQuery.id);
      });
    });

    test('should not review the identities of the servers when pausing', async () => {
      const tester = new HistoryQueryDetailComponentTester();
      await expect.element(tester.pauseButton).toBeInTheDocument();

      await tester.pauseButton.click();

      expect(historyQueryService.pause).toHaveBeenCalledWith(historyQuery.id);
      expect(historyQueryService.retrieveServerIdentity).not.toHaveBeenCalled();
    });
  });
});
