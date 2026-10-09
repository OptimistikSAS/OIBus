import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Params, provideRouter, Router } from '@angular/router';

import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { HistoryQueryItemCommandDTO } from '@oibus/shared/api/history-query.model';
import { HistoryTransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EmptyRouteComponent } from '../../../test/empty-route.component';
import testData from '../../../test/test-data';
import { createMock, MockObject, stubRoute } from '../../../test/vitest-create-mock';
import { CertificateService } from '../../services/certificate.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { TransformerService } from '../../services/transformer.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { provideCurrentUser } from '../../shared/current-user-testing';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { SouthExploreModalComponent } from '../../shared/south-explore-modal/south-explore-modal.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { WindowService } from '../../shared/window.service';
import { EditHistoryQueryItemModalComponent } from '../history-query-items/edit-history-query-item-modal/edit-history-query-item-modal.component';
import { ImportHistoryQueryItemsModalComponent } from '../history-query-items/import-history-query-items-modal/import-history-query-items-modal.component';
import { HistoryQueryTransformersComponent } from '../history-query-transformers/history-query-transformers.component';
import { ResetCacheHistoryQueryModalComponent } from '../reset-cache-history-query-modal/reset-cache-history-query-modal.component';
import { EditHistoryQueryComponent } from './edit-history-query.component';

