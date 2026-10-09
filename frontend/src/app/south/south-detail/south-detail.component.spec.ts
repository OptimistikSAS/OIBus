import { Clipboard } from '@angular/cdk/clipboard';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { firstValueFrom, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { LogDTO } from '@oibus/shared/api/logs.model';
import { SouthConnectorFolderScannerDTO, SouthConnectorMQTTDTO, SouthItemLastValueResponse } from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { buildSouthItemGroup, buildSouthItemGroupCommand } from '../../../test/builders';
import testData from '../../../test/test-data';
import { createMock, MockObject, stubRoute } from '../../../test/vitest-create-mock';
import { CertificateService } from '../../services/certificate.service';
import { EngineService } from '../../services/engine.service';
import { LogService } from '../../services/log.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { provideCurrentUser } from '../../shared/current-user-testing';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { SouthExploreModalComponent } from '../../shared/south-explore-modal/south-explore-modal.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { emptyPage } from '../../shared/utils/page.utils';
import EditSouthItemModalComponent from '../south-items/edit-south-item-modal/edit-south-item-modal.component';
import { ImportSouthItemsModalComponent } from '../south-items/import-south-items-modal/import-south-items-modal.component';
import ManageGroupsModalComponent from '../south-items/manage-groups-modal/manage-groups-modal.component';
import { SelectGroupModalComponent } from '../south-items/select-group-modal/select-group-modal.component';
import { ViewItemValueModalComponent } from '../south-items/view-item-value-modal/view-item-value-modal.component';
import ManageWorkflowsModalComponent from '../south-workflows/manage-workflows-modal/manage-workflows-modal.component';
import { SouthDetailComponent } from './south-detail.component';

const manifest = testData.south.manifest;
const scanModes = testData.scanMode.list;
const groupA = buildSouthItemGroup('groupA', 'Group A', scanModes[1]);

type FolderScannerItem = SouthConnectorFolderScannerDTO['items'][number];

function folderScannerSouth(): SouthConnectorFolderScannerDTO {
  const south = testData.south.list[0];
  if (south.type !== 'folder-scanner') {
    throw new Error('The first south connector of the test data must be a folder scanner');
  }
  return south;
}

const baseSouth = folderScannerSouth();

function buildItem(id: string, name: string, overrides: Partial<FolderScannerItem> = {}): FolderScannerItem {
  return { ...baseSouth.items[0], id, name, ...overrides };
}

// "item b" is first, to check the sort
const itemB = buildItem('itemB', 'item b', { createdAt: '2024-01-02T00:00:00.000Z' });
const itemA = buildItem('itemA', 'item a', { enabled: false, scanMode: scanModes[1], createdAt: '2024-01-03T00:00:00.000Z' });
const itemC = buildItem('itemC', 'item c', { group: groupA, syncWithGroup: true, createdAt: '2024-01-01T00:00:00.000Z' });

const southConnector: SouthConnectorFolderScannerDTO = { ...baseSouth, groups: [groupA], items: [itemB, itemA, itemC] };

class SouthDetailComponentTester {
  readonly fixture = TestBed.createComponent(SouthDetailComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByCss('#title');
  readonly editButton = this.root.getByRole('button', { name: 'Edit south connector' });
  readonly auditButton = this.root.getByRole('button', { name: 'View south connector audit history' });
  readonly stopButton = this.root.getByRole('button', { name: 'Stop south connector' });
  readonly startButton = this.root.getByRole('button', { name: 'Start south connector' });
  readonly copyCachePathButton = this.root.getByRole('button', { name: 'Copy cache path to clipboard' });
  readonly metrics = this.root.getByCss('oib-south-metrics');
  readonly exploreButton = this.root.getByRole('button', { name: 'Explore' });
  readonly testConnectionButton = this.root.getByRole('button', { name: 'Test settings' });
  readonly settings = this.root.getByCss('.south-settings tr');

  readonly items = this.root.getByCss('oib-box.oib-south-items');
  readonly itemsTitle = this.items.getByCss('.oib-box-title');
  readonly manageGroupsButton = this.items.getByRole('button', { name: /^Manage groups/ });
  readonly manageWorkflowsButton = this.items.getByRole('button', { name: 'Manage sync configuration' });
  readonly addItemButton = this.items.getByRole('button', { name: 'Create a new item' });
  readonly exportButton = this.items.getByRole('button', { name: 'Export' });
  readonly importButton = this.items.getByRole('button', { name: 'Import' });
  readonly deleteAllButton = this.items.getByRole('button', { name: 'Delete all' });
  readonly search = this.items.getByRole('textbox', { name: 'Search' });
  readonly groupFilter = this.items.getByRole('combobox', { name: 'Group' });
  readonly scanModeFilter = this.items.getByRole('combobox', { name: 'Schedule' });
  readonly statusFilter = this.items.getByRole('combobox', { name: 'Status' });
  readonly selectAllButton = this.items.getByRole('button', { name: 'Select all' });
  readonly unselectAllButton = this.items.getByRole('button', { name: 'Unselect all' });
  readonly massActionsButton = this.items.getByCss('#mass-actions-dropdown');
  readonly massActions = this.items.getByCss('.dropdown-menu');
  readonly rows = this.items.getByCss('tr.south-item');
  readonly itemNames = this.items.getByCss('tr.south-item td:nth-child(3)');
  readonly noItems = this.items.getByText('No items has been defined on this connector yet');
  readonly noMatch = this.items.getByText('No items match the search criteria');
  readonly pagination = this.items.getByCss('oib-pagination');

  row(index: number) {
    return this.rows.nth(index);
  }

  itemAction(index: number, action: 'Edit item' | 'View Last Value' | 'Copy item' | 'Delete item' | 'View item audit history') {
    return this.row(index).getByRole('button', { name: action });
  }

  sortBy(column: 'Status' | 'Name' | 'Group (Schedule)' | 'Created' | 'Updated') {
    return this.items.getByCss('thead').getByRole('button', { name: column, exact: true });
  }

  massAction(action: 'Enable' | 'Disable' | 'Move to group' | 'Delete') {
    return this.massActions.getByRole('button', { name: action, exact: true });
  }

  async expectItems(...names: Array<string>) {
    await expect.element(this.rows).toHaveLength(names.length);
    for (const [index, name] of names.entries()) {
      await expect.element(this.itemNames.nth(index)).toHaveTextContent(name);
    }
  }
}

/** Creates the component and waits for the connector to be loaded, so that the tests can then change the mocks. */
async function createTester(): Promise<SouthDetailComponentTester> {
  const tester = new SouthDetailComponentTester();
  await expect.element(tester.title).toBeVisible();
  return tester;
}

describe('SouthDetailComponent', () => {
  let southConnectorService: MockObject<SouthConnectorService>;
  let notificationService: MockObject<NotificationService>;
  let confirmationService: MockObject<ConfirmationService>;
  let clipboard: MockObject<Clipboard>;
  let modalService: MockModalService<unknown>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    const scanModeService = createMock(ScanModeService);
    const certificateService = createMock(CertificateService);
    const engineService = createMock(EngineService, { info$: of(testData.engine.oIBusInfo) });
    const logService = createMock(LogService);
    notificationService = createMock(NotificationService);
    confirmationService = createMock(ConfirmationService);
    clipboard = createMock(Clipboard);

    scanModeService.list.mockReturnValue(of(scanModes));
    certificateService.list.mockReturnValue(of([]));
    logService.search.mockReturnValue(of(emptyPage<LogDTO>()));
    confirmationService.confirm.mockReturnValue(of(undefined));
    southConnectorService.findById.mockReturnValue(of(southConnector));
    southConnectorService.getSouthManifest.mockReturnValue(of(manifest));
    southConnectorService.getMetrics.mockReturnValue(of(testData.south.metrics));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideCurrentUser(),
        provideModalTesting(),
        { provide: ActivatedRoute, useValue: stubRoute({ params: { southId: southConnector.id } }) },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: EngineService, useValue: engineService },
        { provide: LogService, useValue: logService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: Clipboard, useValue: clipboard }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  /** Mocks the next opened modal with a fake component, closed with the given value, and returns its component. */
  function mockModal<T>(fakeComponent: T, value: unknown = undefined): T {
    modalService.mockClosedModal(fakeComponent, value);
    return fakeComponent;
  }

  describe('connector', () => {
    afterEach(() => vi.useRealTimers());

    test('should display the south connector', async () => {
      const tester = await createTester();

      await expect.element(tester.title).toMatchTextContent('South South 1');
      await expect.element(tester.stopButton).toBeVisible();
      await expect.element(tester.settings).toHaveLength(1);
      await expect.element(tester.settings.nth(0)).toHaveTextContent('Statusactive');
      await expect.element(tester.metrics).toBeVisible();
      await expect.element(tester.exploreButton).toBeVisible();
      expect(southConnectorService.findById).toHaveBeenCalledWith('southId1');
      expect(southConnectorService.getSouthManifest).toHaveBeenCalledWith('folder-scanner');
    });

    test('should display the settings enabled by the other settings', async () => {
      const settingAttribute = manifest.items.rootAttribute.attributes[0];
      const southManifest: SouthConnectorManifest = {
        ...manifest,
        settings: {
          ...manifest.settings,
          attributes: [
            { ...settingAttribute, key: 'inputFolder', translationKey: 'configuration.oibus.manifest.south.folder-scanner.input-folder' },
            { ...settingAttribute, key: 'domain', translationKey: 'configuration.oibus.manifest.south.folder-scanner.smb-domain' },
            { ...settingAttribute, key: 'username', translationKey: 'configuration.oibus.manifest.south.folder-scanner.smb-username' }
          ],
          enablingConditions: [
            { referralPathFromRoot: 'compression', targetPathFromRoot: 'domain', values: [false] },
            { referralPathFromRoot: 'inputFolder', targetPathFromRoot: 'username', values: ['input'] }
          ]
        }
      };
      southConnectorService.getSouthManifest.mockReturnValue(of(southManifest));
      const tester = await createTester();

      await expect.element(tester.settings).toHaveLength(3);
      await expect.element(tester.settings.nth(1)).toHaveTextContent('Input folderinput');
      await expect.element(tester.settings.nth(2)).toHaveTextContent('SMB username');
    });

    test('should hide the explore button when the manifest does not support exploration', async () => {
      southConnectorService.getSouthManifest.mockReturnValue(of({ ...manifest, explore: false }));
      const tester = await createTester();

      await expect.element(tester.testConnectionButton).toBeVisible();
      await expect.element(tester.exploreButton).not.toBeInTheDocument();
    });

    test('should poll the south connector metrics', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const tester = await createTester();
      await expect.element(tester.title).toMatchTextContent('South 1');
      await vi.advanceTimersByTimeAsync(0);
      await expect.element(tester.metrics).toBeVisible();
      expect(southConnectorService.getMetrics).toHaveBeenCalledTimes(1);
      expect(southConnectorService.getMetrics).toHaveBeenCalledWith('southId1');

      await vi.advanceTimersByTimeAsync(5000);

      expect(southConnectorService.getMetrics).toHaveBeenCalledTimes(2);
    });

    test.each([
      { enabled: true, button: 'stopButton', method: 'stop', message: 'south.stopped', newButton: 'startButton' },
      { enabled: false, button: 'startButton', method: 'start', message: 'south.started', newButton: 'stopButton' }
    ] as const)('should $method the connector', async ({ enabled, button, method, message, newButton }) => {
      southConnectorService.findById.mockReturnValue(of({ ...southConnector, enabled }));
      southConnectorService[method].mockReturnValue(of(undefined));
      const tester = await createTester();
      await expect.element(tester[button]).toBeVisible();
      southConnectorService.findById.mockReturnValue(of({ ...southConnector, enabled: !enabled }));

      await tester[button].click();

      expect(southConnectorService[method]).toHaveBeenCalledWith('southId1');
      expect(notificationService.success).toHaveBeenCalledWith(message, { name: 'South 1' });
      await expect.element(tester[newButton]).toBeVisible();
    });

    test.each([
      { copied: true, notification: 'success', message: 'south.cache-path-copy.success' },
      { copied: false, notification: 'error', message: 'south.cache-path-copy.error' }
    ] as const)('should copy the cache path (copied: $copied)', async ({ copied, notification, message }) => {
      clipboard.copy.mockReturnValue(copied);
      const tester = await createTester();

      await tester.copyCachePathButton.click();

      expect(clipboard.copy).toHaveBeenCalledWith(`${testData.engine.oIBusInfo.dataDirectory}/cache/data-stream/south-southId1`);
      expect(notificationService[notification]).toHaveBeenCalledWith(message);
    });

    test('should test the connection', async () => {
      const tester = await createTester();
      const testConnectionModal = mockModal(createMock(TestConnectionResultModalComponent));

      await tester.testConnectionButton.click();

      expect(testConnectionModal.runTest).toHaveBeenCalledWith('south', 'southId1', southConnector.settings, 'folder-scanner');
    });

    test('should open the explore modal with the persisted connector id, settings and type', async () => {
      const tester = await createTester();
      const exploreModal = mockModal(createMock(SouthExploreModalComponent));
      const open = vi.spyOn(modalService, 'open');

      await tester.exploreButton.click();

      expect(open).toHaveBeenCalledWith(SouthExploreModalComponent, { size: 'lg' });
      expect(exploreModal.prepare).toHaveBeenCalledWith('southId1', southConnector.settings, 'folder-scanner');
    });

    test('should open the audit history of the south connector and of its items', async () => {
      const tester = await createTester();
      const auditModal = mockModal(createMock(AuditHistoryModalComponent));
      const open = vi.spyOn(modalService, 'open');

      await tester.auditButton.click();
      expect(open).toHaveBeenCalledWith(AuditHistoryModalComponent, { size: 'xl' });
      expect(auditModal.prepare).toHaveBeenCalledWith('south_connector', 'southId1');

      await tester.itemAction(0, 'View item audit history').click();
      expect(auditModal.prepare).toHaveBeenLastCalledWith('south_item', 'itemB');
    });
  });

  describe('items', () => {
    test('should display the items', async () => {
      const tester = await createTester();

      await tester.expectItems('item b', 'item a', 'item c');
      await expect.element(tester.itemsTitle).toMatchTextContent('Items(3)');
      await expect.element(tester.row(0)).toMatchTextContent('Enabled');
      await expect.element(tester.row(0)).toMatchTextContent(/None\s*\(scanMode1\)/);
      await expect.element(tester.row(1)).toMatchTextContent('Disabled');
      await expect.element(tester.row(2)).toMatchTextContent(/Group A\s*\(scanMode2\)/);
      await expect.element(tester.pagination).not.toBeVisible();
    });

    test('should display a caption when there is no item', async () => {
      southConnectorService.findById.mockReturnValue(of({ ...southConnector, items: [] }));
      const tester = await createTester();

      await expect.element(tester.noItems).toBeVisible();
      await expect.element(tester.deleteAllButton).toBeDisabled();
    });

    test('should display the schedule details of an item in a tooltip', async () => {
      const tester = await createTester();

      await tester.row(2).getByCss('td:nth-child(4) > span').hover();

      const tooltip = page.getByCss('.schedule-tooltip');
      await expect.element(tooltip).toMatchTextContent('Group: Group A');
      await expect.element(tooltip).toMatchTextContent('Schedule: scanMode2');
      await expect.element(tooltip).toMatchTextContent('Max read interval: 3600s');
    });

    test('should filter the items', async () => {
      const tester = await createTester();

      await tester.search.fill('ITEM A');
      await tester.expectItems('item a');
      await tester.search.fill('');

      await tester.groupFilter.selectOptions('None');
      await tester.expectItems('item b', 'item a');
      await tester.groupFilter.selectOptions('Group A');
      await tester.expectItems('item c');
      await tester.groupFilter.selectOptions('All groups');

      await tester.scanModeFilter.selectOptions('scanMode2');
      // item c has no scan mode of its own, but its group has this one
      await tester.expectItems('item a', 'item c');
      await tester.scanModeFilter.selectOptions('All schedules');

      await tester.statusFilter.selectOptions('Disabled');
      await tester.expectItems('item a');
      await tester.statusFilter.selectOptions('Enabled');
      await tester.expectItems('item b', 'item c');

      await tester.search.fill('unknown');
      await expect.element(tester.noMatch).toBeVisible();
      await expect.element(tester.itemsTitle).not.toMatchTextContent('(');
    });

    test.each([
      { column: 'Name', ascending: ['item a', 'item b', 'item c'], descending: ['item c', 'item b', 'item a'] },
      { column: 'Status', ascending: ['item a', 'item b', 'item c'], descending: ['item b', 'item c', 'item a'] },
      { column: 'Group (Schedule)', ascending: ['item b', 'item a', 'item c'], descending: ['item c', 'item b', 'item a'] },
      { column: 'Created', ascending: ['item c', 'item b', 'item a'], descending: ['item a', 'item b', 'item c'] }
    ] as const)('should sort the items by $column', async ({ column, ascending, descending }) => {
      const tester = await createTester();
      await tester.expectItems('item b', 'item a', 'item c');

      await tester.sortBy(column).click();
      await tester.expectItems(...ascending);
      await expect.element(tester.sortBy(column).getByCss('.fa-sort-up')).toBeInTheDocument();

      await tester.sortBy(column).click();
      await tester.expectItems(...descending);
      await expect.element(tester.sortBy(column).getByCss('.fa-sort-down')).toBeInTheDocument();
    });

    test('should paginate the items and go back to the first page when filtering', async () => {
      const items = Array.from({ length: 25 }, (_, index) => buildItem(`item${index}`, `item ${String(index).padStart(2, '0')}`));
      southConnectorService.findById.mockReturnValue(of({ ...southConnector, items }));
      const tester = await createTester();
      await expect.element(tester.rows).toHaveLength(20);

      await tester.pagination.getByRole('link', { name: '2' }).click();
      await expect.element(tester.rows).toHaveLength(5);
      await expect.element(tester.itemNames.nth(0)).toHaveTextContent('item 20');

      await tester.search.fill('item 1');
      await tester.expectItems(...Array.from({ length: 10 }, (_, index) => `item 1${index}`));
    });

    test('should create an item', async () => {
      const tester = await createTester();
      const command = testData.south.itemCommand;
      const editModal = mockModal(createMock(EditSouthItemModalComponent), command);
      const open = vi.spyOn(modalService, 'open');
      southConnectorService.createItem.mockReturnValue(of(buildItem('newSouthItemId', 'New South Item')));
      const updatedSouth: SouthConnectorFolderScannerDTO = {
        ...southConnector,
        items: [...southConnector.items, buildItem('new', 'item d')]
      };
      southConnectorService.findById.mockReturnValue(of(updatedSouth));

      await tester.addItemButton.click();

      expect(open).toHaveBeenCalledWith(EditSouthItemModalComponent, { size: 'xl', beforeDismiss: expect.any(Function) });
      expect(editModal.prepareForCreation).toHaveBeenCalledWith(
        southConnector.items,
        scanModes,
        [],
        southConnector.groups,
        manifest,
        'southId1',
        expect.objectContaining({ id: 'southId1', configurationWorkflows: [] }),
        expect.any(Function),
        expect.any(Function)
      );
      expect(southConnectorService.createItem).toHaveBeenCalledWith('southId1', command);
      expect(notificationService.success).toHaveBeenCalledWith('south.items.created');
      await tester.expectItems('item b', 'item a', 'item c', 'item d');

      // the modal is asked before being dismissed
      editModal.canDismiss.mockReturnValue(of(false));
      await expect(open.mock.lastCall![1]!.beforeDismiss!()).resolves.toBe(false);
    });

    test('should edit an item', async () => {
      const tester = await createTester();
      const command = { ...testData.south.itemCommand, id: 'itemA', name: 'item a renamed' };
      const editModal = mockModal(createMock(EditSouthItemModalComponent), command);
      const open = vi.spyOn(modalService, 'open');
      southConnectorService.updateItem.mockReturnValue(of(undefined));
      southConnectorService.findById.mockReturnValue(
        of({ ...southConnector, items: [itemB, { ...itemA, name: 'item a renamed' }, itemC] })
      );

      await tester.itemAction(1, 'Edit item').click();

      expect(editModal.prepareForEdition).toHaveBeenCalledWith(
        southConnector.items,
        scanModes,
        [],
        southConnector.groups,
        manifest,
        itemA,
        'southId1',
        expect.objectContaining({ id: 'southId1' }),
        1,
        expect.any(Function),
        expect.any(Function)
      );
      expect(southConnectorService.updateItem).toHaveBeenCalledWith('southId1', 'itemA', command);
      expect(notificationService.success).toHaveBeenCalledWith('south.items.updated');
      await tester.expectItems('item b', 'item a renamed', 'item c');

      editModal.canDismiss.mockReturnValue(true);
      expect(open.mock.lastCall![1]!.beforeDismiss!()).toBe(true);
    });

    test('should duplicate an item', async () => {
      const tester = await createTester();
      const command = { ...testData.south.itemCommand, id: '', name: 'item a copy' };
      const editModal = mockModal(createMock(EditSouthItemModalComponent), command);
      const open = vi.spyOn(modalService, 'open');
      southConnectorService.createItem.mockReturnValue(of(buildItem('copy', 'item a copy')));

      await tester.itemAction(1, 'Copy item').click();

      expect(open).toHaveBeenCalledWith(EditSouthItemModalComponent, { size: 'xl', backdrop: 'static' });
      expect(editModal.prepareForCopy).toHaveBeenCalledWith(
        southConnector.items,
        scanModes,
        [],
        southConnector.groups,
        manifest,
        itemA,
        'southId1',
        expect.objectContaining({ id: 'southId1' }),
        expect.any(Function),
        expect.any(Function)
      );
      expect(southConnectorService.createItem).toHaveBeenCalledWith('southId1', { ...command, id: null });
      expect(notificationService.success).toHaveBeenCalledWith('south.items.created');
    });

    test('should delete an item', async () => {
      const tester = await createTester();
      southConnectorService.deleteItem.mockReturnValue(of(undefined));
      southConnectorService.findById.mockReturnValue(of({ ...southConnector, items: [itemB, itemC] }));

      await tester.itemAction(1, 'Delete item').click();

      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'south.items.confirm-deletion' });
      expect(southConnectorService.deleteItem).toHaveBeenCalledWith('southId1', 'itemA');
      expect(notificationService.success).toHaveBeenCalledWith('south.items.deleted');
      await tester.expectItems('item b', 'item c');
    });

    test('should delete all the items', async () => {
      const tester = await createTester();
      southConnectorService.deleteAllItems.mockReturnValue(of(undefined));
      southConnectorService.findById.mockReturnValue(of({ ...southConnector, items: [] }));

      await tester.deleteAllButton.click();

      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'south.items.confirm-delete-all' });
      expect(southConnectorService.deleteAllItems).toHaveBeenCalledWith('southId1');
      expect(notificationService.success).toHaveBeenCalledWith('south.items.all-deleted');
      await expect.element(tester.noItems).toBeVisible();
    });

    test('should view the last value of an item', async () => {
      const tester = await createTester();
      const viewModal = mockModal(createMock(ViewItemValueModalComponent));
      const response: SouthItemLastValueResponse = { itemLastValue: null, groupLastValue: null };
      southConnectorService.getItemLastValue.mockReturnValue(of(response));

      await tester.itemAction(2, 'View Last Value').click();

      expect(viewModal.prepare).toHaveBeenCalledWith('folder-scanner', 'item c', 'Group A');
      expect(southConnectorService.getItemLastValue).toHaveBeenCalledWith('southId1', 'itemC');
      expect(viewModal.setData).toHaveBeenCalledWith(response);
    });

    test('should display the error when the last value of an item cannot be fetched', async () => {
      const tester = await createTester();
      const viewModal = mockModal(createMock(ViewItemValueModalComponent));
      southConnectorService.getItemLastValue.mockReturnValue(throwError(() => new Error('boom')));

      await tester.itemAction(0, 'View Last Value').click();

      expect(viewModal.prepare).toHaveBeenCalledWith('folder-scanner', 'item b', 'None');
      expect(viewModal.setError).toHaveBeenCalledWith('boom');
    });

    test('should export the items', async () => {
      const tester = await createTester();
      const exportModal = mockModal(createMock(ExportItemModalComponent), { filename: 'items', delimiter: ';' });
      southConnectorService.exportItems.mockReturnValue(of(undefined));

      await tester.exportButton.click();

      expect(exportModal.prepare).toHaveBeenCalledWith('South 1');
      expect(southConnectorService.exportItems).toHaveBeenCalledWith('southId1', 'items', ';');
    });

    test('should not export the items when the export modal is closed without response', async () => {
      const tester = await createTester();
      mockModal(createMock(ExportItemModalComponent));

      await tester.exportButton.click();

      expect(southConnectorService.exportItems).not.toHaveBeenCalled();
    });

    test('should import items', async () => {
      const tester = await createTester();
      const command = testData.south.itemCommand;
      const importModal = mockModal(createMock(ImportSouthItemsModalComponent), { items: [command], eraseExisting: true });
      southConnectorService.importItems.mockReturnValue(of(undefined));
      southConnectorService.checkImportItems.mockReturnValue(of({ items: [{ ...itemC, settings: command.settings }], errors: [] }));

      await tester.importButton.click();

      expect(importModal.prepare).toHaveBeenCalledWith(
        manifest,
        expect.arrayContaining(['name', 'enabled', 'scanMode']),
        expect.arrayContaining(['group', 'recoveryStrategy', 'syncWithGroup']),
        [],
        false,
        true,
        expect.any(Function)
      );
      expect(southConnectorService.importItems).toHaveBeenCalledWith('southId1', [command], true);
      expect(notificationService.success).toHaveBeenCalledWith('south.items.import.imported');

      // the check function given to the modal converts the checked items into commands
      const checkFn = importModal.prepare.mock.lastCall![6];
      const file = new File([''], 'items.csv');
      const checked = await firstValueFrom(checkFn(file, ';', false));
      expect(southConnectorService.checkImportItems).toHaveBeenCalledWith('folder-scanner', southConnector.items, file, ';', false);
      expect(checked.items[0]).toEqual(
        expect.objectContaining({ id: 'itemC', scanModeId: itemC.scanMode!.id, groupId: 'groupA', groupName: 'Group A' })
      );
    });

    test('should give the existing topics to the import modal of an MQTT connector', async () => {
      southConnectorService.getSouthManifest.mockReturnValue(of({ ...manifest, id: 'mqtt' }));
      const mqttSouth: SouthConnectorMQTTDTO = {
        ...southConnector,
        type: 'mqtt',
        settings: {
          url: 'mqtt://localhost:1883',
          qos: '1',
          authentication: { type: 'none' },
          rejectUnauthorized: false,
          reconnectPeriod: 1000,
          connectTimeout: 1000,
          maxNumberOfMessages: 1000,
          flushMessageTimeout: 1000
        },
        items: [
          { ...buildItem('item1', 'item 1'), settings: { topic: 'a/b' } },
          { ...buildItem('item2', 'item 2'), settings: { topic: ' ' } }
        ]
      };
      southConnectorService.findById.mockReturnValue(of(mqttSouth));
      const tester = await createTester();
      const importModal = mockModal(createMock(ImportSouthItemsModalComponent));

      await tester.importButton.click();

      expect(importModal.prepare).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'mqtt' }),
        expect.any(Array),
        expect.any(Array),
        ['a/b'],
        true,
        true,
        expect.any(Function)
      );
      expect(southConnectorService.importItems).not.toHaveBeenCalled();
    });
  });

  describe('bulk actions', () => {
    async function selectItems(tester: SouthDetailComponentTester, ...names: Array<string>) {
      for (const name of names) {
        await tester.items.getByRole('checkbox', { name, exact: true }).click();
      }
      await expect.element(tester.massActionsButton).toHaveTextContent(`Mass actions (${names.length} items)`);
      await tester.massActionsButton.click();
    }

    test('should select and unselect the items', async () => {
      const tester = await createTester();
      await expect.element(tester.unselectAllButton).toBeDisabled();
      await expect.element(tester.massActionsButton).not.toBeInTheDocument();

      await tester.items.getByRole('checkbox', { name: 'item a' }).click();
      await expect.element(tester.massActionsButton).toHaveTextContent('Mass actions (1 items)');
      await tester.items.getByRole('checkbox', { name: 'item a' }).click();
      await expect.element(tester.massActionsButton).not.toBeInTheDocument();

      await tester.selectAllButton.click();
      await expect.element(tester.massActionsButton).toHaveTextContent('Mass actions (3 items)');
      await expect.element(tester.selectAllButton).toBeDisabled();
      await expect.element(tester.items.getByRole('checkbox', { name: 'item c' })).toBeChecked();

      await tester.unselectAllButton.click();
      await expect.element(tester.massActionsButton).not.toBeInTheDocument();
      await expect.element(tester.items.getByRole('checkbox', { name: 'item c' })).not.toBeChecked();
    });

    test.each([
      { action: 'Enable', method: 'enableItems', message: 'south.items.enabled-multiple' },
      { action: 'Disable', method: 'disableItems', message: 'south.items.disabled-multiple' }
    ] as const)('should $action the selected items', async ({ action, method, message }) => {
      const tester = await createTester();
      southConnectorService[method].mockReturnValue(of(undefined));
      southConnectorService.findById.mockReturnValue(
        of({ ...southConnector, items: [itemB, { ...itemA, name: 'item a reloaded' }, itemC] })
      );
      await selectItems(tester, 'item a', 'item c');

      await tester.massAction(action).click();

      expect(southConnectorService[method]).toHaveBeenCalledWith('southId1', ['itemA', 'itemC']);
      expect(notificationService.success).toHaveBeenCalledWith(message, { count: '2' });
      await tester.expectItems('item b', 'item a reloaded', 'item c');
      await expect.element(tester.massActionsButton).not.toBeInTheDocument();
    });

    test('should delete the selected items', async () => {
      const tester = await createTester();
      southConnectorService.deleteItems.mockReturnValue(of(undefined));
      southConnectorService.findById.mockReturnValue(of({ ...southConnector, items: [itemB] }));
      await selectItems(tester, 'item a', 'item c');

      await tester.massAction('Delete').click();

      expect(confirmationService.confirm).toHaveBeenCalledWith({
        messageKey: 'south.items.delete-multiple-message',
        interpolateParams: { count: '2' }
      });
      expect(southConnectorService.deleteItems).toHaveBeenCalledWith('southId1', ['itemA', 'itemC']);
      expect(notificationService.success).toHaveBeenCalledWith('south.items.deleted-multiple', { count: '2' });
      await tester.expectItems('item b');
    });

    test('should move the selected items to a group', async () => {
      const tester = await createTester();
      const selectGroupModal = mockModal(createMock(SelectGroupModalComponent), 'groupA');
      southConnectorService.moveItemsToGroup.mockReturnValue(of(undefined));
      await selectItems(tester, 'item b');

      await tester.massAction('Move to group').click();

      expect(selectGroupModal.prepare).toHaveBeenCalledWith(southConnector.groups, scanModes, manifest, expect.any(Function));
      expect(southConnectorService.moveItemsToGroup).toHaveBeenCalledWith('southId1', ['itemB'], 'groupA');
      expect(notificationService.success).toHaveBeenCalledWith('south.items.moved-to-group', { count: '1' });
    });
  });

  describe('groups and workflows', () => {
    async function openManageGroups(tester: SouthDetailComponentTester) {
      const manageGroupsModal = mockModal(createMock(ManageGroupsModalComponent));
      await expect.element(tester.manageGroupsButton).toHaveTextContent('Manage groups1');
      await tester.manageGroupsButton.click();
      const [, , , , getItemCount, addOrEditGroup, deleteGroup] = manageGroupsModal.prepare.mock.lastCall!;
      return { manageGroupsModal, getItemCount, addOrEditGroup, deleteGroup };
    }

    test('should open the manage groups modal with the current groups and items', async () => {
      const tester = await createTester();
      const open = vi.spyOn(modalService, 'open');

      const { manageGroupsModal, getItemCount } = await openManageGroups(tester);

      expect(open).toHaveBeenCalledWith(ManageGroupsModalComponent, { size: 'lg', backdrop: 'static' });
      expect(manageGroupsModal.prepare).toHaveBeenCalledWith(
        [groupA],
        scanModes,
        manifest,
        true,
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      );
      expect(getItemCount('groupA')).toBe(1);
      expect(getItemCount('other')).toBe(0);
    });

    test('should create a group and refresh the connector', async () => {
      const tester = await createTester();
      const { addOrEditGroup } = await openManageGroups(tester);
      const createdGroup = buildSouthItemGroup('groupB', 'Group B');
      southConnectorService.createGroup.mockReturnValue(of(createdGroup));
      southConnectorService.findById.mockReturnValue(of({ ...southConnector, groups: [groupA, createdGroup] }));

      const result = await firstValueFrom(addOrEditGroup({ mode: 'create', group: buildSouthItemGroupCommand(null, 'Group B') }));

      expect(result).toEqual(createdGroup);
      expect(southConnectorService.createGroup).toHaveBeenCalledWith('southId1', buildSouthItemGroupCommand(null, 'Group B'));
      expect(notificationService.success).toHaveBeenCalledWith('south.groups.created');
      await expect.element(tester.manageGroupsButton).toHaveTextContent('Manage groups2');
      await expect.element(tester.groupFilter.getByRole('option', { name: 'Group B' })).toBeInTheDocument();
    });

    test('should edit a group and refresh the items with the server state', async () => {
      const tester = await createTester();
      const { addOrEditGroup } = await openManageGroups(tester);
      const renamedGroup = buildSouthItemGroup('groupA', 'Group A renamed', scanModes[1]);
      southConnectorService.updateGroup.mockReturnValue(of(undefined));
      southConnectorService.findById.mockReturnValue(
        of({ ...southConnector, groups: [renamedGroup], items: [itemB, itemA, { ...itemC, group: renamedGroup }] })
      );
      southConnectorService.getGroup.mockReturnValue(of(renamedGroup));
      const command = buildSouthItemGroupCommand('groupA', 'Group A renamed', scanModes[1].id);

      const result = await firstValueFrom(addOrEditGroup({ mode: 'edit', group: command }));

      expect(result).toEqual(renamedGroup);
      expect(southConnectorService.updateGroup).toHaveBeenCalledWith('southId1', 'groupA', command);
      expect(southConnectorService.getGroup).toHaveBeenCalledWith('southId1', 'groupA');
      expect(notificationService.success).toHaveBeenCalledWith('south.groups.updated');
      await expect.element(tester.row(2)).toMatchTextContent(/Group A renamed\s*\(scanMode2\)/);
    });

    test('should delete a group on the server before refetching, and refresh the items', async () => {
      const tester = await createTester();
      const { deleteGroup } = await openManageGroups(tester);
      const callOrder: Array<string> = [];
      southConnectorService.deleteGroup.mockImplementation(() => {
        callOrder.push('delete');
        return of(undefined);
      });
      southConnectorService.findById.mockImplementation(() => {
        callOrder.push('findById');
        return of({ ...southConnector, groups: [], items: [itemB, itemA, { ...itemC, group: null }] });
      });

      await firstValueFrom(deleteGroup(groupA));

      expect(confirmationService.confirm).toHaveBeenCalledWith({
        messageKey: 'south.groups.confirm-deletion',
        interpolateParams: { name: 'Group A' }
      });
      expect(callOrder).toEqual(['delete', 'findById']);
      expect(southConnectorService.deleteGroup).toHaveBeenCalledWith('southId1', 'groupA');
      expect(notificationService.success).toHaveBeenCalledWith('south.groups.deleted');
      await expect.element(tester.row(2)).toMatchTextContent(/None\s*\(scanMode1\)/);
    });

    test('should notify when a group cannot be deleted', async () => {
      const tester = await createTester();
      const { deleteGroup } = await openManageGroups(tester);
      southConnectorService.deleteGroup.mockReturnValue(throwError(() => new Error('in use')));

      await expect(firstValueFrom(deleteGroup(groupA))).rejects.toThrow('in use');

      expect(notificationService.error).toHaveBeenCalledWith('south.groups.delete-error', { error: 'in use' });
    });

    test('should open the manage workflows modal in direct mode and reload the connector after a run', async () => {
      const tester = await createTester();
      const manageWorkflowsModal = mockModal(createMock(ManageWorkflowsModalComponent));
      const open = vi.spyOn(modalService, 'open');

      await tester.manageWorkflowsButton.click();

      expect(open).toHaveBeenCalledWith(ManageWorkflowsModalComponent, { size: 'xl', backdrop: 'static' });
      expect(manageWorkflowsModal.prepareForDirectSave).toHaveBeenCalledWith(
        'southId1',
        southConnector.settings,
        scanModes,
        manifest,
        southConnector.groups,
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      );

      southConnectorService.findById.mockReturnValue(
        of({ ...southConnector, items: [...southConnector.items, buildItem('new', 'item d')] })
      );
      const onWorkflowRun = manageWorkflowsModal.prepareForDirectSave.mock.lastCall![7];
      onWorkflowRun!();

      await tester.expectItems('item b', 'item a', 'item c', 'item d');
    });
  });
});
