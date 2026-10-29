import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Params, provideRouter, Router } from '@angular/router';

import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { HistoryQueryItemCommandDTO } from '@oibus/shared/api/history-query.model';
import { HistoryTransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';
import { NorthType } from '@oibus/shared/connector/north-manifest.model';
import { SouthType } from '@oibus/shared/connector/south-manifest.model';

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
import { fakeModal, MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { WindowService } from '../../shared/window.service';
import EditWorkflowModalComponent, {
  ExploreWizardResult
} from '../../south/south-workflows/edit-workflow-modal/edit-workflow-modal.component';
import { EditHistoryQueryItemModalComponent } from '../history-query-items/edit-history-query-item-modal/edit-history-query-item-modal.component';
import { ImportHistoryQueryItemsModalComponent } from '../history-query-items/import-history-query-items-modal/import-history-query-items-modal.component';
import { HistoryQueryTransformersComponent } from '../history-query-transformers/history-query-transformers.component';
import { ResetCacheHistoryQueryModalComponent } from '../reset-cache-history-query-modal/reset-cache-history-query-modal.component';
import { EditHistoryQueryComponent, HISTORY_QUERY_STEPS, HistoryQueryStep } from './edit-history-query.component';

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
  readonly addItemButton = this.root.getByRole('button', { name: 'Add', exact: true });
  /** The menu of the actions on all the items: managing their groups, importing, exporting and deleting them */
  readonly itemsMenu = this.root.getByCss('#items-menu');
  readonly exportButton = this.root.getByCss('#export-items');
  readonly importButton = this.root.getByCss('#import-button');
  readonly deleteAllButton = this.root.getByCss('#delete-all');
  readonly searchItems = this.root.getByCss('oib-item-table').getByRole('textbox', { name: 'Search' });
  readonly statusFilter = this.root.getByRole('combobox', { name: 'Status' });
  readonly selectAllButton = this.root.getByRole('button', { name: 'Select all' });
  readonly massActions = this.root.getByRole('button', { name: /Mass actions/ });
  readonly component = this.fixture.componentInstance;
  readonly description = this.root.getByLabelText('Description', { exact: true });
  readonly schedule = this.root.getByLabelText('Schedule');
  readonly nextButton = this.root.getByRole('button', { name: 'Next' });
  readonly addTransformerButton = this.root.getByRole('button', { name: 'Add a transformer' });

  /** The card of a connector type in the connectors step, by the name it starts with */
  connectorType(side: 'south' | 'north', name: string) {
    return this.root.getByCss(`#${side}-connector`).getByRole('button', { name: new RegExp(`^${name}`) });
  }
  readonly reviewErrors = this.root.getByCss('#review-errors');
  readonly reviewChanges = this.root.getByCss('#review-changes');
  readonly itemChanges = this.root.getByCss('#item-changes');
  readonly generalSummary = this.root.getByCss('#general-summary');

  step(step: HistoryQueryStep) {
    return this.root.getByCss(`#history-query-step-${step}`);
  }

  async goTo(step: HistoryQueryStep) {
    await this.step(step).click();
  }

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
const historyModes = { subscription: false, lastPoint: false, lastFile: false, history: true };
const southTypes: Array<SouthType> = [{ id: 'mssql', category: 'database', modes: historyModes }];
const northTypes: Array<NorthType> = [
  { id: 'console', category: 'debug', types: ['file'] },
  { id: 'file-writer', category: 'file', types: ['file'] }
];
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
    // the connectors a new history query is created from
    northConnectorService.getNorthTypes.mockReturnValue(of(northTypes));
    northConnectorService.list.mockReturnValue(of([]));
    southConnectorService.getSouthTypes.mockReturnValue(of(southTypes));
    southConnectorService.list.mockReturnValue(of([]));
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
  function itemModalMock(overrides: Partial<EditHistoryQueryItemModalComponent> = {}): MockObject<EditHistoryQueryItemModalComponent> {
    return createMock(EditHistoryQueryItemModalComponent, {
      directSave: signal(true),
      inMemoryTransformers: signal<Array<HistoryTransformerDTOWithOptions> | null>(null),
      ...overrides
    });
  }

  /** Opens the page, on the given step */
  async function createTester(step: HistoryQueryStep = 'general'): Promise<EditHistoryQueryComponentTester> {
    const tester = new EditHistoryQueryComponentTester();
    // the form is built: the page opens on its first step
    await expect.element(tester.step(HISTORY_QUERY_STEPS[0])).toHaveAttribute('aria-current', 'step');
    await expect.element(tester.name).toBeInTheDocument();
    if (step !== HISTORY_QUERY_STEPS[0]) {
      await tester.goTo(step);
    }
    return tester;
  }

  async function expectNavigationTo(url: string) {
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe(url));
  }

  describe('edit mode', () => {
    beforeEach(() => configure({ params: { historyQueryId: savedQuery.id } }));

    test('should display the history query', async () => {
      const tester = await createTester('items');

      await expect.element(tester.title).toHaveTextContent(`Edit ${savedQuery.name}`);
      await expect.element(tester.name).toHaveValue(savedQuery.name);
      await tester.expectItemNames('item1', 'item2');
      expect(historyQueryService.findById).toHaveBeenCalledWith(savedQuery.id);
      expect(northConnectorService.getNorthManifest).toHaveBeenCalledWith(savedQuery.northType);
      expect(southConnectorService.getSouthManifest).toHaveBeenCalledWith(savedQuery.southType);
    });

    test.each([true, false])('should update the history query, with reset cache %s', async resetCache => {
      mockModal(createMock(ResetCacheHistoryQueryModalComponent), resetCache);
      const tester = await createTester();
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
      const tester = await createTester();
      await tester.name.fill('My second History Query');
      await tester.goTo('north');

      await tester.saveButton.click();

      // the first step with an error opens
      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.root.getByText('Must be unique')).toBeVisible();
      expect(historyQueryService.update).not.toHaveBeenCalled();
    });

    test('should save an edited history query from any step', async () => {
      mockModal(createMock(ResetCacheHistoryQueryModalComponent), false);
      const tester = await createTester('items');
      // Save is the main action, Next a subtle one
      await expect.element(tester.nextButton).toHaveClass('btn-subtle');

      await tester.saveButton.click();

      expect(historyQueryService.update).toHaveBeenCalledWith(savedQuery.id, expect.objectContaining({ name: savedQuery.name }), false);
    });

    test('should show what changed since the edited history query was saved', async () => {
      const tester = await createTester('review');
      await expect.element(tester.reviewChanges).toHaveTextContent('No change since the history query was saved');

      await tester.goTo('general');
      await tester.description.fill('changed description');
      await tester.goTo('items');
      await tester.items.nth(0).getByRole('button', { name: 'Delete item' }).click();
      await tester.goTo('review');

      await expect.element(tester.reviewChanges).toHaveTextContent('Changes since the history query was saved: 2');
      await expect.element(tester.itemChanges).toHaveTextContent('Items added: 0 · changed: 0 · removed: 1');
      await expect.element(tester.generalSummary).toMatchTextContent(/Description\s*Changed\s*changed description/);
    });

    test('should ask for confirmation before leaving with unsaved changes', async () => {
      unsavedChangesConfirmation.confirmUnsavedChanges.mockReturnValue(of(true));
      const tester = await createTester();
      await expect.element(tester.name).toHaveValue(savedQuery.name);
      expect(tester.component.canDeactivate()).toBe(true);

      await tester.name.fill('updated name');

      expect(tester.component.canDeactivate()).toBeInstanceOf(Observable);
      expect(unsavedChangesConfirmation.confirmUnsavedChanges).toHaveBeenCalled();
    });

    test.each(['north', 'south'] as const)('should test the %s connection', async type => {
      const testModal = createMock(TestConnectionResultModalComponent);
      mockModal(testModal);
      const tester = await createTester(type);

      await (type === 'north' ? tester.testNorthButton : tester.testSouthButton).click();

      expect(testModal.runHistoryQueryTest).toHaveBeenCalledWith(
        type,
        savedQuery.id,
        {},
        type === 'north' ? 'console' : 'folder-scanner',
        null
      );
    });

    test('should open the explore wizard wired to the history query explore endpoints', async () => {
      const wizard = createMock(EditWorkflowModalComponent);
      mockModal(wizard);
      const tester = await createTester('items');

      await tester.exploreButton.click();

      expect(wizard.prepareForExploration).toHaveBeenCalledWith({
        southId: savedQuery.id,
        exploreConnectorId: savedQuery.id,
        exploreApi: { start: expect.any(Function), browse: expect.any(Function), close: expect.any(Function) },
        southSettings: {},
        manifest: testData.south.manifest,
        existingItems: expect.any(Array),
        discover: expect.any(Function)
      });
      const options = wizard.prepareForExploration.mock.calls[0][0];
      expect(options.sync).toBeUndefined();
      expect(options.schedule).toBeUndefined();
      options.exploreApi!.start(testData.south.list[0].settings, 'folder-scanner');
      expect(historyQueryService.startExplore).toHaveBeenCalledWith(savedQuery.id, testData.south.list[0].settings, 'folder-scanner', null);
      options.exploreApi!.browse('sessionId', null);
      expect(historyQueryService.browseExplore).toHaveBeenCalledWith(savedQuery.id, 'sessionId', null);
      options.exploreApi!.close('sessionId');
      expect(historyQueryService.closeExplore).toHaveBeenCalledWith(savedQuery.id, 'sessionId');
    });

    test('should add the items of the explore wizard in memory, discovering them through the history query', async () => {
      const wizard = createMock(EditWorkflowModalComponent);
      const discovered = { ...testData.south.itemCommand, id: null, name: 'Reactor/Temperature' };
      mockModal(wizard, { kind: 'items', commands: [discovered] } satisfies ExploreWizardResult);
      const tester = await createTester('items');

      await tester.exploreButton.click();

      historyQueryService.discoverItems.mockReturnValue(of([]));
      wizard.prepareForExploration.mock.calls[0][0].discover!({ nodeIds: ['ns=1;s=Reactor'] }, { name: '{{path}}' });
      expect(historyQueryService.discoverItems).toHaveBeenCalledWith(
        savedQuery.id,
        'folder-scanner',
        {},
        { nodeIds: ['ns=1;s=Reactor'] },
        { name: '{{path}}' },
        null
      );
      await tester.expectItemNames('item1', 'item2', 'Reactor/Temperature');
      // nothing is saved until the history query is saved
      expect(historyQueryService.importItems).not.toHaveBeenCalled();
    });

    test('should reload the transformers when they are saved directly', async () => {
      const tester = await createTester();
      await expect.element(tester.name).toHaveValue(savedQuery.name);

      tester.fixture.debugElement
        .query(By.directive(HistoryQueryTransformersComponent))
        .triggerEventHandler('inMemoryTransformersWithOptions', null);

      expect(historyQueryService.findById).toHaveBeenCalledTimes(2);
    });

    test('should add, duplicate and edit items in memory', async () => {
      const itemModal = itemModalMock();
      mockModal(itemModal, newItem);
      const tester = await createTester('items');

      await tester.addItemButton.click();
      expect(itemModal.directSave()).toBe(false);
      expect(itemModal.inMemoryTransformers()).toEqual(savedQuery.northTransformers);
      expect(itemModal.prepareForCreation).toHaveBeenCalledWith(
        expect.any(Array),
        savedQuery.id,
        '',
        expect.objectContaining({ type: 'folder-scanner' }),
        testData.south.manifest,
        null
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

    test('should add items in a row in memory, each one starting from the one added before', async () => {
      const nextItem: HistoryQueryItemCommandDTO = { ...newItem, name: 'next item' };
      const firstModal = itemModalMock({ addAnother: true });
      const nextModal = itemModalMock({ addAnother: false });
      const open = vi
        .spyOn(TestBed.inject(MockModalService), 'open')
        .mockReturnValueOnce(fakeModal(firstModal, Promise.resolve(newItem)))
        .mockReturnValueOnce(fakeModal(nextModal, Promise.resolve(nextItem)));
      const tester = await createTester('items');

      await tester.addItemButton.click();

      await tester.expectItemNames('item1', 'item2', 'new item', 'next item');
      expect(nextModal.directSave()).toBe(false);
      // the next item is checked against the items with the first one
      expect(nextModal.prepareForCreation).toHaveBeenCalledWith(
        [...firstModal.prepareForCreation.mock.lastCall![0], newItem],
        savedQuery.id,
        '',
        expect.objectContaining({ type: 'folder-scanner' }),
        testData.south.manifest,
        newItem
      );
      // the last one was added with the main action: no other item
      expect(open).toHaveBeenCalledTimes(2);
      expect(historyQueryService.createItem).not.toHaveBeenCalled();
    });

    test('should edit the clicked item when several unsaved items share an empty id', async () => {
      const itemModal = itemModalMock();
      const tester = await createTester('items');
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
      const tester = await createTester('items');

      await tester.items.nth(0).getByRole('button', { name: 'Delete item' }).click();
      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'history-query.items.confirm-deletion' });
      await tester.expectItemNames('item2');

      await tester.itemsMenu.click();

      await tester.deleteAllButton.click();
      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'history-query.items.confirm-delete-all' });
      await expect.element(tester.items).not.toBeInTheDocument();
      await expect.element(tester.root.getByText('No History query items')).toBeInTheDocument();
      await expect.element(tester.deleteAllButton).toBeDisabled();
    });

    test('should enable, disable and delete the selected items', async () => {
      const tester = await createTester('items');

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
      const tester = await createTester('items');

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
      const tester = await createTester('items');

      await tester.itemsMenu.click();

      await tester.exportButton.click();

      expect(historyQueryService.exportItems).toHaveBeenCalledWith(savedQuery.id, 'items.csv', ';');
    });

    test.each([
      [false, ['item1', 'item2', 'new item']],
      [true, ['new item']]
    ])('should import items, erasing the existing ones: %s', async (eraseExisting, expectedNames) => {
      const importModal = createMock(ImportHistoryQueryItemsModalComponent);
      mockModal(importModal, { items: [newItem], eraseExisting });
      const tester = await createTester('items');

      await tester.itemsMenu.click();

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
      const tester = await createTester();
      await expect.element(tester.title).toHaveTextContent('Create a new history query');
      expect(northConnectorService.getNorthManifest).toHaveBeenCalledWith('console');
      expect(southConnectorService.getSouthManifest).toHaveBeenCalledWith('mssql');
      // a new history query is saved from the last step
      await expect.element(tester.saveButton).not.toBeInTheDocument();

      await tester.goTo('review');
      await tester.saveButton.click();
      expect(historyQueryService.create).not.toHaveBeenCalled();
      // the first step with an error opens
      await expect.element(tester.step('north')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.root.getByText('This field is required').first()).toBeVisible();

      await tester.schedule.selectOptions(testData.scanMode.list[0].name);
      await tester.goTo('general');
      await tester.name.fill('new query');
      await tester.goTo('review');
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

    test('should go through the steps of a new history query, the next one opening once the current one is valid', async () => {
      configure({ queryParams: { southType: 'mssql', northType: 'console' } });
      const tester = await createTester('south');
      await expect.element(tester.testSouthButton).toBeVisible();

      await tester.nextButton.click();
      await expect.element(tester.addItemButton).toBeVisible();
      await tester.nextButton.click();
      await expect.element(tester.addTransformerButton).toBeVisible();
      await tester.nextButton.click();
      await expect.element(tester.testNorthButton).toBeVisible();
      // the schedule is required
      await tester.nextButton.click();
      await expect.element(tester.step('north')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.step('north')).toHaveClass('modal-step-invalid');

      await tester.schedule.selectOptions(testData.scanMode.list[0].name);
      await tester.nextButton.click();
      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
      // the name is required
      await tester.nextButton.click();
      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.step('general')).toHaveClass('modal-step-invalid');

      await tester.name.fill('new query');
      // Enter in a field opens the next step too
      await userEvent.keyboard('{Enter}');
      await expect.element(tester.step('review')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.saveButton).toBeVisible();
      await expect.element(tester.nextButton).not.toBeInTheDocument();
      await expect.element(tester.reviewErrors).not.toBeInTheDocument();
      await expect.element(tester.reviewChanges).not.toBeInTheDocument();
      await expect.element(tester.generalSummary).toMatchTextContent(/Name\s*new query/);
    });

    test('should start a new history query with the connectors it is created from', async () => {
      configure({});
      const tester = new EditHistoryQueryComponentTester();
      await expect.element(tester.step('connectors')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.name).not.toBeInTheDocument();

      await tester.nextButton.click();
      await expect.element(tester.root.getByText('This field is required').first()).toBeVisible();
      expect(southConnectorService.getSouthManifest).not.toHaveBeenCalled();

      await tester.connectorType('south', 'Microsoft SQL Server™').click();
      await tester.connectorType('north', 'Console').click();
      await tester.nextButton.click();

      await expect.element(tester.step('south')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.testSouthButton).toBeVisible();
      expect(southConnectorService.getSouthManifest).toHaveBeenCalledWith('mssql');
      expect(northConnectorService.getNorthManifest).toHaveBeenCalledWith('console');

      // back to the same connectors: the history query is kept
      await tester.goTo('general');
      await tester.name.fill('new query');
      await tester.goTo('connectors');
      await tester.goTo('south');
      await expect.element(tester.step('south')).toHaveAttribute('aria-current', 'step');
      expect(confirmationService.confirm).not.toHaveBeenCalled();
      expect(southConnectorService.getSouthManifest).toHaveBeenCalledTimes(1);

      // other connectors start it over, once confirmed
      await tester.goTo('connectors');
      await tester.connectorType('north', 'File writer').click();
      await tester.nextButton.click();
      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'history-query.steps.confirm-connectors-change' });
      await expect.element(tester.step('south')).toHaveAttribute('aria-current', 'step');
      expect(northConnectorService.getNorthManifest).toHaveBeenLastCalledWith('file-writer');
      await tester.goTo('general');
      await expect.element(tester.name).toHaveValue('');

      await tester.name.fill('new query');
      await tester.goTo('north');
      await tester.schedule.selectOptions(testData.scanMode.list[0].name);
      await tester.goTo('review');
      await tester.saveButton.click();
      expect(historyQueryService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'new query', southType: 'mssql', northType: 'file-writer' }),
        '',
        '',
        ''
      );
    });

    test('should list the steps to fix in the review, and open them', async () => {
      configure({ queryParams: { southType: 'mssql', northType: 'console' } });
      const tester = await createTester('review');

      await expect.element(tester.reviewErrors).toMatchTextContent(/Fix these steps before saving:\s*North\s*General/);
      await tester.reviewErrors.getByRole('button', { name: 'North' }).click();

      await expect.element(tester.step('north')).toHaveAttribute('aria-current', 'step');
    });

    test('should create a history query from existing connectors', async () => {
      configure({ queryParams: { southId: 'southId1', northId: 'northId1' } });
      const south = testData.south.list[0];
      const north = testData.north.list[0];
      southConnectorService.findById.mockReturnValue(of(south));
      northConnectorService.findById.mockReturnValue(of(north));
      const tester = await createTester('items');
      await tester.expectItemNames(...south.items.map(item => item.name));

      await tester.goTo('general');
      await tester.name.fill('new query');
      await tester.goTo('review');
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
      const tester = await createTester();
      await expect.element(tester.name).toHaveValue(`${savedQuery.name}-copy`);
      await tester.goTo('review');
      // a copy is new: nothing to compare with
      await expect.element(tester.reviewChanges).not.toBeInTheDocument();

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
      const tester = await createTester('items');

      await tester.itemsMenu.click();

      await tester.exportButton.click();

      expect(historyQueryService.itemsToCsv).toHaveBeenCalledWith('folder-scanner', expect.any(Array), 'items.csv', ';');
    });

    test('should explore with the source south id', async () => {
      configure({ queryParams: { southId: 'southId1' } });
      southConnectorService.findById.mockReturnValue(of(testData.south.list[0]));
      historyQueryService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
      const wizard = createMock(EditWorkflowModalComponent);
      mockModal(wizard);
      const tester = await createTester('items');

      await tester.exploreButton.click();

      const options = wizard.prepareForExploration.mock.calls[0][0];
      expect(options.exploreConnectorId).toBeNull();
      options.exploreApi!.start(testData.south.list[0].settings, 'folder-scanner');
      expect(historyQueryService.startExplore).toHaveBeenCalledWith(
        'create',
        testData.south.list[0].settings,
        'folder-scanner',
        'southId1'
      );
    });
  });
});