class EditHistoryQueryComponentTester {
  readonly fixture = TestBed.createComponent(EditHistoryQueryComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly name = this.root.getByLabelText('Name', { exact: true });
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly items = this.root.getByCss('tr.south-item');
  readonly exploreButton = this.root.getByRole('button', { name: 'Explore' });
  readonly testNorthButton = this.root.getByCss('#test-connection-north');
  readonly testSouthButton = this.root.getByCss('#test-connection-south');
  readonly addItemButton = this.root.getByRole('button', { name: 'Add a new item' });
  readonly exportButton = this.root.getByRole('button', { name: 'Export' });
  readonly importButton = this.root.getByRole('button', { name: 'Import', exact: true });
  readonly deleteAllButton = this.root.getByRole('button', { name: 'Delete all' });
  readonly searchItems = this.root.getByRole('textbox', { name: 'Enter text to filter items' });
  readonly statusFilter = this.root.getByRole('combobox', { name: 'Status' });
  readonly selectAllButton = this.root.getByRole('button', { name: 'Select all' });
  readonly massActions = this.root.getByRole('button', { name: /Mass actions/ });
  readonly component = this.fixture.componentInstance;

  itemName(index: number) {
    return this.items.nth(index).getByRole('cell').nth(2);
  }

  itemStatus(index: number) {
    return this.items.nth(index).getByRole('cell').nth(1);
  }

  async expectItemNames(...names: Array<string>) {
    await expect.element(this.items).toHaveLength(names.length);
    for (const [index, name] of names.entries()) {
      await expect.element(this.itemName(index)).toHaveTextContent(name);
    }
  }
}

const savedQuery = testData.historyQueries.list[0];
const newItem: HistoryQueryItemCommandDTO = { ...testData.historyQueries.itemCommand, id: '', name: 'new item' };

describe('EditHistoryQueryComponent', () => {
  let historyQueryService: MockObject<HistoryQueryService>;
  let northConnectorService: MockObject<NorthConnectorService>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let notificationService: MockObject<NotificationService>;
  let confirmationService: MockObject<ConfirmationService>;
  let unsavedChangesConfirmation: MockObject<UnsavedChangesConfirmationService>;

  function configure(route: { params?: Params; queryParams?: Params }) {
    historyQueryService = createMock(HistoryQueryService);
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);
    const scanModeService = createMock(ScanModeService);
    const certificateService = createMock(CertificateService);
    const transformerService = createMock(TransformerService);
    notificationService = createMock(NotificationService);
    confirmationService = createMock(ConfirmationService);
    unsavedChangesConfirmation = createMock(UnsavedChangesConfirmationService);

    northConnectorService.getNorthManifest.mockReturnValue(of(testData.north.manifest));
    southConnectorService.getSouthManifest.mockReturnValue(of(testData.south.manifest));
    scanModeService.list.mockReturnValue(of(testData.scanMode.list));
    certificateService.list.mockReturnValue(of([]));
    transformerService.list.mockReturnValue(of([]));
    historyQueryService.list.mockReturnValue(of(testData.historyQueries.listLight));
    // a new copy each time, as the component aligns the scan mode of the history query with the scan mode list
    historyQueryService.findById.mockImplementation(() => of(structuredClone(savedQuery)));
    historyQueryService.update.mockReturnValue(of(undefined));
    historyQueryService.create.mockReturnValue(of(structuredClone(savedQuery)));
    confirmationService.confirm.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser(),
        provideHttpClientTesting(),
        provideModalTesting(),
        provideRouter([{ path: 'history-queries/:historyQueryId', component: EmptyRouteComponent }]),
        { provide: ActivatedRoute, useValue: stubRoute(route) },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TransformerService, useValue: transformerService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmation },
        { provide: WindowService, useValue: createMock(WindowService, { languageToUse: () => 'en' }) }
      ]
    });
    // registers the default validation error messages
    TestBed.createComponent(DefaultValidationErrorsComponent);
  }

  function mockModal<T>(componentInstance: T, result: unknown = '') {
    TestBed.inject<MockModalService<T>>(MockModalService).mockClosedModal(componentInstance, result);
  }

  /** An item modal mock, with the signals set by the page */
  function itemModalMock(): MockObject<EditHistoryQueryItemModalComponent> {
    return createMock(EditHistoryQueryItemModalComponent, {
      directSave: signal(true),
      inMemoryTransformers: signal<Array<HistoryTransformerDTOWithOptions> | null>(null)
    });
  }

  async function expectNavigationTo(url: string) {
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe(url));
  }

  describe('edit mode', () => {
    beforeEach(() => configure({ params: { historyQueryId: savedQuery.id } }));

    test('should display the history query', async () => {
      const tester = new EditHistoryQueryComponentTester();

      await expect.element(tester.title).toHaveTextContent(`Edit ${savedQuery.name}`);
      await expect.element(tester.name).toHaveValue(savedQuery.name);
      await tester.expectItemNames('item1', 'item2');
      expect(historyQueryService.findById).toHaveBeenCalledWith(savedQuery.id);
      expect(northConnectorService.getNorthManifest).toHaveBeenCalledWith(savedQuery.northType);
      expect(southConnectorService.getSouthManifest).toHaveBeenCalledWith(savedQuery.southType);
    });

    test.each([true, false])('should update the history query, with reset cache %s', async resetCache => {
      mockModal(createMock(ResetCacheHistoryQueryModalComponent), resetCache);
      const tester = new EditHistoryQueryComponentTester();
      await tester.name.fill('updated name');

      await tester.saveButton.click();

      expect(historyQueryService.update).toHaveBeenCalledWith(
        savedQuery.id,
        expect.objectContaining({
          name: 'updated name',
          description: savedQuery.description,
          queryTimeRange: savedQuery.queryTimeRange,
          southType: savedQuery.southType,
          northType: savedQuery.northType,
          caching: expect.objectContaining({ trigger: expect.objectContaining({ scanModeId: 'scanModeId1' }) }),
          items: savedQuery.items.map(item => ({ id: item.id, name: item.name, enabled: item.enabled, settings: item.settings })),
          northTransformers: savedQuery.northTransformers.map(transformer => ({
            id: transformer.id,
            transformerId: transformer.transformer.id,
            options: transformer.options,
            items: transformer.items.map(item => ({ id: item.id, name: item.name, enabled: item.enabled }))
          }))
        }),
        resetCache
      );
      expect(notificationService.success).toHaveBeenCalledWith('history-query.updated', { name: 'updated name' });
      await expectNavigationTo(`/history-queries/${savedQuery.id}`);
    });

    test('should not save an invalid history query', async () => {
      const tester = new EditHistoryQueryComponentTester();
      await tester.name.fill('My second History Query');

      await tester.saveButton.click();

      await expect.element(tester.root.getByText('Must be unique')).toBeInTheDocument();
      expect(historyQueryService.update).not.toHaveBeenCalled();
    });

    test('should ask for confirmation before leaving with unsaved changes', async () => {
      unsavedChangesConfirmation.confirmUnsavedChanges.mockReturnValue(of(true));
      const tester = new EditHistoryQueryComponentTester();
      await expect.element(tester.name).toHaveValue(savedQuery.name);
      expect(tester.component.canDeactivate()).toBe(true);

      await tester.name.fill('updated name');

      expect(tester.component.canDeactivate()).toBeInstanceOf(Observable);
      expect(unsavedChangesConfirmation.confirmUnsavedChanges).toHaveBeenCalled();
    });

    test.each(['north', 'south'] as const)('should test the %s connection', async type => {
      const testModal = createMock(TestConnectionResultModalComponent);
      mockModal(testModal);
      const tester = new EditHistoryQueryComponentTester();

      await (type === 'north' ? tester.testNorthButton : tester.testSouthButton).click();

      expect(testModal.runHistoryQueryTest).toHaveBeenCalledWith(
        type,
        savedQuery.id,
        {},
        type === 'north' ? 'console' : 'folder-scanner',
        null
      );
    });

    test('should open the explore modal wired to the history query explore endpoints', async () => {
      const exploreModal = createMock(SouthExploreModalComponent);
      mockModal(exploreModal);
      historyQueryService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
      historyQueryService.browseExplore.mockReturnValue(of({ entries: [] }));
      historyQueryService.closeExplore.mockReturnValue(of(undefined));
      const tester = new EditHistoryQueryComponentTester();

      await tester.exploreButton.click();

      expect(exploreModal.prepare).toHaveBeenCalledWith(savedQuery.id, {}, 'folder-scanner', {
        start: expect.any(Function),
        browse: expect.any(Function),
        close: expect.any(Function)
      });
      const api = exploreModal.prepare.mock.calls[0][3]!;
      api.start(testData.south.list[0].settings, 'folder-scanner');
      expect(historyQueryService.startExplore).toHaveBeenCalledWith(savedQuery.id, testData.south.list[0].settings, 'folder-scanner', null);
      api.browse('sessionId', null);
      expect(historyQueryService.browseExplore).toHaveBeenCalledWith(savedQuery.id, 'sessionId', null);
      api.close('sessionId');
      expect(historyQueryService.closeExplore).toHaveBeenCalledWith(savedQuery.id, 'sessionId');
    });

    test('should reload the transformers when they are saved directly', async () => {
      const tester = new EditHistoryQueryComponentTester();
      await expect.element(tester.name).toHaveValue(savedQuery.name);

      tester.fixture.debugElement
        .query(By.directive(HistoryQueryTransformersComponent))
        .triggerEventHandler('inMemoryTransformersWithOptions', null);

      expect(historyQueryService.findById).toHaveBeenCalledTimes(2);
    });

    test('should add, duplicate and edit items in memory', async () => {
      const itemModal = itemModalMock();
      mockModal(itemModal, newItem);
      const tester = new EditHistoryQueryComponentTester();

      await tester.addItemButton.click();
      expect(itemModal.directSave()).toBe(false);
      expect(itemModal.inMemoryTransformers()).toEqual(savedQuery.northTransformers);
      expect(itemModal.prepareForCreation).toHaveBeenCalledWith(
        expect.any(Array),
        savedQuery.id,
        '',
        expect.objectContaining({ type: 'folder-scanner' }),
        testData.south.manifest
      );
      await tester.expectItemNames('item1', 'item2', 'new item');

      mockModal(itemModal, { ...newItem, name: 'copy' });
      await tester.items.nth(0).getByRole('button', { name: 'Duplicate item' }).click();
      await tester.expectItemNames('item1', 'item2', 'new item', 'copy');

      mockModal(itemModal, { ...newItem, name: 'edited' });
      await tester.items.nth(1).getByRole('button', { name: 'Edit item' }).click();
      expect(itemModal.prepareForEdition.mock.calls[0][6]).toBe(1);
      await tester.expectItemNames('item1', 'edited', 'new item', 'copy');
      // nothing is saved until the history query is saved
      expect(historyQueryService.createItem).not.toHaveBeenCalled();
    });

    test('should edit the clicked item when several unsaved items share an empty id', async () => {
      const itemModal = itemModalMock();
      const tester = new EditHistoryQueryComponentTester();
      for (const name of ['unsaved-1', 'unsaved-2']) {
        mockModal(itemModal, { ...newItem, name });
        await tester.addItemButton.click();
      }
      await tester.expectItemNames('item1', 'item2', 'unsaved-1', 'unsaved-2');

      mockModal(itemModal, { ...newItem, name: 'unsaved-2-edited' });
      await tester.items.nth(3).getByRole('button', { name: 'Edit item' }).click();

      expect(itemModal.prepareForEdition.mock.calls[0][1]).toEqual({ ...newItem, name: 'unsaved-2' });
      expect(itemModal.prepareForEdition.mock.calls[0][6]).toBe(3);
      await tester.expectItemNames('item1', 'item2', 'unsaved-1', 'unsaved-2-edited');
    });

    test('should delete an item and all the items', async () => {
      const tester = new EditHistoryQueryComponentTester();

      await tester.items.nth(0).getByRole('button', { name: 'Delete item' }).click();
      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'history-query.items.confirm-deletion' });
      await tester.expectItemNames('item2');

      await tester.deleteAllButton.click();
      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'history-query.items.confirm-delete-all' });
      await expect.element(tester.items).not.toBeInTheDocument();
      await expect.element(tester.root.getByText('No items has been defined on this connector yet')).toBeInTheDocument();
      await expect.element(tester.deleteAllButton).toBeDisabled();
    });

    test('should enable, disable and delete the selected items', async () => {
      const tester = new EditHistoryQueryComponentTester();

      await tester.items.nth(0).getByRole('checkbox').click();
      await tester.massActions.click();
      await tester.root.getByRole('button', { name: 'Disable', exact: true }).click();
      await expect.element(tester.itemStatus(0)).toHaveTextContent('Disabled');
      await expect.element(tester.itemStatus(1)).toHaveTextContent('Enabled');
      await expect.element(tester.massActions).not.toBeInTheDocument();

      await tester.selectAllButton.click();
      await tester.massActions.click();
      await tester.root.getByRole('button', { name: 'Enable', exact: true }).click();
      await expect.element(tester.itemStatus(0)).toHaveTextContent('Enabled');

      await tester.items.nth(1).getByRole('checkbox').click();
      await tester.massActions.click();
      await tester.root.getByRole('button', { name: 'Delete', exact: true }).click();
      expect(confirmationService.confirm).toHaveBeenCalledWith({
        messageKey: 'history-query.items.delete-multiple-message',
        interpolateParams: { count: '1' }
      });
      await tester.expectItemNames('item1');
    });

    test('should filter and sort the items', async () => {
      const tester = new EditHistoryQueryComponentTester();

      await tester.searchItems.fill('2');
      await tester.expectItemNames('item2');

      await tester.searchItems.fill('');
      await tester.statusFilter.selectOptions('Disabled');
      await expect.element(tester.root.getByText('No items match the search criteria')).toBeInTheDocument();

      await tester.statusFilter.selectOptions('All statuses');
      const nameHeader = tester.root.getByRole('button', { name: 'Name' });
      await nameHeader.click();
      await nameHeader.click();
      await tester.expectItemNames('item2', 'item1');
    });

    test('should export the saved items', async () => {
      mockModal(createMock(ExportItemModalComponent), { filename: 'items.csv', delimiter: ';' });
      historyQueryService.exportItems.mockReturnValue(of(undefined));
      const tester = new EditHistoryQueryComponentTester();

      await tester.exportButton.click();

      expect(historyQueryService.exportItems).toHaveBeenCalledWith(savedQuery.id, 'items.csv', ';');
    });

    test.each([
      [false, ['item1', 'item2', 'new item']],
      [true, ['new item']]
    ])('should import items, erasing the existing ones: %s', async (eraseExisting, expectedNames) => {
      const importModal = createMock(ImportHistoryQueryItemsModalComponent);
      mockModal(importModal, { items: [newItem], eraseExisting });
      const tester = new EditHistoryQueryComponentTester();

      await tester.importButton.click();

      expect(importModal.prepare).toHaveBeenCalledWith(
        testData.south.manifest,
        expect.any(Array),
        ['scanMode'],
        true,
        expect.any(Function)
      );
      await tester.expectItemNames(...expectedNames);
    });
  });

  describe('create mode', () => {
    test('should create a history query from connector types', async () => {
      configure({ queryParams: { southType: 'mssql', northType: 'console' } });
      const tester = new EditHistoryQueryComponentTester();
      await expect.element(tester.title).toHaveTextContent('Create a new history query');
      expect(northConnectorService.getNorthManifest).toHaveBeenCalledWith('console');
      expect(southConnectorService.getSouthManifest).toHaveBeenCalledWith('mssql');

      await tester.saveButton.click();
      expect(historyQueryService.create).not.toHaveBeenCalled();
      await expect.element(tester.root.getByText('This field is required').first()).toBeInTheDocument();

      await tester.name.fill('new query');
      await tester.root.getByLabelText('Schedule').selectOptions(testData.scanMode.list[0].name);
      await tester.saveButton.click();

      expect(historyQueryService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'new query', southType: 'mssql', northType: 'console', items: [], northTransformers: [] }),
        '',
        '',
        ''
      );
      expect(notificationService.success).toHaveBeenCalledWith('history-query.created', { name: 'new query' });
      await expectNavigationTo(`/history-queries/${savedQuery.id}`);
    });

    test('should create a history query from existing connectors', async () => {
      configure({ queryParams: { southId: 'southId1', northId: 'northId1' } });
      const south = testData.south.list[0];
      const north = testData.north.list[0];
      southConnectorService.findById.mockReturnValue(of(south));
      northConnectorService.findById.mockReturnValue(of(north));
      const tester = new EditHistoryQueryComponentTester();
      await tester.expectItemNames(...south.items.map(item => item.name));

      await tester.name.fill('new query');
      await tester.saveButton.click();

      expect(historyQueryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          southType: south.type,
          northType: north.type,
          items: south.items.map(item => expect.objectContaining({ id: `temp_${item.id}`, name: item.name })),
          // only the transformers of the north applied to the south
          northTransformers: [expect.objectContaining({ id: `temp_${north.transformers[0].id}` })]
        }),
        'southId1',
        'northId1',
        ''
      );
    });

    test('should duplicate a history query', async () => {
      configure({ queryParams: { duplicate: savedQuery.id } });
      const tester = new EditHistoryQueryComponentTester();
      await expect.element(tester.name).toHaveValue(`${savedQuery.name}-copy`);

      await tester.saveButton.click();

      expect(historyQueryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `${savedQuery.name}-copy`,
          items: savedQuery.items.map(item => expect.objectContaining({ id: `temp_${item.id}` }))
        }),
        '',
        '',
        savedQuery.id
      );
    });

    test('should export the unsaved items', async () => {
      configure({ queryParams: { duplicate: savedQuery.id } });
      mockModal(createMock(ExportItemModalComponent), { filename: 'items.csv', delimiter: ';' });
      historyQueryService.itemsToCsv.mockReturnValue(of(undefined));
      const tester = new EditHistoryQueryComponentTester();

      await tester.exportButton.click();

      expect(historyQueryService.itemsToCsv).toHaveBeenCalledWith('folder-scanner', expect.any(Array), 'items.csv', ';');
    });

    test('should explore with the source south id', async () => {
      configure({ queryParams: { southId: 'southId1' } });
      southConnectorService.findById.mockReturnValue(of(testData.south.list[0]));
      historyQueryService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
      const exploreModal = createMock(SouthExploreModalComponent);
      mockModal(exploreModal);
      const tester = new EditHistoryQueryComponentTester();

      await tester.exploreButton.click();

      expect(exploreModal.prepare).toHaveBeenCalledWith(null, expect.anything(), 'folder-scanner', expect.anything());
      exploreModal.prepare.mock.calls[0][3]!.start(testData.south.list[0].settings, 'folder-scanner');
      expect(historyQueryService.startExplore).toHaveBeenCalledWith(
        'create',
        testData.south.list[0].settings,
        'folder-scanner',
        'southId1'
      );
    });
  });
});
