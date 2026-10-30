import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { ConfigurationWorkflowCommandDTO } from '@oibus/shared/api/configuration-workflow.model';
import {
  SouthConnectorFolderScannerDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorLightDTO,
  SouthItemGroupCommandDTO
} from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { buildSouthItemGroup, buildSouthItemGroupCommand, buildWorkflow, buildWorkflowCommand } from '../../../test/builders';
import { EmptyRouteComponent } from '../../../test/empty-route.component';
import testData from '../../../test/test-data';
import { createMock, MockObject, stubRoute } from '../../../test/vitest-create-mock';
import { CertificateService } from '../../services/certificate.service';
import { ConfigurationWorkflowService } from '../../services/configuration-workflow.service';
import { EngineService } from '../../services/engine.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { fakeModal, MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import EditSouthItemModalComponent from '../south-items/edit-south-item-modal/edit-south-item-modal.component';
import { ImportSouthItemsModalComponent } from '../south-items/import-south-items-modal/import-south-items-modal.component';
import ManageGroupsModalComponent from '../south-items/manage-groups-modal/manage-groups-modal.component';
import { SelectGroupModalComponent } from '../south-items/select-group-modal/select-group-modal.component';
import { SouthItemGroups } from '../south-items/south-item-groups';
import EditWorkflowModalComponent from '../south-workflows/edit-workflow-modal/edit-workflow-modal.component';
import ManageWorkflowsModalComponent from '../south-workflows/manage-workflows-modal/manage-workflows-modal.component';
import { EditSouthComponent, SOUTH_CONNECTOR_STEPS, SouthConnectorStep } from './edit-south.component';

const manifest = testData.south.manifest;
/** A manifest with discovery: its items can be kept in sync with the data source by items synchronisations */
const discoveryManifest: SouthConnectorManifest = { ...manifest, discovery: { kind: 'tree' } };
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
const itemB = buildItem('itemB', 'item b');
const itemA = buildItem('itemA', 'item a', { enabled: false, scanMode: scanModes[1] });
const itemC = buildItem('itemC', 'item c', { group: groupA, syncWithGroup: true, scanMode: null, maxReadInterval: null });
const southConnector: SouthConnectorFolderScannerDTO = { ...baseSouth, groups: [groupA], items: [itemB, itemA, itemC] };

/** The command of an item, as edited in memory. */
function toItemCommand(item: FolderScannerItem, groupId: string | null = item.group?.id ?? null): SouthConnectorItemCommandDTO {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    enabled: item.enabled,
    settings: item.settings,
    scanModeId: item.scanMode?.id || null,
    scanModeName: item.scanMode?.name || null,
    groupId,
    groupName: item.group?.standardSettings.name || null,
    syncWithGroup: item.syncWithGroup,
    maxReadInterval: item.maxReadInterval,
    readDelay: item.readDelay,
    startTimeOffset: item.startTimeOffset,
    endTimeOffset: item.endTimeOffset,
    recoveryStrategy: item.recoveryStrategy,
    cachingStrategy: item.cachingStrategy,
    thresholdType: item.thresholdType,
    threshold: item.threshold,
    rangeLow: item.rangeLow,
    rangeHigh: item.rangeHigh,
    maxCachingInterval: item.maxCachingInterval
  };
}

const groupACommand = buildSouthItemGroupCommand('groupA', 'Group A', scanModes[1].id);
const itemCommands = [toItemCommand(itemB), toItemCommand(itemA), toItemCommand(itemC)];

class EditSouthComponentTester {
  readonly fixture = TestBed.createComponent(EditSouthComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly name = this.root.getByCss('#south-name');
  readonly description = this.root.getByCss('#south-description');
  readonly enabled = this.root.getByCss('#south-enabled');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly testConnectionButton = this.root.getByRole('button', { name: 'Test settings' });
  readonly exploreButton = this.root.getByCss('#explore');
  readonly nextButton = this.root.getByRole('button', { name: 'Next' });
  readonly reviewErrors = this.root.getByCss('#review-errors');
  readonly reviewChanges = this.root.getByCss('#review-changes');
  readonly itemChanges = this.root.getByCss('#item-changes');

  step(step: SouthConnectorStep) {
    return this.root.getByCss(`#south-step-${step}`);
  }

  async goTo(step: SouthConnectorStep) {
    await this.step(step).click();
  }

  readonly items = this.root.getByCss('section.oib-south-items');
  readonly manageGroupsButton = this.root.getByCss('#manage-groups-button');
  readonly synchronisationsInfo = this.root.getByCss('#synchronisations-info');

  /** Opens the home of the items synchronisations, from the Explore and sync button of a connector with discovery */
  async manageWorkflows() {
    await this.exploreButton.click();
  }
  readonly addItemButton = this.items.getByRole('button', { name: 'Add', exact: true });
  /** The menu of the actions on all the items: managing their groups, importing, exporting and deleting them */
  readonly itemsMenu = this.root.getByCss('#items-menu');
  readonly exportButton = this.root.getByCss('#export-items');
  readonly importButton = this.root.getByCss('#import-button');
  readonly deleteAllButton = this.root.getByCss('#delete-all');
  readonly search = this.items.getByRole('textbox', { name: 'Search' });
  readonly groupFilter = this.items.getByRole('combobox', { name: 'Group' });
  readonly scanModeFilter = this.items.getByRole('combobox', { name: 'Schedule' });
  readonly statusFilter = this.items.getByRole('combobox', { name: 'Status' });
  readonly selectAllButton = this.items.getByRole('button', { name: 'Select all' });
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

  itemAction(index: number, action: 'Edit item' | 'Copy item' | 'Delete item') {
    return this.row(index).getByRole('button', { name: action });
  }

  sortBy(column: 'Status' | 'Name' | 'Group (Schedule)') {
    return this.items.getByCss('thead').getByRole('button', { name: column, exact: true });
  }

  massAction(action: 'Enable' | 'Disable' | 'Move to group' | 'Delete') {
    return this.massActions.getByRole('button', { name: action, exact: true });
  }

  async selectItems(...names: Array<string>) {
    for (const name of names) {
      await this.items.getByRole('checkbox', { name, exact: true }).click();
    }
    await this.massActionsButton.click();
  }

  async expectItems(...names: Array<string>) {
    await expect.element(this.rows).toHaveLength(names.length);
    for (const [index, name] of names.entries()) {
      await expect.element(this.itemNames.nth(index)).toHaveTextContent(name);
    }
  }
}

describe('EditSouthComponent', () => {
  let southConnectorService: MockObject<SouthConnectorService>;
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  let notificationService: MockObject<NotificationService>;
  let confirmationService: MockObject<ConfirmationService>;
  let unsavedChangesService: MockObject<UnsavedChangesConfirmationService>;
  let modalService: MockModalService<unknown>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    const scanModeService = createMock(ScanModeService);
    const certificateService = createMock(CertificateService);
    const engineService = createMock(EngineService);
    notificationService = createMock(NotificationService);
    confirmationService = createMock(ConfirmationService);
    unsavedChangesService = createMock(UnsavedChangesConfirmationService);

    configurationWorkflowService.list.mockReturnValue(of([]));
    scanModeService.list.mockReturnValue(of(scanModes));
    certificateService.list.mockReturnValue(of([]));
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));
    southConnectorService.list.mockReturnValue(of(testData.south.listLight));
    southConnectorService.findById.mockReturnValue(of(southConnector));
    southConnectorService.getSouthManifest.mockReturnValue(of(manifest));
    confirmationService.confirm.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([{ path: 'south/:southId', component: EmptyRouteComponent }]),
        provideModalTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesService }
      ]
    });
  });

  /** Opens the page, on the given step */
  async function createTester(
    mode: 'create' | 'edit' | 'duplicate',
    step: SouthConnectorStep = 'general'
  ): Promise<EditSouthComponentTester> {
    const route = {
      create: stubRoute({ queryParams: { type: 'folder-scanner' } }),
      edit: stubRoute({ params: { southId: 'southId1' } }),
      duplicate: stubRoute({ queryParams: { duplicate: 'southId1' } })
    }[mode];
    TestBed.overrideProvider(ActivatedRoute, { useValue: route });
    modalService = TestBed.inject(MockModalService);
    TestBed.createComponent(DefaultValidationErrorsComponent);
    const tester = new EditSouthComponentTester();
    // the form is built: the page opens on its first step
    await expect.element(tester.step(SOUTH_CONNECTOR_STEPS[0])).toHaveAttribute('aria-current', 'step');
    await expect.element(tester.name).toBeInTheDocument();
    if (step !== SOUTH_CONNECTOR_STEPS[0]) {
      await tester.goTo(step);
    }
    return tester;
  }

  /** Mocks the next opened modal with a fake component, closed with the given value, and returns its component. */
  function mockModal<T>(fakeComponent: T, value: unknown = undefined): T {
    modalService.mockClosedModal(fakeComponent, value);
    return fakeComponent;
  }

  async function lastSavedCommand(tester: EditSouthComponentTester) {
    southConnectorService.update.mockReturnValue(of(undefined));
    southConnectorService.create.mockReturnValue(of(southConnector));
    // a new connector is saved from the last step
    await tester.goTo('review');
    await tester.saveButton.click();
    const updateCall = southConnectorService.update.mock.lastCall;
    if (updateCall) {
      return updateCall[1];
    }
    return southConnectorService.create.mock.lastCall![0];
  }

  describe('steps', () => {
    test('should go through the steps of a new connector, the next one opening once the current one is valid', async () => {
      // the settings come first, to be tested right away
      const tester = await createTester('create', 'settings');
      await expect.element(tester.testConnectionButton).toBeVisible();
      await expect.element(tester.saveButton).not.toBeInTheDocument();

      await tester.nextButton.click();
      await expect.element(tester.addItemButton).toBeVisible();
      await tester.nextButton.click();
      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
      // the name is required
      await tester.nextButton.click();
      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.step('general')).toHaveClass('modal-step-invalid');

      await tester.name.fill('My south');
      // Enter in a field opens the next step too
      await userEvent.keyboard('{Enter}');
      await expect.element(tester.step('review')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.saveButton).toBeVisible();
      await expect.element(tester.nextButton).not.toBeInTheDocument();
      await expect.element(tester.reviewChanges).not.toBeInTheDocument();
    });

    test('should list the steps to fix in the review, and open them', async () => {
      const tester = await createTester('create', 'review');

      await expect.element(tester.reviewErrors.getByText('Fix these steps before saving:')).toBeInTheDocument();
      await tester.reviewErrors.getByRole('button', { name: 'General' }).click();

      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
    });

    test('should save an edited connector from any step', async () => {
      const tester = await createTester('edit', 'items');

      const command = await lastSavedCommand(tester);

      expect(command.name).toBe('South 1');
    });

    test('should show what changed since the edited connector was saved', async () => {
      const tester = await createTester('edit', 'review');
      await expect.element(tester.reviewChanges).toHaveTextContent('No change since the connector was saved');

      await tester.goTo('general');
      await tester.description.fill('changed description');
      await tester.goTo('items');
      await tester.itemAction(1, 'Delete item').click();
      await tester.goTo('review');

      await expect.element(tester.reviewChanges).toHaveTextContent('Changes since the connector was saved: 2');
      await expect.element(tester.itemChanges).toHaveTextContent('Items added: 0 · changed: 0 · removed: 1');
    });
  });

  describe('connector', () => {
    test('should create a connector', async () => {
      const tester = await createTester('create');
      await expect.element(tester.title).toHaveTextContent('Create Folder scanner south connector');
      await expect.element(tester.enabled).toBeChecked();
      await expect.element(tester.noItems).toBeInTheDocument();
      // no discovery, no items synchronisation
      await expect.element(tester.root.getByCss('#explore')).toBeInTheDocument();
      expect(configurationWorkflowService.list).not.toHaveBeenCalled();
      expect(southConnectorService.findById).not.toHaveBeenCalled();
      southConnectorService.create.mockReturnValue(of(southConnector));

      await tester.name.fill('My south');
      await tester.description.fill('my description');
      await expect.element(tester.saveButton).not.toBeInTheDocument();
      await tester.goTo('review');
      await tester.saveButton.click();

      expect(southConnectorService.create).toHaveBeenCalledWith(
        {
          name: 'My south',
          type: 'folder-scanner',
          description: 'my description',
          enabled: true,
          settings: undefined,
          items: [],
          groups: [],
          configurationWorkflows: []
        },
        ''
      );
      expect(notificationService.success).toHaveBeenCalledWith('south.created', { name: 'My south' });
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/south/southId1'));
    });

    test('should not save an invalid connector', async () => {
      const tester = await createTester('create', 'review');

      await tester.saveButton.click();

      // the first step with an error opens
      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.root.getByText('This field is required')).toBeVisible();
      expect(southConnectorService.create).not.toHaveBeenCalled();
    });

    test('should check the name is unique', async () => {
      const otherSouths: Array<SouthConnectorLightDTO> = testData.south.listLight;
      southConnectorService.list.mockReturnValue(of(otherSouths));
      const tester = await createTester('create');

      await tester.name.fill(' south 2 ');
      await tester.goTo('review');
      await tester.saveButton.click();

      expect(southConnectorService.create).not.toHaveBeenCalled();
      await expect.element(tester.root.getByText('Must be unique')).toBeVisible();
    });

    test('should edit a connector', async () => {
      const workflow = buildWorkflow('workflow1', 'Alpha', { scanMode: scanModes[0] });
      configurationWorkflowService.list.mockReturnValue(of([workflow]));
      southConnectorService.getSouthManifest.mockReturnValue(of(discoveryManifest));
      const tester = await createTester('edit');
      await expect.element(tester.title).toHaveTextContent('Edit South 1');
      await expect.element(tester.name).toHaveValue('South 1');
      await expect
        .element(tester.synchronisationsInfo)
        .toHaveTextContent('Items synchronisations keeping items in sync with the data source: 1Manage');
      expect(southConnectorService.findById).toHaveBeenCalledWith('southId1');
      expect(configurationWorkflowService.list).toHaveBeenCalledWith('southId1');
      // the existing name of the connector itself is not a duplicate
      await tester.name.fill('South 1');

      const command = await lastSavedCommand(tester);

      expect(southConnectorService.update).toHaveBeenCalledWith('southId1', command);
      expect(command).toEqual({
        name: 'South 1',
        type: 'folder-scanner',
        description: southConnector.description,
        enabled: true,
        settings: undefined,
        items: itemCommands,
        groups: [groupACommand],
        configurationWorkflows: [
          {
            id: 'workflow1',
            name: 'Alpha',
            description: null,
            discoveryScope: {},
            identityKeyFields: ['nodeId'],
            eligibilityFilter: [],
            itemFieldMapping: { name: '{{name}}' },
            pushToOIAnalytics: false,
            scanModeId: scanModes[0].id,
            enabled: true
          }
        ]
      });
      expect(notificationService.success).toHaveBeenCalledWith('south.updated', { name: 'South 1' });
      expect(southConnectorService.findById).toHaveBeenCalledTimes(2);
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/south/southId1'));
    });

    test('should duplicate a connector with new temp ids for its groups and workflows', async () => {
      configurationWorkflowService.list.mockReturnValue(
        of([
          buildWorkflow('workflow1', 'Alpha', { itemFieldMapping: { name: '{{name}}', groupId: 'groupA' } }),
          buildWorkflow('workflow2', 'Beta', { pushToOIAnalytics: true, itemFieldMapping: null })
        ])
      );
      const tester = await createTester('duplicate');
      await expect.element(tester.title).toHaveTextContent('Create Folder scanner south connector');
      await tester.name.fill('South copy');

      const command = await lastSavedCommand(tester);

      expect(southConnectorService.create).toHaveBeenCalledWith(command, 'southId1');
      const [group] = command.groups;
      expect(group.id).toMatch(/^temp_/);
      expect(command.items.find(item => item.id === 'itemC')!.groupId).toBe(group.id);
      expect(command.items.find(item => item.id === 'itemC')!.groupName).toBe('Group A');
      const [alpha, beta] = command.configurationWorkflows;
      expect(alpha.id).toMatch(/^temp_/);
      expect(beta.id).toMatch(/^temp_/);
      expect(alpha.id).not.toBe(beta.id);
      expect(alpha.itemFieldMapping).toEqual({ name: '{{name}}', groupId: group.id });
      expect(beta.itemFieldMapping).toBeNull();
    });

    test('should test the connection with the settings of the form', async () => {
      const tester = await createTester('edit');
      const testConnectionModal = mockModal(createMock(TestConnectionResultModalComponent));
      await tester.goTo('settings');

      await tester.testConnectionButton.click();

      expect(testConnectionModal.runTest).toHaveBeenCalledWith('south', 'southId1', undefined, 'folder-scanner');
    });

    test('should not test the connection or explore with invalid settings', async () => {
      const requiredAttribute = manifest.items.rootAttribute.attributes[0];
      const southManifest: SouthConnectorManifest = {
        ...manifest,
        settings: {
          ...manifest.settings,
          attributes: [
            { ...requiredAttribute, key: 'inputFolder', translationKey: 'configuration.oibus.manifest.south.folder-scanner.input-folder' }
          ]
        }
      };
      southConnectorService.getSouthManifest.mockReturnValue(of(southManifest));
      const tester = await createTester('create');
      const open = vi.spyOn(modalService, 'open');
      await tester.goTo('items');

      await tester.exploreButton.click();

      // the settings step opens, to fix them
      await expect.element(tester.step('settings')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.root.getByText('This field is required')).toBeVisible();
      await tester.testConnectionButton.click();
      expect(open).not.toHaveBeenCalled();
    });

    test('should only browse the data source of a connector without discovery, with the settings of the form', async () => {
      const tester = await createTester('create');
      const wizard = mockModal(createMock(EditWorkflowModalComponent));
      await expect.element(tester.exploreButton).toHaveTextContent('Explore');
      await expect.element(tester.exploreButton).not.toHaveTextContent('Explore and sync');

      await tester.goTo('items');
      await tester.exploreButton.click();

      // the settings of the form (none in the test manifest)
      expect(wizard.prepareForExploration).toHaveBeenCalledWith({
        southId: 'create',
        exploreConnectorId: null,
        southSettings: undefined,
        manifest,
        schedule: { scanModes, groups: expect.anything() },
        existingItems: []
      });
    });

    test('should open the home of the items synchronisations of a connector with discovery, kept in memory', async () => {
      southConnectorService.getSouthManifest.mockReturnValue(of(discoveryManifest));
      const tester = await createTester('create');
      const homeModal = mockModal(createMock(ManageWorkflowsModalComponent));
      await tester.goTo('items');
      await expect.element(tester.exploreButton).toHaveTextContent('Explore and sync');

      await tester.exploreButton.click();

      expect(homeModal.prepareForInMemory).toHaveBeenCalledWith(
        tester.fixture.componentInstance.inMemoryWorkflows,
        'create',
        undefined,
        scanModes,
        discoveryManifest,
        expect.anything(),
        []
      );
    });

    test('should add the items of the explore and sync home to the in-memory items', async () => {
      southConnectorService.getSouthManifest.mockReturnValue(of(discoveryManifest));
      const tester = await createTester('edit');
      await expect.element(tester.rows).toHaveLength(3);
      const command = {
        ...southConnector.items[0],
        id: null,
        name: 'added',
        scanModeId: scanModes[0].id,
        scanModeName: null,
        groupId: null,
        groupName: null
      };
      mockModal(createMock(ManageWorkflowsModalComponent), { kind: 'items', commands: [command] });

      await tester.goTo('items');
      await tester.exploreButton.click();

      await expect.element(tester.rows).toHaveLength(4);
      await expect.element(tester.root.getByText('added')).toBeInTheDocument();
    });

    test('should open the item modal with the item the tables checked in the explore and sync home give', async () => {
      southConnectorService.getSouthManifest.mockReturnValue(of(discoveryManifest));
      const tester = await createTester('edit');
      const prefilled = { ...southConnector.items[0], id: null, name: 'measures_tags' };
      const itemModal = createMock(EditSouthItemModalComponent);
      vi.spyOn(modalService, 'open')
        .mockReturnValueOnce(fakeModal(createMock(ManageWorkflowsModalComponent), Promise.resolve({ kind: 'item', command: prefilled })))
        .mockReturnValueOnce(fakeModal(itemModal, Promise.resolve({ ...prefilled, name: 'completed' })));

      await tester.goTo('items');
      await tester.exploreButton.click();

      await vi.waitFor(() =>
        expect(itemModal.prepareForCreation).toHaveBeenCalledWith(
          expect.any(Array),
          scanModes,
          expect.anything(),
          expect.anything(),
          discoveryManifest,
          'southId1',
          expect.anything(),
          null,
          prefilled
        )
      );
      // saved with the connector, like the items added otherwise
      await expect.element(tester.root.getByText('completed')).toBeInTheDocument();
    });

    test('should show the workflows the home kept in memory', async () => {
      southConnectorService.getSouthManifest.mockReturnValue(of(discoveryManifest));
      const tester = await createTester('edit');
      await expect.element(tester.synchronisationsInfo).not.toBeInTheDocument();
      const home = createMock(ManageWorkflowsModalComponent);
      mockModal(home);
      await tester.goTo('items');
      await tester.exploreButton.click();

      tester.fixture.componentInstance.inMemoryWorkflows.update(workflows => [...workflows, buildWorkflowCommand('temp_1', 'sub')]);

      await expect
        .element(tester.synchronisationsInfo)
        .toHaveTextContent('Items synchronisations keeping items in sync with the data source: 1Manage');
    });

    test('should ask for confirmation before leaving with unsaved changes', async () => {
      const tester = await createTester('edit');
      expect(tester.fixture.componentInstance.canDeactivate()).toBe(true);
      const confirmation = of(false);
      unsavedChangesService.confirmUnsavedChanges.mockReturnValue(confirmation);

      await tester.name.fill('South 1 renamed');

      expect(tester.fixture.componentInstance.canDeactivate()).toBe(confirmation);
    });
  });

  describe('items', () => {
    test('should display the items', async () => {
      const tester = await createTester('edit', 'items');

      await tester.expectItems('item b', 'item a', 'item c');
      await expect.element(tester.row(0)).toMatchTextContent(/Enabled.*None\s*\(scanMode1\)/);
      await expect.element(tester.row(1)).toMatchTextContent('Disabled');
      await expect.element(tester.row(2)).toMatchTextContent(/Group A\s*\(scanMode2\)/);
    });

    test('should display the schedule details of an item in a tooltip', async () => {
      const tester = await createTester('edit', 'items');

      await tester.row(2).getByCss('td:nth-child(4) > span').hover();

      const tooltip = page.getByCss('.schedule-tooltip');
      await expect.element(tooltip).toMatchTextContent('Group: Group A');
      await expect.element(tooltip).toMatchTextContent('Schedule: scanMode2');
      await expect.element(tooltip).toMatchTextContent('Max read interval: 3600s');
    });

    test('should add an item', async () => {
      const tester = await createTester('edit', 'items');
      const newItem: SouthConnectorItemCommandDTO = { ...testData.south.itemCommand, name: 'item d' };
      const editModal = mockModal(createMock(EditSouthItemModalComponent), newItem);
      // the modal creates a group through the groups of the page
      editModal.prepareForCreation.mockImplementation((_items, _scanModes, _certificates, groups) => {
        groups.save({ mode: 'create', group: buildSouthItemGroupCommand(null, 'New group') }).subscribe();
      });
      const open = vi.spyOn(modalService, 'open');

      await tester.addItemButton.click();

      expect(open).toHaveBeenCalledWith(EditSouthItemModalComponent, { size: 'xl', beforeDismiss: expect.any(Function) });
      expect(editModal.directSave).toBe(false);
      expect(editModal.prepareForCreation).toHaveBeenCalledWith(
        itemCommands,
        scanModes,
        [],
        expect.anything(),
        manifest,
        'southId1',
        expect.objectContaining({ name: 'South 1', items: itemCommands }),
        null,
        null
      );
      expect(editModal.prepareForCreation.mock.lastCall![3].list()).toEqual([groupACommand, createdGroup('New group')]);
      await tester.expectItems('item b', 'item a', 'item c', 'item d');
      await expect.element(tester.manageGroupsButton).toHaveTextContent('Manage groups2');
      await expect.element(tester.groupFilter.getByRole('option', { name: 'New group' })).toBeInTheDocument();

      editModal.canDismiss.mockReturnValue(of(true));
      await expect(open.mock.lastCall![1]!.beforeDismiss!()).resolves.toBe(true);
    });

    test('should add items in a row, each one starting from the one added before', async () => {
      const tester = await createTester('edit', 'items');
      const firstItem: SouthConnectorItemCommandDTO = { ...testData.south.itemCommand, name: 'item d' };
      const nextItem: SouthConnectorItemCommandDTO = { ...testData.south.itemCommand, name: 'item e' };
      const firstModal = createMock(EditSouthItemModalComponent, { addAnother: true });
      const nextModal = createMock(EditSouthItemModalComponent, { addAnother: false });
      const open = vi
        .spyOn(modalService, 'open')
        .mockReturnValueOnce(fakeModal(firstModal, Promise.resolve(firstItem)))
        .mockReturnValueOnce(fakeModal(nextModal, Promise.resolve(nextItem)));

      await tester.addItemButton.click();

      await tester.expectItems('item b', 'item a', 'item c', 'item d', 'item e');
      expect(nextModal.directSave).toBe(false);
      // the next item is checked against the items with the first one
      expect(nextModal.prepareForCreation).toHaveBeenCalledWith(
        [...itemCommands, firstItem],
        scanModes,
        [],
        expect.anything(),
        manifest,
        'southId1',
        expect.objectContaining({ name: 'South 1' }),
        firstItem,
        null
      );
      // the last one was added with the main action: no other item
      expect(open).toHaveBeenCalledTimes(2);
    });

    test('should edit an item', async () => {
      const tester = await createTester('edit', 'items');
      const editedItem = { ...itemCommands[1], name: 'item a edited' };
      const editModal = mockModal(createMock(EditSouthItemModalComponent), editedItem);
      const open = vi.spyOn(modalService, 'open');

      await tester.itemAction(1, 'Edit item').click();

      expect(editModal.prepareForEdition).toHaveBeenCalledWith(
        itemCommands,
        scanModes,
        [],
        expect.anything(),
        manifest,
        itemCommands[1],
        'southId1',
        expect.objectContaining({ name: 'South 1' }),
        1
      );
      expect(editModal.prepareForEdition.mock.lastCall![3].list()).toEqual([groupACommand]);
      await tester.expectItems('item b', 'item a edited', 'item c');
      expect((await lastSavedCommand(tester)).items[1]).toEqual(editedItem);

      editModal.canDismiss.mockReturnValue(false);
      expect(open.mock.calls[0][1]!.beforeDismiss!()).toBe(false);
    });

    test('should edit the clicked item when several unsaved items share an empty id', async () => {
      const tester = await createTester('edit', 'items');
      for (const name of ['unsaved-1', 'unsaved-2']) {
        mockModal(createMock(EditSouthItemModalComponent), { ...itemCommands[0], id: '', name });
        await tester.addItemButton.click();
      }
      const editModal = mockModal(createMock(EditSouthItemModalComponent), { ...itemCommands[0], id: '', name: 'unsaved-2-edited' });

      await tester.itemAction(4, 'Edit item').click();

      expect(editModal.prepareForEdition.mock.lastCall![5]).toEqual({ ...itemCommands[0], id: '', name: 'unsaved-2' });
      expect(editModal.prepareForEdition.mock.lastCall![8]).toBe(4);
      await tester.expectItems('item b', 'item a', 'item c', 'unsaved-1', 'unsaved-2-edited');
    });

    test('should duplicate an item', async () => {
      const tester = await createTester('edit', 'items');
      const copy = { ...itemCommands[1], id: '', name: 'item a copy' };
      const editModal = mockModal(createMock(EditSouthItemModalComponent), copy);
      const open = vi.spyOn(modalService, 'open');

      await tester.itemAction(1, 'Copy item').click();

      expect(open).toHaveBeenCalledWith(EditSouthItemModalComponent, { size: 'xl', backdrop: 'static' });
      expect(editModal.prepareForCopy).toHaveBeenCalledWith(
        itemCommands,
        scanModes,
        [],
        expect.anything(),
        manifest,
        itemCommands[1],
        'southId1',
        expect.objectContaining({ name: 'South 1' })
      );
      await tester.expectItems('item b', 'item a', 'item c', 'item a copy');
    });

    test('should delete an item', async () => {
      const tester = await createTester('edit', 'items');

      await tester.itemAction(1, 'Delete item').click();

      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'south.items.confirm-deletion' });
      await tester.expectItems('item b', 'item c');
    });

    test('should delete all the items', async () => {
      const tester = await createTester('edit', 'items');

      await tester.itemsMenu.click();

      await tester.deleteAllButton.click();

      expect(confirmationService.confirm).toHaveBeenCalledWith({ messageKey: 'south.items.confirm-delete-all' });
      await expect.element(tester.noItems).toBeVisible();
      await expect.element(tester.deleteAllButton).toBeDisabled();
      expect((await lastSavedCommand(tester)).items).toEqual([]);
    });

    test('should export the items of a connector being created', async () => {
      const tester = await createTester('create', 'items');
      const exportModal = mockModal(createMock(ExportItemModalComponent), { filename: 'items', delimiter: ';' });
      southConnectorService.itemsToCsv.mockReturnValue(of(undefined));

      await tester.itemsMenu.click();

      await tester.exportButton.click();

      expect(exportModal.prepare).toHaveBeenCalledWith('items');
      expect(southConnectorService.itemsToCsv).toHaveBeenCalledWith('folder-scanner', [], 'items', ';');
    });

    test('should export the items of an existing connector', async () => {
      const tester = await createTester('edit', 'items');
      const exportModal = mockModal(createMock(ExportItemModalComponent), { filename: 'items', delimiter: ',' });
      southConnectorService.exportItems.mockReturnValue(of(undefined));

      await tester.itemsMenu.click();

      await tester.exportButton.click();

      expect(exportModal.prepare).toHaveBeenCalledWith('South 1');
      expect(southConnectorService.exportItems).toHaveBeenCalledWith('southId1', 'items', ',');
    });

    test.each([
      { eraseExisting: false, expected: ['item b', 'item a', 'item c', 'item d'] },
      { eraseExisting: true, expected: ['item d'] }
    ])('should import items (erase existing: $eraseExisting)', async ({ eraseExisting, expected }) => {
      const tester = await createTester('edit', 'items');
      const imported = { ...testData.south.itemCommand, name: 'item d' };
      const importModal = mockModal(createMock(ImportSouthItemsModalComponent), { items: [imported], eraseExisting });
      southConnectorService.checkImportItems.mockReturnValue(of({ items: [itemC], errors: [] }));

      await tester.itemsMenu.click();

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
      await tester.expectItems(...expected);

      const checkFn = importModal.prepare.mock.lastCall![6];
      const file = new File([''], 'items.csv');
      const checked = await firstValueFrom(checkFn(file, ';', true));
      expect(southConnectorService.checkImportItems).toHaveBeenCalledWith('folder-scanner', expect.any(Array), file, ';', true);
      expect(checked.items).toEqual([toItemCommand(itemC)]);
    });

    test('should give the existing topics to the import modal of an MQTT connector', async () => {
      southConnectorService.getSouthManifest.mockReturnValue(of({ ...manifest, id: 'mqtt' }));
      const tester = await createTester('create', 'items');
      mockModal(createMock(EditSouthItemModalComponent), { ...testData.south.itemCommand, name: 'topic item', settings: { topic: 'a/b' } });
      await tester.addItemButton.click();
      const importModal = mockModal(createMock(ImportSouthItemsModalComponent));

      await tester.itemsMenu.click();

      await tester.importButton.click();

      expect(importModal.prepare.mock.lastCall![3]).toEqual(['a/b']);
      expect(importModal.prepare.mock.lastCall![4]).toBe(true);
    });

    test('should filter the items', async () => {
      const tester = await createTester('edit', 'items');

      await tester.search.fill('ITEM A');
      await tester.expectItems('item a');
      await tester.search.fill('');

      await tester.groupFilter.selectOptions('None');
      await tester.expectItems('item b', 'item a');
      await tester.groupFilter.selectOptions('Group A');
      await tester.expectItems('item c');
      await tester.groupFilter.selectOptions('All groups');

      await tester.scanModeFilter.selectOptions('scanMode2');
      await tester.expectItems('item a', 'item c');
      await tester.scanModeFilter.selectOptions('All schedules');

      await tester.statusFilter.selectOptions('Disabled');
      await tester.expectItems('item a');

      await tester.search.fill('unknown');
      await expect.element(tester.noMatch).toBeVisible();
    });

    test.each([
      { column: 'Name', ascending: ['item a', 'item b', 'item c'], descending: ['item c', 'item b', 'item a'] },
      { column: 'Status', ascending: ['item a', 'item b', 'item c'], descending: ['item b', 'item c', 'item a'] },
      { column: 'Group (Schedule)', ascending: ['item b', 'item a', 'item c'], descending: ['item c', 'item b', 'item a'] }
    ] as const)('should sort the items by $column', async ({ column, ascending, descending }) => {
      const tester = await createTester('edit', 'items');

      await tester.sortBy(column).click();
      await tester.expectItems(...ascending);
      await tester.sortBy(column).click();
      await tester.expectItems(...descending);
    });

    test('should paginate the items', async () => {
      const items = Array.from({ length: 25 }, (_, index) => buildItem(`item${index}`, `item ${String(index).padStart(2, '0')}`));
      southConnectorService.findById.mockReturnValue(of({ ...southConnector, items }));
      const tester = await createTester('edit', 'items');
      await expect.element(tester.rows).toHaveLength(20);

      await tester.pagination.getByRole('link', { name: '2' }).click();

      await expect.element(tester.rows).toHaveLength(5);
      await expect.element(tester.itemNames.nth(0)).toHaveTextContent('item 20');
    });
  });

  describe('bulk actions', () => {
    test.each([
      { action: 'Enable', enabled: true },
      { action: 'Disable', enabled: false }
    ] as const)('should $action the selected items', async ({ action, enabled }) => {
      const tester = await createTester('edit', 'items');
      await tester.selectItems('item a', 'item c');

      await tester.massAction(action).click();

      await expect.element(tester.massActionsButton).not.toBeInTheDocument();
      const items = (await lastSavedCommand(tester)).items;
      expect(items.map(item => item.enabled)).toEqual([true, enabled, enabled]);
    });

    test('should delete the selected items', async () => {
      const tester = await createTester('edit', 'items');
      await tester.selectItems('item a', 'item c');

      await tester.massAction('Delete').click();

      expect(confirmationService.confirm).toHaveBeenCalledWith({
        messageKey: 'south.items.delete-multiple-message',
        interpolateParams: { count: '2' }
      });
      await tester.expectItems('item b');
    });

    test('should move the selected items to a group', async () => {
      const tester = await createTester('edit', 'items');
      const selectGroupModal = mockModal(createMock(SelectGroupModalComponent), 'groupA');
      await tester.selectAllButton.click();
      await tester.massActionsButton.click();

      await tester.massAction('Move to group').click();

      expect(selectGroupModal.prepare).toHaveBeenCalledWith(expect.anything(), scanModes, manifest);
      expect(selectGroupModal.prepare.mock.lastCall![0].list()).toEqual([groupACommand]);
      await expect.element(tester.row(0)).toMatchTextContent(/Group A\s*\(scanMode2\)/);
      const items = (await lastSavedCommand(tester)).items;
      expect(items.map(item => [item.groupId, item.groupName])).toEqual([
        ['groupA', 'Group A'],
        ['groupA', 'Group A'],
        ['groupA', 'Group A']
      ]);
    });
  });

  describe('groups and workflows', () => {
    beforeEach(() => southConnectorService.getSouthManifest.mockReturnValue(of(discoveryManifest)));

    async function openManageGroups(tester: EditSouthComponentTester, onPrepare?: (groups: SouthItemGroups) => void) {
      const manageGroupsModal = mockModal(createMock(ManageGroupsModalComponent));
      manageGroupsModal.prepare.mockImplementation(groups => onPrepare?.(groups));
      await tester.itemsMenu.click();
      await tester.manageGroupsButton.click();
      const [groups, , , , getItemCount] = manageGroupsModal.prepare.mock.lastCall!;
      return { manageGroupsModal, groups, getItemCount };
    }

    test('should open the manage groups modal with the in-memory groups and show the groups it changes', async () => {
      const tester = await createTester('edit', 'items');

      const { manageGroupsModal, groups, getItemCount } = await openManageGroups(tester, groups =>
        groups.save({ mode: 'create', group: buildSouthItemGroupCommand(null, 'Group B') }).subscribe()
      );

      expect(manageGroupsModal.prepare).toHaveBeenCalledWith(expect.anything(), scanModes, discoveryManifest, false, expect.any(Function));
      expect(groups.list()).toEqual([groupACommand, createdGroup('Group B')]);
      expect(getItemCount('groupA')).toBe(1);
      expect(getItemCount('other')).toBe(0);
      await expect.element(tester.manageGroupsButton).toHaveTextContent('Manage groups2');
      expect((await lastSavedCommand(tester)).groups).toEqual([groupACommand, createdGroup('Group B')]);
    });

    test('should create and edit groups in memory', async () => {
      const tester = await createTester('edit', 'items');
      const { groups } = await openManageGroups(tester);

      const created = await firstValueFrom(groups.save({ mode: 'create', group: buildSouthItemGroupCommand(null, 'Group B') }));
      expect(created.id).toMatch(/^temp_/);

      const renamedGroup = buildSouthItemGroupCommand('groupA', 'Group A renamed', scanModes[0].id, {
        historySettings: { ...groupACommand.historySettings, recoveryStrategy: 'newest', cachingStrategy: 'onChange' }
      });
      const edited = await firstValueFrom(groups.save({ mode: 'edit', group: renamedGroup }));
      expect(edited).toEqual(renamedGroup);
      expect(groups.list()).toEqual([renamedGroup, created]);
      expect((await lastSavedCommand(tester)).groups).toEqual([renamedGroup, created]);
    });

    test('should delete a group, unassigning its items and unmapping it from the workflows', async () => {
      configurationWorkflowService.list.mockReturnValue(
        of([
          buildWorkflow('workflow1', 'Alpha', { itemFieldMapping: { name: '{{name}}', groupId: 'groupA', syncWithGroup: 'true' } }),
          buildWorkflow('workflow2', 'Beta', { itemFieldMapping: { name: '{{name}}', groupId: 'otherGroup' } })
        ])
      );
      const tester = await createTester('edit', 'items');
      const manageWorkflowsModal = mockModal(createMock(ManageWorkflowsModalComponent));
      await tester.manageWorkflows();
      const pageWorkflows = manageWorkflowsModal.prepareForInMemory.mock.lastCall![0];
      const { groups } = await openManageGroups(tester);

      await firstValueFrom(groups.delete(groupACommand));

      expect(confirmationService.confirm).toHaveBeenLastCalledWith({
        messageKey: 'south.groups.confirm-deletion',
        interpolateParams: { name: 'Group A' }
      });
      await expect.element(tester.row(2)).toMatchTextContent(/None\s*\(scanMode2\)/);
      expect(groups.list()).toEqual([]);
      // the workflows shown by an open manage workflows modal are updated
      expect(pageWorkflows().map(workflow => workflow.itemFieldMapping)).toEqual([
        { name: '{{name}}' },
        { name: '{{name}}', groupId: 'otherGroup' }
      ]);
      const command = await lastSavedCommand(tester);
      expect(command.items[2]).toEqual({
        ...itemCommands[2],
        groupId: null,
        groupName: null,
        syncWithGroup: false,
        // inherited from the deleted group
        scanModeId: scanModes[1].id,
        scanModeName: scanModes[1].name,
        maxReadInterval: 3600,
        readDelay: 200,
        recoveryStrategy: 'oldest'
      });
      expect(command.configurationWorkflows[0].itemFieldMapping).toEqual({ name: '{{name}}' });
    });

    test('should keep the own scan mode and history settings of the items of a deleted group', async () => {
      const ownItem = buildItem('itemC', 'item c', {
        group: groupA,
        syncWithGroup: false,
        scanMode: scanModes[0],
        maxReadInterval: 60,
        readDelay: 50,
        startTimeOffset: 10,
        endTimeOffset: 20,
        recoveryStrategy: 'newest'
      });
      southConnectorService.findById.mockReturnValue(of({ ...southConnector, items: [ownItem] }));
      const tester = await createTester('edit', 'items');
      const { groups } = await openManageGroups(tester);

      await firstValueFrom(groups.delete(groupACommand));

      const [item] = (await lastSavedCommand(tester)).items;
      expect(item).toEqual({ ...toItemCommand(ownItem), groupId: null, groupName: null, syncWithGroup: false });
    });

    test('should manage the workflows in memory, against the unsaved settings', async () => {
      const tester = await createTester('edit', 'items');
      const manageWorkflowsModal = mockModal(createMock(ManageWorkflowsModalComponent));
      manageWorkflowsModal.prepareForInMemory.mockImplementation(workflows =>
        workflows.update(list => [...list, buildWorkflowCommandFor('temp_1')])
      );
      const open = vi.spyOn(modalService, 'open');

      await tester.manageWorkflows();

      expect(open).toHaveBeenCalledWith(ManageWorkflowsModalComponent, { size: 'xl', backdrop: 'static' });
      expect(manageWorkflowsModal.prepareForInMemory).toHaveBeenCalledWith(
        expect.any(Function),
        'southId1',
        undefined,
        scanModes,
        discoveryManifest,
        expect.anything(),
        expect.any(Array)
      );
      expect(manageWorkflowsModal.prepareForInMemory.mock.lastCall![5].list()).toEqual([groupACommand]);
      expect((await lastSavedCommand(tester)).configurationWorkflows).toEqual([buildWorkflowCommandFor('temp_1')]);
    });

    test("should use the 'create' south id to manage the workflows of a connector being created", async () => {
      const tester = await createTester('create', 'items');
      const manageWorkflowsModal = mockModal(createMock(ManageWorkflowsModalComponent));

      await tester.manageWorkflows();

      expect(manageWorkflowsModal.prepareForInMemory.mock.lastCall![1]).toBe('create');
    });
  });
});

/** A group created in memory, with a temporary id */
function createdGroup(name: string): SouthItemGroupCommandDTO {
  return { ...buildSouthItemGroupCommand(null, name), id: expect.stringMatching(/^temp_/) };
}

function buildWorkflowCommandFor(id: string): ConfigurationWorkflowCommandDTO {
  return {
    id,
    name: 'New workflow',
    description: null,
    discoveryScope: {},
    identityKeyFields: ['nodeId'],
    eligibilityFilter: [],
    itemFieldMapping: null,
    pushToOIAnalytics: true,
    scanModeId: null,
    enabled: true
  };
}
