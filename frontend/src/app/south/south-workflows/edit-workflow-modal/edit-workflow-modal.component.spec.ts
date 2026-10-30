import { Clipboard } from '@angular/cdk/clipboard';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NEVER, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { ConfigurationWorkflowCommandDTO, WorkflowPreviewResultDTO } from '@oibus/shared/api/configuration-workflow.model';
import { RegistrationSettingsDTO } from '@oibus/shared/api/engine.model';
import { SouthConnectorItemCommandDTO } from '@oibus/shared/api/south-connector.model';
import { OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthFolderScannerItemSettings, SouthMySQLItemSettings } from '@oibus/shared/connector/south-settings.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup, buildSouthItemGroupCommand, buildWorkflowCommand } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { EngineService } from '../../../services/engine.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { MockModalService, provideModalTesting } from '../../../shared/mock-modal.service.testing';
import { NotificationService } from '../../../shared/notification.service';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditSouthItemGroupModalComponent } from '../../south-items/edit-south-item-group-modal/edit-south-item-group-modal.component';
import { FakeSouthItemGroups, fakeSouthItemGroups } from '../../south-items/south-item-groups.testing';
import EditWorkflowModalComponent from './edit-workflow-modal.component';
import { ExploreWizardOptions, WizardStep, WorkflowStep } from './explore-wizard';

const scanModes = testData.scanMode.list;
const southId = 'southId1';
const southSettings = testData.south.list[0].settings;
// Real manifest fixture: modes.history is true, items.rootAttribute.attributes = [name, enabled, scanMode, settings{...}] -
// exercises both the manifest-driven fields and the historian fields added alongside them. Given a tree-based discovery.
const manifest: SouthConnectorManifest = { ...testData.south.manifest, discovery: { kind: 'tree' } };
// A SQL-family connector with no explore() - query-only discovery scope, no reference tree.
const sqlManifest: SouthConnectorManifest = { ...manifest, id: 'mysql', explore: false, discovery: { kind: 'query' } };
// A SQL-family connector that also has explore() (e.g. SQLite) - query editor plus the reference tree.
const sqliteManifest: SouthConnectorManifest = { ...manifest, id: 'sqlite', explore: true, discovery: { kind: 'query' } };
// No discovery at all, even though it can be explored (e.g. Folder Scanner).
const unsupportedManifest: SouthConnectorManifest = { ...manifest, explore: true, discovery: undefined };
const noHistoryManifest: SouthConnectorManifest = { ...manifest, modes: { ...manifest.modes, history: false } };

// Mirrors the real OPC-UA item manifest's mode -> haMode enabling condition (settings.mode is a
// string-select referral gating the whole settings.haMode object, whose own children - here just
// settings.haMode.aggregate - inherit that same condition). Reuses the real OPC-UA translation keys.
const enablingSettings: OIBusObjectAttribute = {
  type: 'object',
  key: 'settings',
  translationKey: 'configuration.oibus.manifest.south.items.settings',
  displayProperties: { visible: true, wrapInBox: true },
  enablingConditions: [{ referralPathFromRoot: 'mode', targetPathFromRoot: 'haMode', values: ['ha'] }],
  validators: [],
  attributes: [
    {
      type: 'string-select',
      key: 'mode',
      translationKey: 'configuration.oibus.manifest.south.items.opcua.mode',
      defaultValue: 'ha',
      selectableValues: ['ha', 'da'],
      validators: [],
      displayProperties: { row: 0, columns: 4, displayInViewMode: true }
    },
    {
      type: 'object',
      key: 'haMode',
      translationKey: 'configuration.oibus.manifest.south.items.opcua.ha-mode.title',
      displayProperties: { visible: true, wrapInBox: false },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          type: 'string-select',
          key: 'aggregate',
          translationKey: 'configuration.oibus.manifest.south.items.opcua.ha-mode.aggregate',
          defaultValue: 'raw',
          selectableValues: ['raw', 'average', 'minimum', 'maximum', 'count'],
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        }
      ]
    }
  ]
};
const enablingManifest: SouthConnectorManifest = {
  ...manifest,
  items: {
    ...manifest.items,
    rootAttribute: {
      ...manifest.items.rootAttribute,
      attributes: [
        {
          type: 'string',
          key: 'name',
          translationKey: 'configuration.oibus.manifest.south.items.name',
          defaultValue: null,
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        },
        enablingSettings
      ]
    }
  }
};

// A connector whose discovery defaults give a workflow everything to be saved but its name
const presetManifest: SouthConnectorManifest = {
  ...enablingManifest,
  discovery: {
    kind: 'tree',
    defaults: { identityKeyFields: ['id'], itemFieldMapping: { name: '{{path}}', 'settings.mode': 'da' } }
  }
};

const existingWorkflow = buildWorkflowCommand('workflowId1', 'Reactor discovery', {
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  itemFieldMapping: { name: '{{name}}', enabled: 'true' },
  eligibilityFilter: [{ field: 'type', operator: 'equals', value: 'Variable' }],
  scanModeId: scanModes[0].id
});

/** What a new item mapping starts with besides the discovery defaults: enabled, and the history settings of the item modal */
const historyDefaults = {
  enabled: 'true',
  maxReadInterval: '3600',
  readDelay: '200',
  recoveryStrategy: 'oldest',
  emptyIntervalStrategy: 'keep',
  startTimeOffset: '0',
  endTimeOffset: '0'
};

const notRegistered: RegistrationSettingsDTO = { ...testData.oIAnalytics.registration.completed, status: 'NOT_REGISTERED' };
const registered: RegistrationSettingsDTO = { ...testData.oIAnalytics.registration.completed, status: 'REGISTERED' };

class EditWorkflowModalComponentTester {
  readonly fixture = TestBed.createComponent(EditWorkflowModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly name = this.root.getByCss('#workflow-name');
  readonly description = this.root.getByCss('#workflow-description');
  readonly reviewDescription = this.root.getByCss('#review-description');
  readonly scanMode = this.root.getByCss('#workflow-scan-mode');
  readonly localMode = this.root.getByLabelText('Create/update items locally');
  readonly remoteMode = this.root.getByLabelText('Push to OIAnalytics');
  readonly notRegisteredWarning = this.root.getByCss('#mode-remote-not-registered');
  readonly sqlFixedMode = this.root.getByText('This connector only supports pushing to OIAnalytics', { exact: false });
  readonly formError = this.root.getByCss('#form-error');
  readonly mustBeUnique = this.root.getByText('Must be unique');
  // discovery scope
  readonly discoveryNodes = this.root.getByCss('#discovery-nodes');
  readonly discoveryQuery = this.root.getByCss('#discovery-query');
  readonly discoveryQueryInput = this.root.getByCss('#discovery-query .cm-content');
  readonly exploreTree = this.root.getByCss('#discovery-explore-tree');
  readonly testQueryButton = this.root.getByRole('button', { name: 'Test query' });
  readonly queryTestError = this.root.getByCss('#discovery-query-test-error');
  readonly queryTestResult = this.root.getByCss('#discovery-query-test-result');
  readonly unsupportedScope = this.root.getByCss('#discovery-scope-unsupported');
  // identity key fields
  readonly identityKeyFields = this.root.getByCss('#identity-key-fields-list');
  readonly newIdentityKeyField = this.root.getByLabelText('Identity key fields');
  readonly addIdentityKeyFieldButton = this.root.getByCss('#add-identity-key-field');
  // eligibility filter
  readonly eligibilityTable = this.root.getByCss('#eligibility-filter-table');
  readonly eligibilityRows = this.root.getByCss('#eligibility-filter-table tbody tr');
  readonly noEligibilityCondition = this.root.getByText('No conditions - every discovered record is eligible');
  readonly newEligibilityField = this.root.getByCss('#new-eligibility-field');
  readonly newEligibilityOperator = this.root.getByCss('#new-eligibility-operator');
  readonly newEligibilityValue = this.root.getByCss('#new-eligibility-value');
  readonly addEligibilityConditionButton = this.root.getByCss('#add-eligibility-condition');
  // item field mapping
  readonly mappingTable = this.root.getByCss('#item-field-mapping-general');
  readonly enabledSwitch = this.root.getByCss('#workflow-enabled');
  readonly groupToggle = this.root.getByCss('#item-field-mapping-field-groupId');
  readonly createGroupButton = this.root.getByRole('button', { name: 'Create a new group...' });
  // explore wizard
  readonly exploreStep = this.root.getByCss('#step-explore');
  readonly checkedCount = this.root.getByCss('#explore-checked-count');
  readonly keepInSyncButton = this.root.getByRole('button', { name: 'Keep in sync…' });
  readonly addAsItemsButton = this.root.getByRole('button', { name: 'Add as items' });
  readonly flowActionButtons = this.root.getByCss('.explore-checked-action');
  readonly closeButton = this.root.getByRole('button', { name: 'Close' });
  readonly discoveredItemsTable = this.root.getByCss('#discovered-items-table');
  readonly discoveredItemNames = this.root.getByCss('.discovered-item-name');
  readonly discoveredItemsError = this.root.getByCss('#discovered-items-error');
  readonly discoveredItemsEmpty = this.root.getByCss('#discovered-items-empty');
  readonly discoveredItemsIncomplete = this.root.getByCss('#discovered-items-mapping-incomplete');
  readonly discoveredItemsNoNode = this.root.getByCss('#discovered-items-no-node');
  readonly discoveredItemsStale = this.root.getByCss('#discovered-items-stale');
  readonly refreshItemsButton = this.root.getByCss('#discover-items');
  readonly addItemsButton = this.root.getByCss('#add-discovered-items');
  // footer
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly okButton = this.root.getByRole('button', { name: 'OK' });
  readonly nextButton = this.root.getByCss('#next-step');
  readonly backButton = this.root.getByCss('#previous-step');

  /** The checkbox of a node of the Explore step tree */
  exploreCheck(nodeName: string) {
    return this.root.getByCss('.explore-node').filter({ hasText: nodeName }).getByCss('.explore-check').first();
  }

  stepButton(step: WizardStep) {
    return this.root.getByCss(`#workflow-step-${step}`);
  }

  async goToStep(step: WizardStep) {
    await this.stepButton(step).click();
  }

  /** Saves from the Review step, where a new workflow is saved */
  async save() {
    await this.goToStep('review');
    await this.saveButton.click();
  }

  async ok() {
    await this.goToStep('review');
    await this.okButton.click();
  }
  readonly cancelButton = this.root.getByCss('#cancel-button');

  mappingField(path: string) {
    return this.root.getByCss(`[id="item-field-mapping-field-${path}"]`);
  }

  mappingExpression(path: string) {
    return this.root.getByCss(`[id="item-field-mapping-field-${path}-expression"]`);
  }

  mappingRow(path: string) {
    return this.root.getByCss(`tr:has([id="item-field-mapping-field-${path}"])`);
  }

  groupOption(name: string) {
    return this.root.getByRole('button', { name, exact: true });
  }

  groupRowButton(groupName: string, name: 'Edit group' | 'Delete') {
    return this.root.getByCss('.group-row').filter({ hasText: groupName }).getByRole('button', { name });
  }

  async selectGroup(name: string) {
    await this.groupToggle.click();
    await this.groupOption(name).click();
  }

  async addIdentityKeyField(field: string) {
    await this.newIdentityKeyField.fill(field);
    await this.addIdentityKeyFieldButton.click();
  }

  async addEligibilityCondition(field: string, operator: string, value?: string) {
    await this.newEligibilityField.fill(field);
    await this.newEligibilityOperator.selectOptions(operator);
    if (value !== undefined) {
      await this.newEligibilityValue.fill(value);
    }
    await this.addEligibilityConditionButton.click();
  }
}

interface CreateOptions {
  mode?: 'create' | 'edit' | 'copy';
  workflowManifest?: SouthConnectorManifest;
  workflow?: ConfigurationWorkflowCommandDTO;
  existingWorkflows?: Array<{ id: string | null; name: string }>;
  workflowSouthId?: string;
  directSave?: boolean;
  prefill?: Pick<ConfigurationWorkflowCommandDTO, 'name' | 'discoveryScope'>;
  /** The step to open the wizard on - the one each group of tests is about, by default */
  step?: WorkflowStep;
}

describe('EditWorkflowModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let engineService: MockObject<EngineService>;
  let unsavedChangesService: MockObject<UnsavedChangesConfirmationService>;
  let modalService: MockModalService<unknown>;
  let clipboard: MockObject<Clipboard>;
  let notificationService: MockObject<NotificationService>;
  let groups: FakeSouthItemGroups;
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  /** The step the tests of a group are about, see CreateOptions.step */
  let startStep: WorkflowStep;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    southConnectorService = createMock(SouthConnectorService);
    engineService = createMock(EngineService);
    unsavedChangesService = createMock(UnsavedChangesConfirmationService);
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    clipboard = createMock(Clipboard);
    notificationService = createMock(NotificationService);
    configurationWorkflowService.previewCommand.mockReturnValue(NEVER);
    startStep = 'schedule';
    groups = fakeSouthItemGroups([buildSouthItemGroup('group1', 'Group 1')]);
    // Default: OIBus isn't registered with OIAnalytics - individual tests override this to exercise the
    // "Push to OIAnalytics" mode.
    engineService.getRegistrationSettings.mockReturnValue(of(notRegistered));
    // For the SQLite reference tree's own real ExploreTreeComponent, embedded inline.
    southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    southConnectorService.closeExplore.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: EngineService, useValue: engineService },
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService },
        { provide: Clipboard, useValue: clipboard },
        { provide: NotificationService, useValue: notificationService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent);
    modalService = TestBed.inject(MockModalService);
  });

  /** Opens the modal like ManageWorkflowsModalComponent does. */
  function create(options: CreateOptions = {}) {
    const {
      mode = 'create',
      workflowManifest = manifest,
      workflow = existingWorkflow,
      existingWorkflows = [existingWorkflow],
      workflowSouthId = southId,
      directSave = true,
      prefill,
      step = startStep
    } = options;
    const tester = new EditWorkflowModalComponentTester();
    const component = tester.fixture.componentInstance;
    component.directSave = directSave;
    switch (mode) {
      case 'create':
        component.prepareForCreation(scanModes, existingWorkflows, workflowManifest, workflowSouthId, southSettings, groups, prefill);
        break;
      case 'edit':
        component.prepareForEdition(scanModes, existingWorkflows, workflowManifest, workflow, workflowSouthId, southSettings, groups);
        break;
      case 'copy':
        component.prepareForCopy(scanModes, existingWorkflows, workflowManifest, workflow, workflowSouthId, southSettings, groups);
        break;
    }
    component.step.set(step);
    return tester;
  }

  function savedCommand(): ConfigurationWorkflowCommandDTO {
    return activeModal.close.mock.lastCall![0];
  }

  describe('form', () => {
    test('should populate the form and dynamic lists in edit mode', async () => {
      const tester = create({ mode: 'edit' });

      await expect.element(tester.title).toHaveTextContent('Edit items synchronisation');
      await expect.element(tester.name).toHaveValue('Reactor discovery');
      await expect.element(tester.scanMode).toHaveDisplayValue(scanModes[0].name);
      await expect.element(tester.localMode).toBeChecked();
      await expect.element(tester.identityKeyFields).toHaveTextContent('nodeId');
      await expect.element(tester.eligibilityRows.first()).toMatchTextContent(/type\s*equals\s*Variable/);
      await expect.element(tester.mappingField('name')).toHaveValue('{{name}}');
      // a workflow saved with a single root node shows it as the one node picked
      await expect.element(tester.discoveryNodes).toHaveTextContent('ns=1;s=Root');
    });

    test('should render an empty form in create mode, defaulting to local (item-creating) mode', async () => {
      const tester = create();

      await expect.element(tester.title).toHaveTextContent('Create a new items synchronisation');
      await expect.element(tester.name).toHaveValue('');
      await expect.element(tester.localMode).toBeChecked();
      await expect.element(tester.identityKeyFields).toHaveTextContent('');
      await expect.element(tester.noEligibilityCondition).toBeInTheDocument();
      await expect.element(tester.mappingField('name')).toHaveValue('');
      await expect.element(tester.discoveryNodes).toHaveTextContent('The whole data source');
    });

    test('should prefill a duplicate with the source workflow settings, a "-copy" name, and create-mode uniqueness', async () => {
      const tester = create({ mode: 'copy' });

      await expect.element(tester.title).toHaveTextContent('Duplicate items synchronisation');
      await expect.element(tester.name).toHaveValue('Reactor discovery-copy');
      await expect.element(tester.identityKeyFields).toHaveTextContent('nodeId');
      await expect.element(tester.mappingField('name')).toHaveValue('{{name}}');
      await expect.element(tester.discoveryNodes).toHaveTextContent('ns=1;s=Root');

      // The clone's blanked id means the uniqueness check excludes nothing - the original workflow's own
      // name is still reported as taken if renamed back onto it.
      await tester.name.fill('Reactor discovery');
      await userEvent.tab();
      await expect.element(tester.mustBeUnique).toBeInTheDocument();
    });

    test('should only exclude the edited workflow itself from the name uniqueness check', async () => {
      const tester = create({ mode: 'edit', existingWorkflows: [existingWorkflow, { id: 'temp_other', name: 'Other discovery' }] });

      await tester.name.fill('Reactor discovery');
      await userEvent.tab();
      await expect.element(tester.mustBeUnique).not.toBeInTheDocument();

      await tester.name.fill('other discovery');
      await expect.element(tester.mustBeUnique).toBeInTheDocument();
      await tester.save();
      expect(activeModal.close).not.toHaveBeenCalled();
    });

    test("should keep the edited workflow's own id on save, whether persisted or an in-memory temp one", async () => {
      const inMemoryWorkflow = { ...existingWorkflow, id: 'temp_123' };
      const tester = create({
        mode: 'edit',
        workflow: inMemoryWorkflow,
        existingWorkflows: [inMemoryWorkflow],
        workflowSouthId: 'create',
        step: 'items'
      });
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

      await tester.save();

      expect(savedCommand()).toEqual(expect.objectContaining({ id: 'temp_123', name: 'Reactor discovery', scanModeId: scanModes[0].id }));
    });

    test('should save a duplicate with a null id, leaving the caller to decide what to give it', async () => {
      const tester = create({ mode: 'copy', step: 'items' });
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

      await tester.save();

      expect(savedCommand()).toEqual(expect.objectContaining({ id: null, name: 'Reactor discovery-copy' }));
    });

    test('should label the confirm button "OK" rather than "Save" when the caller keeps workflows in memory', async () => {
      const tester = create({ directSave: false, step: 'review' });

      await expect.element(tester.okButton).toBeInTheDocument();
    });

    test('should close the modal with a valid command when everything is filled in', async () => {
      // the nodes come from the Explore step
      const tester = create({ prefill: { name: '', discoveryScope: { nodeIds: ['ns=1;s=Root'] } } });
      await tester.name.fill('New workflow');
      await tester.scanMode.selectOptions(scanModes[0].name);
      await tester.goToStep('items');
      await tester.addIdentityKeyField('nodeId');
      await tester.mappingField('name').fill('{{name}}');
      // scanModeId is a manifest-REQUIRED item field - a constant only, never a {{ }} expression
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
      await tester.mappingField('maxReadInterval').fill('  '); // blank after trim -> not included

      await tester.save();

      const { maxReadInterval: _blank, ...withoutMaxReadInterval } = historyDefaults;
      expect(activeModal.close).toHaveBeenCalledWith({
        id: null,
        name: 'New workflow',
        description: null,
        discoveryScope: { nodeIds: ['ns=1;s=Root'] },
        identityKeyFields: ['nodeId'],
        eligibilityFilter: [],
        itemFieldMapping: { name: '{{name}}', scanModeId: scanModes[0].id, ...withoutMaxReadInterval },
        pushToOIAnalytics: false,
        scanModeId: scanModes[0].id,
        enabled: true
      });
    });

    // the items of a saved workflow are mapped to a schedule
    const describedWorkflow: ConfigurationWorkflowCommandDTO = {
      ...existingWorkflow,
      description: 'The variables of the reactor',
      itemFieldMapping: { ...existingWorkflow.itemFieldMapping, scanModeId: scanModes[0].id }
    };

    test('should load, review and save the description of an edited workflow', async () => {
      const tester = create({ mode: 'edit', workflow: describedWorkflow });

      await expect.element(tester.description).toHaveValue('The variables of the reactor');
      await tester.description.fill('  The variables of the reactor and the boiler  ');
      await tester.goToStep('review');
      await expect.element(tester.reviewDescription).toHaveTextContent('The variables of the reactor and the boiler');
      await tester.save();

      expect(savedCommand()).toEqual(
        expect.objectContaining({ id: existingWorkflow.id, description: 'The variables of the reactor and the boiler' })
      );
    });

    test('should save a blank description as none, and not review it', async () => {
      const tester = create({ mode: 'edit', workflow: describedWorkflow });

      await tester.description.fill('   ');
      await tester.goToStep('review');
      await expect.element(tester.reviewDescription).not.toBeInTheDocument();
      await tester.save();

      expect(savedCommand()).toEqual(expect.objectContaining({ description: null }));
    });

    test('should keep the description of a duplicated workflow', async () => {
      const tester = create({ mode: 'copy', workflow: describedWorkflow });

      await expect.element(tester.description).toHaveValue('The variables of the reactor');
    });

    test('should not save without a name', async () => {
      const tester = create();

      await tester.save();

      expect(activeModal.close).not.toHaveBeenCalled();
    });

    test('should cancel by dismissing the modal', async () => {
      const tester = create();

      await tester.cancelButton.click();

      expect(activeModal.dismiss).toHaveBeenCalled();
    });

    test('should only ask for confirmation before dismissing when there are unsaved changes', async () => {
      const tester = create({ mode: 'edit' });
      await expect.element(tester.name).toHaveValue('Reactor discovery');
      expect(tester.fixture.componentInstance.canDismiss()).toBe(true);

      const confirmation = of(true);
      unsavedChangesService.confirmUnsavedChanges.mockReturnValue(confirmation);
      await tester.name.fill('changed');

      expect(tester.fixture.componentInstance.canDismiss()).toBe(confirmation);
    });
  });

  describe('discovery scope', () => {
    test('should remind, in the Filter step, the nodes a tree-based connector discovers from', async () => {
      const tester = create({ step: 'filter' });
      await expect.element(tester.discoveryQuery).not.toBeInTheDocument();
      await expect.element(tester.unsupportedScope).not.toBeInTheDocument();
      await expect.element(tester.discoveryNodes).toHaveTextContent('The whole data source');

      const picked = create({
        mode: 'edit',
        step: 'filter',
        workflow: { ...existingWorkflow, discoveryScope: { nodeIds: ['ns=1;s=Reactor', 'ns=1;s=Boiler'] } }
      });

      await expect.element(picked.discoveryNodes).toMatchTextContent(/Reactor.*Boiler/);
      // the nodes are the ones of the Explore step: nothing to pick, nor to remove, here
      await expect.element(picked.root.getByRole('button', { name: 'Remove ns=1;s=Reactor' })).not.toBeInTheDocument();
      await expect.element(picked.root.getByRole('button', { name: /nodes/ })).not.toBeInTheDocument();
    });

    test('should have no Source step for a tree-based connector, which has its Explore step', async () => {
      const tester = create({ step: 'filter' });

      await expect.element(tester.stepButton('source')).not.toBeInTheDocument();
      await expect.element(tester.stepButton('filter')).toBeInTheDocument();
    });

    test('should save the nodes of the workflow as its discovery scope', async () => {
      const tester = create({ mode: 'edit' });

      await tester.goToStep('items');
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
      await tester.save();
      // A single root node of an older workflow is saved as the one node picked
      expect(savedCommand().discoveryScope).toEqual({ nodeIds: ['ns=1;s=Root'] });
    });

    test('should default a tree-based connector to an empty discoveryScope when no node was picked', async () => {
      const tester = create({ mode: 'edit', workflow: { ...existingWorkflow, discoveryScope: {} } });
      await tester.goToStep('items');
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

      await tester.save();

      expect(savedCommand().discoveryScope).toEqual({});
    });

    test('should show a query-only editor, with no reference tree, for a SQL-family connector without explore()', async () => {
      const tester = create({ workflowManifest: sqlManifest, step: 'source' });

      await expect.element(tester.discoveryQuery).toBeInTheDocument();
      await expect.element(tester.exploreTree).not.toBeInTheDocument();
      await expect.element(tester.unsupportedScope).not.toBeInTheDocument();
    });

    test('should show the reference explore tree above the query editor for SQLite', async () => {
      const tester = create({ workflowManifest: sqliteManifest, step: 'source' });

      await expect.element(tester.exploreTree).toBeInTheDocument();
      await expect.element(tester.discoveryQuery).toBeInTheDocument();
      expect(southConnectorService.startExplore).toHaveBeenCalled();
    });

    test('should start a new workflow from the prefilled name and nodes', async () => {
      const tester = create({ prefill: { name: 'Reactor', discoveryScope: { nodeIds: ['ns=1;s=Reactor'] } } });

      await expect.element(tester.name).toHaveValue('Reactor');
      await expect.element(tester.discoveryNodes).toHaveTextContent('ns=1;s=Reactor');
      expect(tester.fixture.componentInstance.canDismiss()).toBe(true);
    });

    test('should show an unsupported-connector message when the connector has no discovery, even if it can be explored', async () => {
      const tester = create({ workflowManifest: unsupportedManifest, step: 'source' });

      await expect.element(tester.unsupportedScope).toBeInTheDocument();
      await expect.element(tester.discoveryQuery).not.toBeInTheDocument();
    });

    test('should test the discovery query as currently typed and show the raw rows', async () => {
      const tester = create({ workflowManifest: sqlManifest, workflowSouthId: 'create', step: 'source' });
      await expect.element(tester.testQueryButton).toBeDisabled();
      southConnectorService.testDiscoveryQuery.mockReturnValue(of([{ name: 'sensor1', unit: 'C' }]));

      await tester.discoveryQueryInput.fill('SELECT name, unit FROM metadata');
      await tester.testQueryButton.click();

      expect(southConnectorService.testDiscoveryQuery).toHaveBeenCalledWith(
        'create',
        'mysql',
        southSettings,
        'SELECT name, unit FROM metadata'
      );
      await expect.element(tester.queryTestResult).toMatchTextContent('sensor1');
      await expect.element(tester.queryTestError).not.toBeInTheDocument();
    });

    test('should show an error when the discovery query test fails', async () => {
      const tester = create({ workflowManifest: sqlManifest, step: 'source' });
      southConnectorService.testDiscoveryQuery.mockReturnValue(throwError(() => ({ error: { message: 'no such table: nope' } })));

      await tester.discoveryQueryInput.fill('SELECT * FROM nope');
      await tester.testQueryButton.click();

      await expect.element(tester.queryTestError).toHaveTextContent('no such table: nope');
      await expect.element(tester.queryTestResult).not.toBeInTheDocument();
      await expect.element(tester.testQueryButton).toBeEnabled();
    });

    test('should read discoveryScope.query back for a SQL-family workflow being edited', async () => {
      const sqlWorkflow = { ...existingWorkflow, discoveryScope: { query: 'SELECT 1' }, pushToOIAnalytics: true };
      const tester = create({
        mode: 'edit',
        workflow: sqlWorkflow,
        existingWorkflows: [sqlWorkflow],
        workflowManifest: sqlManifest,
        step: 'source'
      });

      await expect.element(tester.discoveryQueryInput).toHaveTextContent('SELECT 1');
      await expect.element(tester.testQueryButton).toBeEnabled();
    });

    test('should force "Push to OIAnalytics" and hide the mode picker and item field mapping for a SQL-family connector', async () => {
      const tester = create({ workflowManifest: sqlManifest, step: 'source' });

      await expect.element(tester.sqlFixedMode).toBeInTheDocument();
      await expect.element(tester.localMode).not.toBeInTheDocument();
      await expect.element(tester.remoteMode).not.toBeInTheDocument();
      await expect.element(tester.mappingTable).not.toBeInTheDocument();
      await expect.element(tester.identityKeyFields).not.toBeInTheDocument();
      await expect.element(tester.notRegisteredWarning).toBeInTheDocument();
    });

    test("should reject saving when a SQL connector's metadata query is blank", async () => {
      const tester = create({ workflowManifest: sqlManifest, step: 'schedule' });
      await tester.name.fill('SQL workflow');

      await tester.save();

      await expect.element(tester.formError).toHaveTextContent('A metadata query is required');
      expect(activeModal.close).not.toHaveBeenCalled();
    });

    test('should always push to OIAnalytics with a trimmed query when saving a SQL-family workflow', async () => {
      engineService.getRegistrationSettings.mockReturnValue(of(registered));
      const sqlWorkflow = { ...existingWorkflow, discoveryScope: { query: '  SELECT column_name FROM my_metadata_table  ' } };
      const tester = create({ mode: 'edit', workflow: sqlWorkflow, existingWorkflows: [sqlWorkflow], workflowManifest: sqlManifest });
      await expect.element(tester.notRegisteredWarning).not.toBeInTheDocument();

      await tester.save();

      expect(savedCommand()).toEqual(
        expect.objectContaining({
          discoveryScope: { query: 'SELECT column_name FROM my_metadata_table' },
          pushToOIAnalytics: true,
          itemFieldMapping: null,
          identityKeyFields: []
        })
      );
    });
  });

  describe('mode', () => {
    beforeEach(() => {
      startStep = 'items';
    });

    test('should allow picking the remote mode while OIBus is not registered, and show a warning instead of blocking it', async () => {
      const tester = create();
      await expect.element(tester.localMode).toBeChecked();
      await expect.element(tester.notRegisteredWarning).not.toBeInTheDocument();

      await tester.remoteMode.click();

      await expect.element(tester.notRegisteredWarning).toBeInTheDocument();
      await tester.goToStep('schedule');
      await tester.name.fill('New workflow');
      await tester.save();
      expect(savedCommand()).toEqual(expect.objectContaining({ pushToOIAnalytics: true }));
    });

    test('should only show identity key fields and the item field mapping in local mode', async () => {
      const tester = create();
      await expect.element(tester.identityKeyFields).toBeInTheDocument();

      await tester.remoteMode.click();
      await expect.element(tester.identityKeyFields).not.toBeInTheDocument();
      await expect.element(tester.mappingTable).not.toBeInTheDocument();

      await tester.localMode.click();
      await expect.element(tester.identityKeyFields).toBeInTheDocument();
      await expect.element(tester.mappingTable).toBeInTheDocument();
    });

    test('should save a remote workflow without identity key fields nor item field mapping, when OIBus is registered', async () => {
      engineService.getRegistrationSettings.mockReturnValue(of(registered));
      const tester = create({ mode: 'edit' });

      await tester.remoteMode.click();
      await expect.element(tester.notRegisteredWarning).not.toBeInTheDocument();
      await tester.save();

      // Identity keys only apply to local mode - never sent for a remote workflow, even if some were typed before switching.
      expect(savedCommand()).toEqual(expect.objectContaining({ pushToOIAnalytics: true, itemFieldMapping: null, identityKeyFields: [] }));
    });
  });

  describe('identity key fields', () => {
    beforeEach(() => {
      startStep = 'items';
    });

    test('should add and remove identity key fields, ignoring duplicates', async () => {
      const tester = create();
      await expect.element(tester.addIdentityKeyFieldButton).toHaveAccessibleName('Add');

      await tester.addIdentityKeyField('nodeId');
      await tester.newIdentityKeyField.fill('unit');
      await userEvent.keyboard('{Enter}');
      await expect.element(tester.identityKeyFields).toMatchTextContent(/nodeId\s*unit/);
      await expect.element(tester.newIdentityKeyField).toHaveValue('');
      await tester.addIdentityKeyField('nodeId');
      await tester.addIdentityKeyField('  ');
      await expect.element(tester.identityKeyFields.getByRole('button', { name: 'Delete' })).toHaveLength(2);

      await tester.identityKeyFields.getByRole('button', { name: 'Delete' }).first().click();

      await expect.element(tester.identityKeyFields).toHaveTextContent('unit');
    });

    test('should reject saving a local workflow without identity key field', async () => {
      const tester = create({ step: 'schedule' });
      await tester.name.fill('New workflow');

      await tester.save();

      await expect.element(tester.formError).toHaveTextContent('At least one identity key field is required');
      expect(activeModal.close).not.toHaveBeenCalled();
    });
  });

  describe('eligibility filter', () => {
    beforeEach(() => {
      startStep = 'filter';
    });

    test('should add conditions, without a value for "exists", and ignore an empty field', async () => {
      const tester = create({ mode: 'edit', workflow: { ...existingWorkflow, eligibilityFilter: [] }, step: 'items' });
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
      await tester.goToStep('filter');

      await tester.addEligibilityCondition('  ', 'equals', 'ignored');
      await expect.element(tester.noEligibilityCondition).toBeInTheDocument();
      await tester.addEligibilityCondition('type', 'equals', 'Variable');
      await tester.newEligibilityField.fill('unit');
      await tester.newEligibilityOperator.selectOptions('exists');
      await expect.element(tester.newEligibilityValue).not.toBeInTheDocument();
      await tester.addEligibilityConditionButton.click();

      await expect.element(tester.eligibilityRows).toHaveLength(2);
      await expect.element(tester.newEligibilityField).toHaveValue('');
      await expect.element(tester.newEligibilityOperator).toHaveDisplayValue('equals');
      await tester.save();
      expect(savedCommand().eligibilityFilter).toEqual([
        { field: 'type', operator: 'equals', value: 'Variable' },
        { field: 'unit', operator: 'exists' }
      ]);
    });

    test('should edit an eligibility condition in place', async () => {
      const tester = create({ mode: 'edit', step: 'items' });
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
      await tester.goToStep('filter');

      await tester.eligibilityRows.first().getByRole('button', { name: 'Edit' }).click();
      const editedRow = tester.eligibilityRows.first();
      await expect.element(editedRow.getByLabelText('Field')).toHaveValue('type');
      await expect.element(editedRow.getByLabelText('Operator')).toHaveDisplayValue('equals');
      await expect.element(editedRow.getByLabelText('Value')).toHaveValue('Variable');

      await editedRow.getByLabelText('Field').fill('kind');
      await editedRow.getByLabelText('Operator').selectOptions('contains');
      await editedRow.getByLabelText('Value').fill('Sensor');
      await editedRow.getByRole('button', { name: 'Save' }).click();

      await expect.element(tester.eligibilityRows.first()).toMatchTextContent(/kind\s*contains\s*Sensor/);
      await tester.save();
      expect(savedCommand().eligibilityFilter).toEqual([{ field: 'kind', operator: 'contains', value: 'Sensor' }]);
    });

    test('should not save an eligibility edit with a blank field, and should drop the value when switching to "exists"', async () => {
      const tester = create({ mode: 'edit' });
      await tester.eligibilityRows.first().getByRole('button', { name: 'Edit' }).click();
      const editedRow = tester.eligibilityRows.first();

      await editedRow.getByLabelText('Field').fill('   ');
      await editedRow.getByRole('button', { name: 'Save' }).click();
      // Rejected - edit mode stays open
      await expect.element(editedRow.getByLabelText('Field')).toBeInTheDocument();

      await editedRow.getByLabelText('Field').fill('type');
      await editedRow.getByLabelText('Operator').selectOptions('exists');
      await expect.element(editedRow.getByLabelText('Value')).not.toBeInTheDocument();
      await editedRow.getByRole('button', { name: 'Save' }).click();

      await expect.element(tester.eligibilityRows.first()).toMatchTextContent(/type\s*exists/);
    });

    test('should cancel an in-progress eligibility edit without changing the condition', async () => {
      const tester = create({ mode: 'edit' });
      await tester.eligibilityRows.first().getByRole('button', { name: 'Edit' }).click();
      await tester.eligibilityRows.first().getByLabelText('Field').fill('changed');

      await tester.eligibilityRows.first().getByRole('button', { name: 'Cancel' }).click();

      await expect.element(tester.eligibilityRows.first()).toMatchTextContent(/type\s*equals\s*Variable/);
    });

    test('should drop an in-progress eligibility edit when a condition is removed, since indices shift', async () => {
      const tester = create({
        mode: 'edit',
        workflow: {
          ...existingWorkflow,
          eligibilityFilter: [
            { field: 'a', operator: 'equals', value: '1' },
            { field: 'b', operator: 'equals', value: '2' }
          ]
        }
      });
      await tester.eligibilityRows.nth(1).getByRole('button', { name: 'Edit' }).click();

      await tester.eligibilityRows.first().getByRole('button', { name: 'Delete' }).click();

      await expect.element(tester.eligibilityRows).toHaveLength(1);
      await expect.element(tester.eligibilityRows.first()).toMatchTextContent(/b\s*equals\s*2/);
      await expect.element(tester.eligibilityRows.first().getByLabelText('Field')).not.toBeInTheDocument();
    });
  });

  describe('item field mapping', () => {
    beforeEach(() => {
      startStep = 'items';
    });

    test('should list every field the manifest exposes, plus the historian fields', async () => {
      const tester = create();

      // Top-level manifest fields (scanMode renamed to the command's own scanModeId path), settings.* fields, historian fields
      for (const path of [
        'name',
        'description',
        'enabled',
        'scanModeId',
        'settings.objectValue',
        'groupId',
        'maxReadInterval',
        'readDelay',
        'startTimeOffset',
        'endTimeOffset',
        'recoveryStrategy',
        'emptyIntervalStrategy'
      ]) {
        await expect.element(tester.mappingField(path)).toBeInTheDocument();
      }
      await expect.element(tester.mappingField('scanMode')).not.toBeInTheDocument();
    });

    test('should not add historian fields when the manifest does not support history', async () => {
      const tester = create({ workflowManifest: noHistoryManifest });

      await expect.element(tester.mappingField('name')).toBeInTheDocument();
      // the description of an item is not a history setting
      await expect.element(tester.mappingField('description')).toBeInTheDocument();
      await expect.element(tester.mappingField('maxReadInterval')).not.toBeInTheDocument();
      await expect.element(tester.mappingField('groupId')).not.toBeInTheDocument();
    });

    test('should map the description of the items to a {{ }} expression', async () => {
      const tester = create({ mode: 'edit' });
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

      await tester.mappingField('description').fill('{{description}}');
      await tester.save();

      expect(savedCommand().itemFieldMapping).toEqual(expect.objectContaining({ description: '{{description}}' }));
    });

    test('should render a select (not a text box) for boolean, scan-mode, and string-select fields', async () => {
      const tester = create();

      await expect.element(tester.mappingField('enabled').getByRole('option', { name: 'Yes' })).toBeInTheDocument();
      await expect.element(tester.mappingField('enabled').getByRole('option', { name: 'No' })).toBeInTheDocument();
      await expect.element(tester.mappingField('scanModeId').getByRole('option', { name: scanModes[0].name })).toBeInTheDocument();
      await expect
        .element(tester.mappingField('recoveryStrategy').getByRole('option', { name: 'From oldest to newest' }))
        .toBeInTheDocument();
      await expect
        .element(tester.mappingField('emptyIntervalStrategy').getByRole('option', { name: 'Advance the tracked instant' }))
        .toBeInTheDocument();
      await expect.element(tester.mappingField('name')).toHaveRole('textbox');
    });

    test('should label a manifest string-select field with its title, and the historian ones with their flat label', async () => {
      const tester = create({ workflowManifest: enablingManifest });

      await expect.element(tester.mappingRow('settings.mode').getByCss('label')).toHaveTextContent('Mode');
      await expect.element(tester.mappingRow('recoveryStrategy').getByCss('label')).toHaveTextContent('Recovery strategy');
      await expect.element(tester.mappingRow('emptyIntervalStrategy').getByCss('label')).toHaveTextContent('When no data is found');
    });

    test('should switch a select-type field into variable mode and expose an expression input when the sentinel is chosen', async () => {
      const tester = create({ mode: 'edit' });
      await expect.element(tester.mappingExpression('enabled')).not.toBeInTheDocument();

      await tester.mappingField('enabled').selectOptions('Use a {{ field }} expression...');

      await expect.element(tester.mappingExpression('enabled')).toHaveValue('{{}}');
      await tester.mappingExpression('enabled').fill('{{isEnabled}}');
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
      await tester.save();
      expect(savedCommand().itemFieldMapping).toEqual(expect.objectContaining({ enabled: '{{isEnabled}}' }));
    });

    test('should treat an existing {{...}} value on a select-type field as already in variable mode when editing', async () => {
      const tester = create({ mode: 'edit', workflow: { ...existingWorkflow, itemFieldMapping: { enabled: '{{isEnabled}}' } } });

      await expect.element(tester.mappingField('enabled')).toHaveValue('__variable__');
      await expect.element(tester.mappingExpression('enabled')).toHaveValue('{{isEnabled}}');
    });

    test('should let a field referenced by an enablingCondition vary per record', async () => {
      const tester = create({ workflowManifest: enablingManifest });

      await expect.element(tester.mappingField('settings.mode').getByRole('option', { name: 'HA' })).toBeInTheDocument();
      await expect
        .element(tester.mappingField('settings.mode').getByRole('option', { name: 'Use a {{ field }} expression...' }))
        .toBeInTheDocument();
    });

    test('should show the fields a referral controls when it is mapped to a {{ }} expression, since they may apply', async () => {
      const tester = create({ workflowManifest: enablingManifest });
      await expect.element(tester.mappingField('settings.haMode.aggregate')).not.toBeInTheDocument();

      await tester.mappingField('settings.mode').selectOptions('Use a {{ field }} expression...');
      await tester.mappingExpression('settings.mode').fill('{{mode}}');

      await expect.element(tester.mappingField('settings.haMode.aggregate')).toBeInTheDocument();
    });

    test('should hide a field gated by an enablingCondition until the referral constant matches, then show it', async () => {
      const tester = create({ workflowManifest: enablingManifest });
      await expect.element(tester.mappingField('settings.mode')).toBeInTheDocument();
      await expect.element(tester.mappingField('settings.haMode.aggregate')).not.toBeInTheDocument();

      await tester.mappingField('settings.mode').selectOptions('DA');
      await expect.element(tester.mappingField('settings.haMode.aggregate')).not.toBeInTheDocument();

      await tester.mappingField('settings.mode').selectOptions('HA');
      await expect.element(tester.mappingField('settings.haMode.aggregate')).toBeInTheDocument();
      // nested beyond the settings wrapper: its ancestor object's label is shown as breadcrumb
      await expect.element(tester.mappingRow('settings.haMode.aggregate')).toMatchTextContent('HA mode');
      await expect.element(tester.mappingRow('settings.mode')).not.toMatchTextContent('HA mode');
    });

    test("should keep a hidden field's value while editing, but strip it from the mapping at save time", async () => {
      const workflow = { ...existingWorkflow, itemFieldMapping: { 'settings.mode': 'ha', 'settings.haMode.aggregate': 'average' } };
      const tester = create({ mode: 'edit', workflow, workflowManifest: enablingManifest });
      await expect.element(tester.mappingField('settings.haMode.aggregate')).toHaveDisplayValue('Average');

      await tester.mappingField('settings.mode').selectOptions('DA');
      await expect.element(tester.mappingField('settings.haMode.aggregate')).not.toBeInTheDocument();
      await tester.save();

      expect(savedCommand().itemFieldMapping).toEqual({ 'settings.mode': 'da' });
    });

    test('should save a field that gates other fields mapped to a {{ }} expression, with the fields it controls', async () => {
      const workflow = {
        ...existingWorkflow,
        itemFieldMapping: { 'settings.mode': '{{mode}}', 'settings.haMode.aggregate': 'average' }
      };
      const tester = create({ mode: 'edit', workflow, workflowManifest: enablingManifest });

      await tester.save();

      expect(savedCommand().itemFieldMapping).toEqual({ 'settings.mode': '{{mode}}', 'settings.haMode.aggregate': 'average' });
    });

    test('should never offer {{ }} for the schedule, recoveryStrategy and syncWithGroup fields', async () => {
      const tester = create();
      await tester.selectGroup('Group 1');

      for (const path of ['scanModeId', 'recoveryStrategy', 'syncWithGroup']) {
        await expect
          .element(tester.mappingField(path).getByRole('option', { name: 'Use a {{ field }} expression...' }))
          .not.toBeInTheDocument();
      }
    });

    test('should hint "constant value" on the constant-only text fields, and reject a {{ }} expression in them', async () => {
      const tester = create({ mode: 'edit' });
      await expect.element(tester.mappingField('maxReadInterval')).toHaveAttribute('placeholder', 'constant value');
      await expect.element(tester.mappingField('name')).toHaveAttribute('placeholder', 'constant or {{field}}');

      await tester.mappingField('maxReadInterval').fill('{{interval}}');
      await tester.save();

      await expect.element(tester.formError).toMatchTextContent('This field must be mapped to a constant');
      expect(activeModal.close).not.toHaveBeenCalled();
    });

    test('should reject saving when a mandatory item field is not mapped, and flag it', async () => {
      const tester = create({ mode: 'edit' });
      await expect.element(tester.mappingRow('scanModeId')).toMatchTextContent('Required');
      await expect.element(tester.mappingRow('enabled')).not.toMatchTextContent('Required');

      await tester.save();

      await expect.element(tester.formError).toMatchTextContent('Every mandatory field (marked "Required") must be mapped');
      expect(activeModal.close).not.toHaveBeenCalled();
    });

    test('should make the enabled field mandatory, whatever the manifest says', async () => {
      const tester = create({
        mode: 'edit',
        workflow: { ...existingWorkflow, itemFieldMapping: { name: '{{name}}', scanModeId: scanModes[0].id } }
      });
      await expect.element(tester.mappingRow('enabled')).toMatchTextContent('Required');
      await expect.element(tester.mappingField('enabled')).toHaveDisplayValue('Not mapped');

      await tester.save();

      await expect.element(tester.formError).toMatchTextContent('Every mandatory field');
      expect(activeModal.close).not.toHaveBeenCalled();
      await expect.element(tester.stepButton('items')).toHaveAttribute('aria-current', 'step');

      await tester.mappingField('enabled').selectOptions('No');
      await expect.element(tester.mappingRow('enabled')).not.toMatchTextContent('Required');
      await tester.save();
      expect(savedCommand().itemFieldMapping).toEqual(expect.objectContaining({ enabled: 'false' }));
    });
  });

  describe('wizard', () => {
    const records = [
      { id: 'ns=1;s=T', path: 'Reactor/Temperature', unit: '°C' },
      { id: 'ns=1;s=P', path: 'Reactor/Pressure', unit: 'bar' }
    ];

    function previewResult(overrides: Partial<WorkflowPreviewResultDTO> = {}): WorkflowPreviewResultDTO {
      return { discoveredCount: 3, eligibleCount: 2, entries: [], records, ...overrides };
    }

    test('should walk through the steps of a tree-based connector, a new workflow being saved from the last one', async () => {
      const tester = create({ step: 'filter' });
      await expect.element(tester.stepButton('filter')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.backButton).not.toBeInTheDocument();
      await expect.element(tester.saveButton).not.toBeInTheDocument();

      await tester.nextButton.click();
      await expect.element(tester.stepButton('items')).toHaveAttribute('aria-current', 'step');
      await tester.nextButton.click();
      await expect.element(tester.stepButton('schedule')).toHaveAttribute('aria-current', 'step');
      await tester.nextButton.click();

      await expect.element(tester.stepButton('review')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.nextButton).not.toBeInTheDocument();
      await expect.element(tester.saveButton).toBeInTheDocument();
      await tester.backButton.click();
      await expect.element(tester.stepButton('schedule')).toHaveAttribute('aria-current', 'step');
    });

    test('should name the workflow with its schedule', async () => {
      const tester = create({ step: 'schedule' });

      await expect.element(tester.stepButton('schedule')).toMatchTextContent('Name & schedule');
      await expect.element(tester.name).toBeVisible();
      await expect.element(tester.scanMode).toBeVisible();
    });

    test('should need a query before leaving the Source step of a SQL-family connector', async () => {
      const tester = create({ workflowManifest: sqlManifest, step: 'source' });

      await tester.nextButton.click();

      await expect.element(tester.formError).toHaveTextContent('A metadata query is required');
      await expect.element(tester.stepButton('source')).toHaveAttribute('aria-current', 'step');
    });

    test('should save an edited workflow from any step, Save being then the main action rather than Next', async () => {
      const tester = create({ mode: 'edit' });

      await expect.element(tester.saveButton).toBeInTheDocument();
      await expect.element(tester.nextButton).toHaveClass('btn-subtle');
    });

    test('should make Next the main action until Save shows', async () => {
      const tester = create();

      await expect.element(tester.nextButton).toHaveClass('btn-primary');
    });

    test('should go back to the step to fix when saving fails', async () => {
      const tester = create({ step: 'schedule' });
      await tester.name.fill('Reactor');

      await tester.save();

      await expect.element(tester.formError).toHaveTextContent('At least one identity key field is required');
      await expect.element(tester.stepButton('items')).toHaveAttribute('aria-current', 'step');
    });

    test('should list the records the filter keeps on the Filter step, and suggest their fields', async () => {
      configurationWorkflowService.previewCommand.mockReturnValue(of(previewResult()));
      const tester = create({ mode: 'edit' });

      await tester.goToStep('filter');

      expect(configurationWorkflowService.previewCommand.mock.lastCall![4].eligibilityFilter).toEqual(existingWorkflow.eligibilityFilter);
      await expect.element(tester.root.getByCss('#filter-preview-count')).toHaveTextContent('Matching records: 2 of 3');
      await expect.element(tester.root.getByCss('#step-filter .records-table tbody tr')).toHaveLength(2);
      await expect.element(tester.root.getByCss('#record-fields option')).toHaveLength(3);
      await expect.element(tester.newEligibilityField).toHaveAttribute('list', 'record-fields');
    });

    test('should show the records, with the values of their fields, on the Items step too', async () => {
      configurationWorkflowService.previewCommand.mockReturnValue(of(previewResult()));
      const tester = create({ mode: 'edit', step: 'schedule' });
      await tester.goToStep('filter');
      configurationWorkflowService.previewCommand.mockClear();

      await tester.goToStep('items');

      const rows = tester.root.getByCss('#items-records .records-table tbody tr');
      await expect.element(rows).toHaveLength(2);
      await expect.element(rows.nth(0)).toMatchTextContent('Reactor/Temperature');
      await expect.element(rows.nth(1)).toMatchTextContent('bar');
      // the Filter step just discovered them, for the same nodes and filter
      expect(configurationWorkflowService.previewCommand).not.toHaveBeenCalled();
    });

    test('should discover the records again on the Items step when the filter changed since', async () => {
      configurationWorkflowService.previewCommand.mockReturnValue(of(previewResult()));
      const tester = create({ mode: 'edit', step: 'schedule' });
      await tester.goToStep('filter');
      await tester.addEligibilityCondition('unit', 'equals', 'bar');
      configurationWorkflowService.previewCommand.mockClear();

      await tester.goToStep('items');

      expect(configurationWorkflowService.previewCommand).toHaveBeenCalledTimes(1);
      expect(configurationWorkflowService.previewCommand.mock.lastCall![4].eligibilityFilter).toContainEqual({
        field: 'unit',
        operator: 'equals',
        value: 'bar'
      });
    });

    test('should discover the records of the Items step when the Filter step was not opened', async () => {
      configurationWorkflowService.previewCommand.mockReturnValue(of(previewResult()));
      const tester = create({ mode: 'edit', step: 'schedule' });

      await tester.goToStep('items');

      expect(configurationWorkflowService.previewCommand).toHaveBeenCalledTimes(1);
      await expect.element(tester.root.getByCss('#items-records .records-table tbody tr')).toHaveLength(2);
    });

    test('should say why there is no record on the Items step', async () => {
      configurationWorkflowService.previewCommand.mockReturnValue(
        throwError(() => new HttpErrorResponse({ error: { message: 'unreachable' } }))
      );
      const tester = create({ mode: 'edit', step: 'schedule' });

      await tester.goToStep('items');
      await expect.element(tester.root.getByCss('#items-preview-error')).toHaveTextContent('unreachable');

      configurationWorkflowService.previewCommand.mockReturnValue(of(previewResult({ records: [], eligibleCount: 0 })));
      await tester.goToStep('schedule');
      await tester.goToStep('items');
      await expect.element(tester.root.getByCss('#items-records-none')).toMatchTextContent('No record is discovered');
    });

    test('should show the names the matching records would give their items', async () => {
      configurationWorkflowService.previewCommand.mockReturnValue(of(previewResult()));
      const tester = create({ mode: 'edit', workflow: { ...existingWorkflow, itemFieldMapping: { name: '{{path}} ({{unit}})' } } });
      await tester.goToStep('filter');

      await tester.goToStep('items');

      await expect
        .element(tester.root.getByCss('#example-item-names'))
        .toHaveTextContent('Example item names:Reactor/Temperature (°C)Reactor/Pressure (bar)');
    });

    test('should preview what a run would do on the Review step, against the previous run of a saved workflow', async () => {
      configurationWorkflowService.previewCommand.mockReturnValue(
        of(
          previewResult({
            entries: [
              { key: 'a', status: 'new', record: records[0], previousMetadata: null },
              { key: 'b', status: 'missing', record: null, previousMetadata: {} }
            ]
          })
        )
      );
      const tester = create({ mode: 'edit', step: 'items' });
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

      await tester.goToStep('review');

      expect(configurationWorkflowService.previewCommand.mock.lastCall![3]).toBe(existingWorkflow.id);
      const previewRows = tester.root.getByCss('#preview-entries-table tbody tr');
      await expect.element(previewRows).toHaveLength(2);
      await expect.element(previewRows.nth(0).getByCss('.badge')).toHaveTextContent('New');
      await expect.element(previewRows.nth(1).getByCss('.badge')).toHaveTextContent('Missing');
      await expect.element(tester.root.getByCss('#review-summary')).toMatchTextContent(/Reactor discovery/);
    });

    test('should list what to fix on the Review step instead of previewing a run', async () => {
      const tester = create({ step: 'review' });

      const errors = tester.root.getByCss('#review-errors');
      await expect.element(errors).toMatchTextContent('At least one identity key field is required');
      await expect.element(errors).toMatchTextContent('A name is required');
      // and the mapping, whose schedule is mandatory
      await expect.element(errors.getByCss('.review-error')).toHaveLength(3);
      await expect.element(tester.root.getByCss('#preview-review')).toBeDisabled();
      expect(configurationWorkflowService.previewCommand).not.toHaveBeenCalled();
    });

    test('should go to the step of an error, and stop listing it once it is fixed', async () => {
      configurationWorkflowService.previewCommand.mockReturnValue(of(previewResult()));
      const tester = create({ step: 'review', workflowManifest: presetManifest });

      await expect.element(tester.root.getByCss('#review-errors')).toMatchTextContent('A name is required');
      await tester.root.getByCss('#review-errors .review-error button').click();
      await expect.element(tester.stepButton('schedule')).toHaveAttribute('aria-current', 'step');
      await tester.name.fill('Reactor');
      await tester.goToStep('review');

      await expect.element(tester.root.getByCss('#review-errors')).not.toBeInTheDocument();
      await expect.element(tester.root.getByCss('#preview-review')).toBeEnabled();
      expect(configurationWorkflowService.previewCommand).toHaveBeenCalled();
    });

    test('should name a name that is already used among the errors', async () => {
      const tester = create({ step: 'schedule', workflowManifest: presetManifest });
      await tester.name.fill('Reactor discovery');

      await tester.goToStep('review');

      await expect
        .element(tester.root.getByCss('#review-errors'))
        .toMatchTextContent('This name is already used by another synchronisation');
    });

    test('should list the missing query of a SQL-family connector among the errors', async () => {
      const tester = create({ step: 'schedule', workflowManifest: sqlManifest });
      await tester.name.fill('Metadata');

      await tester.goToStep('review');

      await expect.element(tester.root.getByCss('#review-errors')).toMatchTextContent('A metadata query is required');
      await tester.root.getByCss('#review-errors .review-error button').click();
      await expect.element(tester.stepButton('source')).toHaveAttribute('aria-current', 'step');
    });

    test('should show why a preview failed', async () => {
      configurationWorkflowService.previewCommand.mockReturnValue(throwError(() => new Error('unreachable')));
      const tester = create({ mode: 'edit' });

      await tester.goToStep('filter');

      await expect.element(tester.root.getByCss('#filter-preview-error')).toHaveTextContent('unreachable');
    });
  });

  describe('schedule', () => {
    beforeEach(() => {
      startStep = 'schedule';
    });

    test('should not offer the subscription, which is the schedule of items only', async () => {
      const subscription: (typeof scanModes)[number] = { ...scanModes[0], id: 'subscription', name: 'Subscription' };
      scanModes.push(subscription);
      try {
        const tester = create();

        await expect.element(tester.scanMode.getByRole('option', { name: scanModes[0].name })).toBeInTheDocument();
        await expect.element(tester.scanMode.getByRole('option', { name: 'Subscription' })).not.toBeInTheDocument();
      } finally {
        scanModes.pop();
      }
    });

    test('should only offer to enable a workflow that has a schedule', async () => {
      // a new workflow runs on demand only, until a schedule is picked
      const tester = create();
      await expect.element(tester.enabledSwitch).not.toBeInTheDocument();

      await tester.scanMode.selectOptions(scanModes[0].name);
      await expect.element(tester.enabledSwitch).toBeInTheDocument();

      await tester.scanMode.selectOptions('Manual only');
      await expect.element(tester.enabledSwitch).not.toBeInTheDocument();
    });

    test('should have no switch for a workflow edited with no schedule', async () => {
      const tester = create({ mode: 'edit', workflow: { ...existingWorkflow, scanModeId: null } });

      await expect.element(tester.enabledSwitch).not.toBeInTheDocument();
    });
  });

  describe('discovery defaults', () => {
    beforeEach(() => {
      startStep = 'items';
    });

    test('should start a new workflow from the connector defaults', async () => {
      const tester = create({ workflowManifest: presetManifest });

      await expect.element(tester.mappingField('name')).toHaveValue('{{path}}');
      await expect.element(tester.identityKeyFields).toHaveTextContent('id');
      await expect.element(tester.mappingField('settings.mode')).toHaveDisplayValue('DA');
    });

    test('should start a new workflow with its items enabled, and keep the mapping of an edited one', async () => {
      const created = create();
      await expect.element(created.mappingField('enabled')).toHaveDisplayValue('Yes');

      const edited = create({ mode: 'edit', workflow: { ...existingWorkflow, itemFieldMapping: { name: '{{name}}' } } });
      await expect.element(edited.mappingField('enabled')).toHaveDisplayValue('Not mapped');
    });

    test('should start a new workflow with the history settings of the item modal', async () => {
      const tester = create();

      await expect.element(tester.mappingField('maxReadInterval')).toHaveValue('3600');
      await expect.element(tester.mappingField('readDelay')).toHaveValue('200');
      await expect.element(tester.mappingField('recoveryStrategy')).toHaveDisplayValue('From oldest to newest');
      await expect.element(tester.mappingField('emptyIntervalStrategy')).toHaveDisplayValue('Keep the tracked instant');
      await expect.element(tester.mappingField('startTimeOffset')).toHaveValue('0');
      await expect.element(tester.mappingField('endTimeOffset')).toHaveValue('0');
    });

    test('should keep the mapping of an edited workflow rather than the defaults', async () => {
      const workflow = { ...existingWorkflow, identityKeyFields: ['nodeId'], itemFieldMapping: { name: '{{name}}' } };
      const tester = create({ mode: 'edit', workflow, workflowManifest: presetManifest });

      await expect.element(tester.mappingField('name')).toHaveValue('{{name}}');
      await expect.element(tester.identityKeyFields).toHaveTextContent('nodeId');
      await expect.element(tester.mappingField('maxReadInterval')).toHaveValue('');
    });

    test('should say an identity key field is missing, on the Items step', async () => {
      const tester = create({ workflowManifest: presetManifest, step: 'schedule' });
      await tester.name.fill('Reactor');
      await tester.goToStep('items');
      await tester.root.getByCss('.remove-identity-key-field').click();

      await tester.save();

      await expect.element(tester.formError).toMatchTextContent('At least one identity key field is required');
      await expect.element(tester.stepButton('items')).toHaveAttribute('aria-current', 'step');
    });
  });

  describe('groups', () => {
    beforeEach(() => {
      startStep = 'items';
    });

    test("should map the group field to one of the connector's own groups, through a dropdown", async () => {
      const tester = create({ mode: 'edit' });
      await expect.element(tester.groupToggle).toHaveRole('button');
      await expect.element(tester.groupToggle).toHaveTextContent('None');

      await tester.selectGroup('Group 1');
      await expect.element(tester.groupToggle).toHaveTextContent('Group 1');
      // the schedule is the one of the group: scanModeId is no longer mandatory, nor shown
      await expect.element(tester.mappingField('scanModeId')).not.toBeInTheDocument();
      await tester.save();
      // as in the item modal, an item that gets a group follows it
      expect(savedCommand().itemFieldMapping).toEqual({ name: '{{name}}', enabled: 'true', groupId: 'group1', syncWithGroup: 'true' });

      await tester.goToStep('items');
      await tester.selectGroup('None');
      await expect.element(tester.groupToggle).toHaveTextContent('None');
    });

    test('should show the item-owned historian fields and hide syncWithGroup while the item is not mapped into a group', async () => {
      const tester = create();

      for (const path of [
        'maxReadInterval',
        'readDelay',
        'startTimeOffset',
        'endTimeOffset',
        'recoveryStrategy',
        'emptyIntervalStrategy'
      ]) {
        await expect.element(tester.mappingField(path)).toBeInTheDocument();
      }
      await expect.element(tester.mappingField('syncWithGroup')).not.toBeInTheDocument();
    });

    test('should follow the group by default, hiding the item-owned historian fields and the schedule', async () => {
      const tester = create();

      await tester.selectGroup('Group 1');

      await expect.element(tester.mappingField('syncWithGroup')).toHaveDisplayValue('Yes');
      for (const path of [
        'maxReadInterval',
        'readDelay',
        'startTimeOffset',
        'endTimeOffset',
        'recoveryStrategy',
        'emptyIntervalStrategy',
        'scanModeId'
      ]) {
        await expect.element(tester.mappingField(path)).not.toBeInTheDocument();
      }
      await expect.element(tester.root.getByCss('#group-scan-mode')).toMatchTextContent('(from the group)');
    });

    test('should show the item-owned historian fields once the item is not synced with its group', async () => {
      const tester = create();
      await tester.selectGroup('Group 1');

      await tester.mappingField('syncWithGroup').selectOptions('No');

      for (const path of [
        'maxReadInterval',
        'readDelay',
        'startTimeOffset',
        'endTimeOffset',
        'recoveryStrategy',
        'emptyIntervalStrategy'
      ]) {
        await expect.element(tester.mappingField(path)).toBeInTheDocument();
      }
      // the schedule is still the one of the group
      await expect.element(tester.mappingField('scanModeId')).not.toBeInTheDocument();

      await tester.mappingField('syncWithGroup').selectOptions('Yes');
      await expect.element(tester.mappingField('maxReadInterval')).not.toBeInTheDocument();
    });

    test('should create a group through the groups of the page and map it', async () => {
      const tester = create({ directSave: false });
      const command = buildSouthItemGroupCommand(null, 'Group 2');
      const groupModal = createMock(EditSouthItemGroupModalComponent);
      modalService.mockClosedModal(groupModal, { mode: 'create', group: command });
      const listedGroups = groups.list();

      await tester.groupToggle.click();
      await tester.createGroupButton.click();

      expect(groupModal.directSave).toBe(false);
      expect(groupModal.prepareForCreation).toHaveBeenCalledWith(scanModes, listedGroups, manifest);
      expect(groups.save).toHaveBeenCalledWith({ mode: 'create', group: command });
      await expect.element(tester.groupToggle).toHaveTextContent('Group 2');
    });

    test('should edit a group and show its new name', async () => {
      const tester = create();
      await tester.selectGroup('Group 1');
      const editedGroup = groups.list()[0];
      const command = buildSouthItemGroupCommand('group1', 'Group 1 renamed');
      const groupModal = createMock(EditSouthItemGroupModalComponent);
      modalService.mockClosedModal(groupModal, { mode: 'edit', group: command });
      const listedGroups = groups.list();

      await tester.groupToggle.click();
      await tester.groupRowButton('Group 1', 'Edit group').click();

      expect(groupModal.prepareForEdition).toHaveBeenCalledWith(scanModes, listedGroups, manifest, editedGroup);
      expect(groups.save).toHaveBeenCalledWith({ mode: 'edit', group: command });
      await expect.element(tester.groupToggle).toHaveTextContent('Group 1 renamed');
    });

    test('should delete a group through the groups of the page and unmap it if it was selected', async () => {
      const tester = create();
      await tester.selectGroup('Group 1');
      const deletedGroup = groups.list()[0];

      await tester.groupToggle.click();
      await tester.groupRowButton('Group 1', 'Delete').click();

      expect(groups.delete).toHaveBeenCalledWith(deletedGroup);
      await expect.element(tester.groupToggle).toHaveTextContent('None');
      await expect.element(tester.groupOption('Group 1')).not.toBeInTheDocument();
    });
  });
  describe('explore wizard', () => {
    const exploreManifest: SouthConnectorManifest = {
      ...manifest,
      discovery: {
        kind: 'tree',
        recordFields: ['id', 'name', 'path'],
        defaults: { identityKeyFields: ['nodeId'], itemFieldMapping: { name: '{{name}}' } }
      }
    };
    const entries = [
      { id: 'ns=1;s=Reactor', name: 'Reactor', metadata: { type: 'Object' }, hasChildren: false },
      { id: 'ns=1;s=Boiler', name: 'Boiler', metadata: { type: 'Object' }, hasChildren: false }
    ];

    function discovered(name: string, regex: string): SouthConnectorItemCommandDTO {
      const command = testData.south.itemCommand;
      return { ...command, id: null, name, scanModeId: null, settings: { ...(command.settings as SouthFolderScannerItemSettings), regex } };
    }

    function explore(options: Partial<ExploreWizardOptions> = {}) {
      southConnectorService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries }));
      const tester = new EditWorkflowModalComponentTester();
      tester.fixture.componentInstance.prepareForExploration({
        southId,
        exploreConnectorId: southId,
        southSettings,
        manifest: exploreManifest,
        schedule: { scanModes, groups },
        existingItems: [],
        sync: { directSave: true, existingWorkflows: [] },
        ...options
      });
      return tester;
    }

    function closedWith(): unknown {
      return activeModal.close.mock.lastCall![0];
    }

    describe('Explore step', () => {
      test('should start on the explore tree of the data source, with nothing to do until a node is checked', async () => {
        const tester = explore();

        await expect.element(tester.title).toHaveTextContent('Explore data source');
        await expect.element(tester.exploreStep).toBeVisible();
        expect(southConnectorService.startExplore).toHaveBeenCalledWith(southId, southSettings, 'folder-scanner');
        await expect.element(tester.checkedCount).toHaveTextContent('0 selected');
        await expect.element(tester.flowActionButtons).toHaveLength(2);
        await expect.element(tester.keepInSyncButton).toBeDisabled();
        await expect.element(tester.addAsItemsButton).toBeDisabled();
        // there is only the Explore step until the nodes are used
        await expect.element(tester.stepButton('explore')).not.toBeInTheDocument();
      });

      test('should explore the settings of a history query through its own endpoints, and only offer to add items', async () => {
        const api = {
          start: vi.fn(() => of({ sessionId: 'historySession', entries })),
          browse: vi.fn(),
          close: vi.fn(() => of(undefined))
        };
        const tester = explore({ exploreApi: api, exploreConnectorId: null, schedule: undefined, sync: undefined });

        await expect.element(tester.exploreStep).toBeVisible();
        expect(api.start).toHaveBeenCalledWith(southSettings, 'folder-scanner');
        expect(southConnectorService.startExplore).not.toHaveBeenCalled();
        await expect.element(tester.flowActionButtons).toHaveLength(1);
        await expect.element(tester.addAsItemsButton).toBeInTheDocument();
        await expect.element(tester.keepInSyncButton).not.toBeInTheDocument();
      });

      test('should only offer to keep in sync with tree-based discovery, and to add items with discovery defaults', async () => {
        const tester = explore({ manifest: { ...exploreManifest, discovery: { kind: 'tree' } } });

        await expect.element(tester.flowActionButtons).toHaveLength(1);
        await expect.element(tester.keepInSyncButton).toBeInTheDocument();
      });

      test('should close on the close button', async () => {
        const tester = explore();

        await tester.closeButton.click();

        expect(activeModal.dismiss).toHaveBeenCalled();
      });

      test('should not save when the form is submitted from the Explore step', () => {
        const tester = explore();

        tester.fixture.componentInstance.save();

        expect(activeModal.close).not.toHaveBeenCalled();
      });
    });

    describe('existing synchronisations', () => {
      // complete workflows, which can be saved as they are
      const mapping = { identityKeyFields: ['id'], itemFieldMapping: { name: '{{name}}', enabled: 'true', scanModeId: scanModes[0].id } };
      const reactorSync = buildWorkflowCommand('workflow1', 'Reactor sync', {
        ...mapping,
        discoveryScope: { nodeIds: ['ns=1;s=Reactor'] },
        scanModeId: scanModes[0].id
      });
      const everything = buildWorkflowCommand('workflow2', 'Everything', { ...mapping, discoveryScope: {} });
      const tables = buildWorkflowCommand('workflow3', 'Tables', { discoveryScope: { query: 'SELECT 1' } });
      const existingWorkflows = [reactorSync, everything, tables];

      function exploreWith(options: Partial<ExploreWizardOptions> = {}) {
        return explore({ sync: { directSave: true, existingWorkflows }, ...options });
      }

      test('should say which synchronisations already keep nodes in sync, and mark their nodes in the tree', async () => {
        const tester = exploreWith();

        const chips = tester.root.getByCss('#explore-coverage .explore-coverage-chip');
        await expect.element(chips).toHaveLength(2);
        await expect.element(chips.nth(0)).toMatchTextContent('Reactor sync (1)');
        await expect.element(chips.nth(1)).toMatchTextContent('Everything (whole data source)');
        // a synchronisation of the whole data source marks no node, and one of a query has none to mark
        const badges = tester.root.getByCss('.explore-node .explore-badge');
        await expect.element(badges).toHaveLength(1);
        await expect
          .element(tester.root.getByCss('.explore-node').filter({ hasText: 'Reactor' }).getByCss('.explore-badge'))
          .toHaveTextContent('Reactor sync');
      });

      test('should show nothing of the sort when the connector has no synchronisation', async () => {
        const tester = exploreWith({ sync: { directSave: true, existingWorkflows: [] } });

        await expect.element(tester.exploreStep).toBeVisible();
        await expect.element(tester.root.getByCss('#explore-coverage')).not.toBeInTheDocument();
        await expect.element(tester.root.getByCss('.explore-badge')).not.toBeInTheDocument();
      });

      test('should only offer to go on with a new synchronisation when opened from the New button', async () => {
        const tester = exploreWith({ syncOnly: true });

        await expect.element(tester.flowActionButtons).toHaveLength(1);
        await expect.element(tester.keepInSyncButton).not.toBeInTheDocument();
        // the steps of the synchronisation are there from the start
        await expect.element(tester.stepButton('filter')).toBeInTheDocument();
        await expect.element(tester.stepButton('review')).toBeInTheDocument();
        await tester.exploreCheck('Boiler').click();

        await tester.root.getByRole('button', { name: 'Next' }).click();

        await expect.element(tester.stepButton('filter')).toHaveAttribute('aria-current', 'step');
        await expect.element(tester.discoveryNodes).toMatchTextContent('ns=1;s=Boiler');
      });

      test('should edit a synchronisation from the Explore step, with its nodes checked', async () => {
        const tester = exploreWith({ workflow: { command: reactorSync, mode: 'edit' } });

        await expect.element(tester.exploreStep).toBeVisible();
        await expect.element(tester.checkedCount).toHaveTextContent('1 selected');
        await expect.element(tester.stepButton('review')).toBeInTheDocument();
        // the synchronisation being edited is not one that already covers its own nodes
        await expect.element(tester.root.getByCss('.explore-node .explore-badge')).not.toBeInTheDocument();

        await tester.root.getByRole('button', { name: 'Next' }).click();
        await tester.goToStep('schedule');
        await expect.element(tester.name).toHaveValue('Reactor sync');
      });

      test('should save the edited synchronisation under its id, with the nodes checked', async () => {
        const tester = exploreWith({ workflow: { command: reactorSync, mode: 'edit' } });
        await tester.exploreCheck('Boiler').click();
        await tester.root.getByRole('button', { name: 'Next' }).click();

        await tester.saveButton.click();

        expect(closedWith()).toEqual({
          kind: 'workflow',
          command: expect.objectContaining({
            id: 'workflow1',
            name: 'Reactor sync',
            discoveryScope: { nodeIds: ['ns=1;s=Reactor', 'ns=1;s=Boiler'] }
          })
        });
      });

      test('should duplicate a synchronisation as a new one, with its nodes checked', async () => {
        const tester = exploreWith({ workflow: { command: reactorSync, mode: 'copy' } });

        await expect.element(tester.checkedCount).toHaveTextContent('1 selected');
        // a duplicate has no target to choose
        await expect.element(tester.root.getByCss('#sync-target')).not.toBeInTheDocument();
        await tester.root.getByRole('button', { name: 'Next' }).click();

        await tester.goToStep('schedule');
        await expect.element(tester.name).toHaveValue('Reactor sync-copy');
        await tester.save();
        expect(closedWith()).toEqual({ kind: 'workflow', command: expect.objectContaining({ id: null, name: 'Reactor sync-copy' }) });
      });

      test('should warn, in the Explore step, when nodes are removed from the synchronisation', async () => {
        const tester = exploreWith({ workflow: { command: reactorSync, mode: 'edit' } });
        await expect.element(tester.root.getByCss('#sync-target-removed')).not.toBeInTheDocument();

        await tester.exploreCheck('Reactor').click();

        await expect.element(tester.root.getByCss('#sync-target-removed')).toMatchTextContent('1 node(s) removed from the synchronisation');
      });

      describe('target', () => {
        /** The target is picked in the Explore step, where the nodes are checked: the action comes after */
        async function checkBoiler(tester: EditWorkflowModalComponentTester) {
          await tester.exploreCheck('Boiler').click();
        }

        test('should offer a new synchronisation, or the ones that discover from nodes, to add the nodes to', async () => {
          const tester = exploreWith();

          await checkBoiler(tester);

          await expect.element(tester.root.getByCss('#sync-target-new')).toBeChecked();
          const existing = tester.root.getByCss('.sync-target-existing');
          await expect.element(existing).toHaveLength(2);
          await expect.element(tester.root.getByCss('#sync-target')).toMatchTextContent('Add the selected nodes to Reactor sync');
          await expect.element(tester.root.getByCss('#sync-target')).toMatchTextContent('Already covers the whole data source');
          await expect.element(tester.root.getByCss('#sync-target')).not.toMatchTextContent('Tables');
        });

        test('should add the nodes checked to an existing synchronisation, which then has its own settings', async () => {
          const tester = exploreWith();
          await checkBoiler(tester);

          await tester.root.getByCss('#sync-target-workflow1').click();

          // the tree has the nodes of the synchronisation too, and it no longer marks its own nodes
          await expect.element(tester.checkedCount).toHaveTextContent('2 selected');
          await expect.element(tester.root.getByCss('#sync-target-added')).toMatchTextContent('+ ns=1;s=Boiler');
          await expect.element(tester.root.getByCss('.explore-node .explore-badge')).not.toBeInTheDocument();

          await tester.keepInSyncButton.click();
          await expect.element(tester.discoveryNodes).toMatchTextContent('ns=1;s=Reactor');
          await expect.element(tester.discoveryNodes).toMatchTextContent('ns=1;s=Boiler');
          await tester.goToStep('schedule');
          await expect.element(tester.name).toHaveValue('Reactor sync');
          await tester.saveButton.click();
          expect(closedWith()).toEqual({
            kind: 'workflow',
            command: expect.objectContaining({
              id: 'workflow1',
              scanModeId: scanModes[0].id,
              discoveryScope: { nodeIds: ['ns=1;s=Reactor', 'ns=1;s=Boiler'] }
            })
          });
        });

        test('should leave a synchronisation of the whole data source as it is', async () => {
          const tester = exploreWith();
          await checkBoiler(tester);

          await tester.root.getByCss('#sync-target-workflow2').click();
          await tester.keepInSyncButton.click();

          await tester.goToStep('schedule');
          await tester.saveButton.click();
          expect(closedWith()).toEqual({
            kind: 'workflow',
            command: expect.objectContaining({ id: 'workflow2', discoveryScope: {} })
          });
        });

        test('should go back to a new synchronisation of the nodes checked', async () => {
          const tester = exploreWith();
          await checkBoiler(tester);
          await tester.root.getByCss('#sync-target-workflow1').click();

          await tester.root.getByCss('#sync-target-new').click();

          await expect.element(tester.root.getByCss('#sync-target-added')).not.toBeInTheDocument();
          await expect.element(tester.checkedCount).toHaveTextContent('1 selected');
          await tester.keepInSyncButton.click();
          await expect.element(tester.discoveryNodes).toMatchTextContent('ns=1;s=Boiler');
          await expect.element(tester.discoveryNodes).not.toMatchTextContent('ns=1;s=Reactor');
          await tester.goToStep('items');
          await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
          await tester.goToStep('schedule');
          await tester.name.fill('Boiler sync');
          await tester.save();
          expect(closedWith()).toEqual({
            kind: 'workflow',
            command: expect.objectContaining({ id: null, name: 'Boiler sync', discoveryScope: { nodeIds: ['ns=1;s=Boiler'] } })
          });
        });

        test('should not offer any target when no synchronisation discovers from nodes', async () => {
          const tester = exploreWith({ sync: { directSave: true, existingWorkflows: [tables] } });

          await checkBoiler(tester);

          await expect.element(tester.root.getByCss('#sync-target')).not.toBeInTheDocument();
        });

        test('should not offer any target to add items', async () => {
          const tester = exploreWith({
            manifest: { ...exploreManifest, discovery: { kind: 'query', defaults: exploreManifest.discovery!.defaults } }
          });

          await checkBoiler(tester);

          await expect.element(tester.root.getByCss('#sync-target')).not.toBeInTheDocument();
        });
      });

      test('should note the synchronisations that already keep the checked nodes in sync, when they are added as items', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = exploreWith();
        await tester.exploreCheck('Boiler').click();
        await tester.addAsItemsButton.click();

        // the synchronisation of the whole data source covers every node, the one of the Reactor does not
        const note = tester.root.getByCss('#items-covered-note');
        await expect.element(note).toMatchTextContent('Already kept in sync by Everything');
        await expect.element(note).not.toMatchTextContent('Reactor sync');

        await tester.goToStep('explore');
        await tester.exploreCheck('Reactor').click();
        await tester.addAsItemsButton.click();
        await expect.element(note).toMatchTextContent('Already kept in sync by Reactor sync, Everything');
      });

      test('should not note anything when no synchronisation covers the checked nodes', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = exploreWith({ sync: { directSave: true, existingWorkflows: [reactorSync] } });
        await tester.exploreCheck('Boiler').click();
        await tester.addAsItemsButton.click();

        await expect.element(tester.root.getByCss('#items-covered-note')).not.toBeInTheDocument();
      });
    });

    describe('SQL database', () => {
      const sqlExploreManifest: SouthConnectorManifest = {
        ...manifest,
        id: 'mysql',
        explore: true,
        discovery: {
          kind: 'query',
          defaults: { identityKeyFields: ['id'], itemFieldMapping: { name: '{{name}}', 'settings.query': '{{query}}' } }
        }
      };
      const tableSettings: SouthMySQLItemSettings = {
        query: 'SELECT * FROM measures JOIN tags ON 1 = 1 WHERE ts > @StartTime',
        requestTimeout: 1000,
        trackingInstant: null
      };
      const tableItem = (): SouthConnectorItemCommandDTO => ({ ...discovered('measures_tags', 'unused'), settings: tableSettings });

      function exploreSql(options: Partial<ExploreWizardOptions> = {}) {
        return explore({ manifest: sqlExploreManifest, ...options });
      }

      test('should offer to sync the metadata and to add in an item, the last one being the main action', async () => {
        const tester = exploreSql();

        await expect.element(tester.flowActionButtons).toHaveLength(2);
        await expect.element(tester.root.getByRole('button', { name: 'Metadata sync' })).toBeInTheDocument();
        await expect.element(tester.root.getByRole('button', { name: 'Add in an item' })).toHaveClass('btn-primary');
        await expect.element(tester.addAsItemsButton).not.toBeInTheDocument();
        await expect.element(tester.keepInSyncButton).not.toBeInTheDocument();
        // nothing to do with the synchronisations the connector already has
        await tester.exploreCheck('Reactor').click();
        await expect.element(tester.root.getByCss('#sync-target')).not.toBeInTheDocument();
      });

      test('should only offer to add in an item for the database of a history query, which has no synchronisation', async () => {
        const tester = exploreSql({ sync: undefined, schedule: undefined });

        await expect.element(tester.flowActionButtons).toHaveLength(1);
        await expect.element(tester.root.getByRole('button', { name: 'Add in an item' })).toBeInTheDocument();
      });

      test('should give the item of the tables checked, read together, to complete', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([tableItem()]));
        const tester = exploreSql();
        await expect.element(tester.root.getByRole('button', { name: 'Add in an item' })).toBeDisabled();
        await tester.exploreCheck('Reactor').click();
        await tester.exploreCheck('Boiler').click();

        await tester.root.getByRole('button', { name: 'Add in an item' }).click();

        // the tables are joined in one query: one item, whatever their number
        expect(southConnectorService.discoverItems).toHaveBeenCalledWith(
          southId,
          'mysql',
          southSettings,
          { nodeIds: ['ns=1;s=Reactor', 'ns=1;s=Boiler'], combine: true },
          { name: '{{name}}', 'settings.query': '{{query}}' }
        );
        expect(closedWith()).toEqual({ kind: 'item', command: tableItem() });
      });

      test('should discover through the history query for its database', async () => {
        const discover = vi.fn(() => of([tableItem()]));
        const tester = exploreSql({ sync: undefined, schedule: undefined, discover });
        await tester.exploreCheck('Reactor').click();

        await tester.root.getByRole('button', { name: 'Add in an item' }).click();

        expect(discover).toHaveBeenCalledWith(
          { nodeIds: ['ns=1;s=Reactor'], combine: true },
          expect.objectContaining({ name: '{{name}}' })
        );
        expect(southConnectorService.discoverItems).not.toHaveBeenCalled();
        expect(closedWith()).toEqual({ kind: 'item', command: tableItem() });
      });

      test('should start a metadata synchronisation from the query of the tables checked, with no item to map', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([tableItem()]));
        const tester = exploreSql();
        await tester.exploreCheck('Reactor').click();

        await tester.root.getByRole('button', { name: 'Metadata sync' }).click();

        // the query a metadata query runs as it is: the plain one, with no time range
        expect(southConnectorService.discoverItems).toHaveBeenCalledWith(
          southId,
          'mysql',
          southSettings,
          { nodeIds: ['ns=1;s=Reactor'], combine: true },
          { name: '{{name}}', 'settings.query': '{{plainQuery}}' }
        );
        for (const step of ['explore', 'source', 'filter', 'schedule', 'review'] as const) {
          await expect.element(tester.stepButton(step)).toBeInTheDocument();
        }
        await expect.element(tester.stepButton('items')).not.toBeInTheDocument();
        await expect.element(tester.stepButton('source')).toHaveAttribute('aria-current', 'step');
        await expect.element(tester.discoveryQueryInput).toMatchTextContent('SELECT * FROM measures JOIN tags');
        // named after the tables, until the user chooses
        await expect.element(tester.name).toHaveValue('measures_tags');
      });

      test('should keep the name already given to the synchronisation', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([tableItem()]));
        const tester = exploreSql();
        tester.fixture.componentInstance.form.controls.name.setValue('Tag list');
        await tester.exploreCheck('Reactor').click();

        await tester.root.getByRole('button', { name: 'Metadata sync' }).click();

        await expect.element(tester.name).toHaveValue('Tag list');
      });

      test('should say why the query could not be built, and stay on the Explore step', async () => {
        southConnectorService.discoverItems.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'unreachable' } })));
        const tester = exploreSql();
        await tester.exploreCheck('Reactor').click();

        await tester.root.getByRole('button', { name: 'Add in an item' }).click();

        await expect.element(tester.root.getByCss('#selection-error')).toMatchTextContent('unreachable');
        expect(activeModal.close).not.toHaveBeenCalled();
        await expect.element(tester.exploreStep).toBeVisible();
        await expect.element(tester.root.getByRole('button', { name: 'Add in an item' })).toBeEnabled();
      });

      test('should say when the tables checked have nothing to read', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = exploreSql();
        await tester.exploreCheck('Reactor').click();

        await tester.root.getByRole('button', { name: 'Metadata sync' }).click();

        await expect.element(tester.root.getByCss('#selection-none')).toMatchTextContent('have nothing to read');
        await expect.element(tester.stepButton('source')).not.toBeInTheDocument();
      });

      test('should only browse the database when read-only: nothing to check, nothing to do with it', async () => {
        const tester = exploreSql({ readOnly: true });

        await expect.element(tester.exploreStep).toBeVisible();
        await expect.element(tester.root.getByCss('#step-explore .explore-node')).toHaveLength(2);
        await expect.element(tester.root.getByCss('#step-explore .explore-check')).not.toBeInTheDocument();
        await expect.element(tester.flowActionButtons).not.toBeInTheDocument();
        await expect.element(tester.checkedCount).not.toBeInTheDocument();
        await tester.closeButton.click();
        expect(activeModal.dismiss).toHaveBeenCalled();
      });
    });

    describe('Keep in sync', () => {
      async function keepInSync(tester: EditWorkflowModalComponentTester) {
        await tester.exploreCheck('Reactor').click();
        await tester.keepInSyncButton.click();
      }

      test('should go on with the workflow steps, after the Explore one, on the nodes checked', async () => {
        const tester = explore();
        await tester.exploreCheck('Reactor').click();
        await expect.element(tester.checkedCount).toHaveTextContent('1 selected');

        await tester.keepInSyncButton.click();

        // no Source step: the nodes are the ones of the Explore step
        for (const step of ['explore', 'filter', 'items', 'schedule', 'review'] as const) {
          await expect.element(tester.stepButton(step)).toBeInTheDocument();
        }
        await expect.element(tester.stepButton('source')).not.toBeInTheDocument();
        await expect.element(tester.stepButton('filter')).toHaveAttribute('aria-current', 'step');
        // the Filter step reminds them
        await expect.element(tester.discoveryNodes).toHaveTextContent('ns=1;s=Reactor');
        // nothing is created until the workflow is saved
        expect(southConnectorService.discoverItems).not.toHaveBeenCalled();
      });

      test('should come back to the Explore step to change the nodes, keeping what was checked', async () => {
        const tester = explore();
        await keepInSync(tester);
        // changing nodes is the action of the Explore step: the Filter step has no button for it
        await expect.element(tester.root.getByRole('button', { name: /nodes/i })).not.toBeInTheDocument();

        await tester.goToStep('explore');

        await expect.element(tester.exploreStep).toBeVisible();
        await expect.element(tester.checkedCount).toHaveTextContent('1 selected');
        await tester.exploreCheck('Boiler').click();
        await tester.keepInSyncButton.click();
        await expect.element(tester.discoveryNodes).toMatchTextContent('ns=1;s=Reactor');
        await expect.element(tester.discoveryNodes).toMatchTextContent('ns=1;s=Boiler');
      });

      test('should go back to the Explore step from the first workflow step', async () => {
        const tester = explore();
        await keepInSync(tester);

        await tester.backButton.click();

        await expect.element(tester.exploreStep).toBeVisible();
      });

      test('should close with the workflow, which discovers from the nodes checked', async () => {
        const tester = explore();
        await keepInSync(tester);
        await tester.goToStep('items');
        await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
        await tester.goToStep('schedule');
        await tester.name.fill('Reactor sync');

        await tester.save();

        expect(closedWith()).toEqual({
          kind: 'workflow',
          command: expect.objectContaining({
            id: null,
            name: 'Reactor sync',
            discoveryScope: { nodeIds: ['ns=1;s=Reactor'] },
            identityKeyFields: ['nodeId'],
            itemFieldMapping: { name: '{{name}}', scanModeId: scanModes[0].id, ...historyDefaults }
          })
        });
      });
    });

    describe('Add as items', () => {
      async function addAsItems(tester: EditWorkflowModalComponentTester) {
        await tester.exploreCheck('Reactor').click();
        await tester.addAsItemsButton.click();
      }

      test('should list the items of the nodes checked, mapped with the discovery defaults', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([discovered('Reactor/a', 'a.csv'), discovered('Reactor/b', 'b.csv')]));
        const tester = explore();

        await addAsItems(tester);
        await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

        await expect.element(tester.stepButton('add-items')).toHaveAttribute('aria-current', 'step');
        await expect.element(tester.discoveredItemNames).toHaveLength(2);
        await expect.element(tester.discoveredItemNames.nth(0)).toHaveValue('Reactor/a');
        expect(southConnectorService.discoverItems).toHaveBeenLastCalledWith(
          southId,
          exploreManifest.id,
          southSettings,
          { nodeIds: ['ns=1;s=Reactor'] },
          { name: '{{name}}', scanModeId: scanModes[0].id, ...historyDefaults }
        );
      });

      test('should show the item mapping in the sections of the item modal, on the same step', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = explore();

        await addAsItems(tester);

        const sections = tester.root.getByCss('#step-add-items h5.oib-section-title');
        await expect.element(sections).toHaveLength(2);
        await expect.element(sections.nth(0)).toHaveTextContent('Name & schedule');
        const general = tester.root.getByCss('#item-field-mapping-general');
        for (const path of ['name', 'groupId', 'scanModeId', 'maxReadInterval', 'readDelay', 'recoveryStrategy', 'startTimeOffset']) {
          await expect.element(general.getByCss(`[id="item-field-mapping-field-${path}"]`)).toBeInTheDocument();
        }
        await expect
          .element(tester.root.getByCss('#item-field-mapping-settings').getByCss('[id="item-field-mapping-field-settings.objectArray"]'))
          .toBeInTheDocument();
        // nothing is folded away, and what only a workflow needs is not there
        await expect.element(tester.remoteMode).not.toBeVisible();
      });

      test('should start with the history settings of the item modal', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = explore();

        await addAsItems(tester);

        await expect.element(tester.mappingField('maxReadInterval')).toHaveValue('3600');
        await expect.element(tester.mappingField('readDelay')).toHaveValue('200');
        await expect.element(tester.mappingField('recoveryStrategy')).toHaveDisplayValue('From oldest to newest');
        await expect.element(tester.mappingField('startTimeOffset')).toHaveValue('0');
        await expect.element(tester.mappingField('endTimeOffset')).toHaveValue('0');
      });

      test('should start a synchronisation with the same history settings', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = explore();
        await addAsItems(tester);
        await tester.mappingField('readDelay').fill('500');

        await tester.goToStep('explore');
        await tester.keepInSyncButton.click();
        await tester.goToStep('items');

        // the mapping is the same one
        await expect.element(tester.mappingField('maxReadInterval')).toHaveValue('3600');
        await expect.element(tester.mappingField('readDelay')).toHaveValue('500');
      });

      test('should follow the group of the item, hiding the schedule and the history settings, as the item modal does', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = explore();
        await addAsItems(tester);
        await expect.element(tester.mappingField('syncWithGroup')).not.toBeInTheDocument();
        await expect.element(tester.mappingField('scanModeId')).toBeInTheDocument();

        await tester.selectGroup('Group 1');

        await expect.element(tester.mappingField('scanModeId')).not.toBeInTheDocument();
        await expect.element(tester.root.getByCss('#group-scan-mode')).toMatchTextContent('(from the group)');
        await expect.element(tester.mappingField('syncWithGroup')).toHaveDisplayValue('Yes');
        await expect.element(tester.mappingField('maxReadInterval')).not.toBeInTheDocument();
        await expect.element(tester.mappingField('readDelay')).not.toBeInTheDocument();

        // the item can have its own history settings in its group
        await tester.mappingField('syncWithGroup').selectOptions('No');
        await expect.element(tester.mappingField('maxReadInterval')).toBeInTheDocument();
        await expect.element(tester.mappingField('scanModeId')).not.toBeInTheDocument();

        await tester.selectGroup('None');
        await expect.element(tester.mappingField('syncWithGroup')).not.toBeInTheDocument();
        await expect.element(tester.mappingField('scanModeId')).toBeInTheDocument();
        await expect.element(tester.mappingField('maxReadInterval')).toBeInTheDocument();
      });

      test('should list the fields of the discovered records, as the connector tells them', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = explore();

        await addAsItems(tester);

        const fields = tester.root.getByCss('#available-record-fields .record-field');
        await expect.element(fields).toHaveLength(3);
        await expect.element(fields.nth(0)).toHaveTextContent('{{id}}');
        await expect.element(fields.nth(2)).toHaveTextContent('{{path}}');
        // not when the connector tells nothing
        const without = explore({
          manifest: { ...exploreManifest, discovery: { kind: 'tree', defaults: exploreManifest.discovery!.defaults } }
        });
        await addAsItems(without);
        await expect.element(without.root.getByCss('#available-record-fields')).not.toBeInTheDocument();
      });

      test('should put a field where the user was typing, after the previous one', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = explore();
        await addAsItems(tester);
        await tester.mappingField('name').fill('item-');

        await tester.root.getByCss('.record-field').nth(2).click();
        await tester.root.getByCss('.record-field').nth(0).click();

        await expect.element(tester.mappingField('name')).toHaveValue('item-{{path}}{{id}}');
        expect(clipboard.copy).not.toHaveBeenCalled();
      });

      test('should copy a field when the user was not typing in an input that takes it', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = explore();
        await addAsItems(tester);

        // nothing focused yet
        await tester.root.getByCss('.record-field').nth(1).click();
        expect(clipboard.copy).toHaveBeenLastCalledWith('{{name}}');
        expect(notificationService.success).toHaveBeenCalledWith('south.explore.copied');

        // a field that only takes a constant
        await tester.mappingField('readDelay').fill('5');
        await tester.root.getByCss('.record-field').nth(0).click();
        expect(clipboard.copy).toHaveBeenLastCalledWith('{{id}}');
        await expect.element(tester.mappingField('readDelay')).toHaveValue('5');

        // a select, which only takes a constant until it is on an expression
        tester.mappingField('recoveryStrategy').element().focus();
        await tester.root.getByCss('.record-field').nth(0).click();
        expect(clipboard.copy).toHaveBeenCalledTimes(3);
      });

      test('should list the fields in the Items step of a synchronisation too', async () => {
        const tester = explore();
        await tester.exploreCheck('Reactor').click();
        await tester.keepInSyncButton.click();
        await tester.goToStep('items');

        await expect.element(tester.root.getByCss('#available-record-fields .record-field')).toHaveLength(3);
      });

      test('should say what is missing in the mapping, instead of discovering', async () => {
        const tester = explore();

        await addAsItems(tester);

        await expect.element(tester.discoveredItemsIncomplete).toMatchTextContent('Every mandatory field');
        expect(southConnectorService.discoverItems).not.toHaveBeenCalled();
        await expect.element(tester.refreshItemsButton).toBeDisabled();
        await expect.element(tester.addItemsButton).toBeDisabled();
      });

      test('should discover again once the mapping changed, refusing to add the items it gave until then', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([discovered('Reactor/a', 'a.csv')]));
        const tester = explore();
        await addAsItems(tester);
        await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
        await expect.element(tester.discoveredItemNames).toHaveLength(1);
        southConnectorService.discoverItems.mockClear();
        southConnectorService.discoverItems.mockReturnValue(of([discovered('Boiler/a', 'a.csv')]));

        await tester.mappingField('name').fill('{{path}}');

        await expect.element(tester.discoveredItemsStale).toBeInTheDocument();
        await expect.element(tester.addItemsButton).toBeDisabled();
        await expect.element(tester.discoveredItemNames.nth(0)).toHaveValue('Boiler/a');
        expect(southConnectorService.discoverItems).toHaveBeenCalledTimes(1);
        await expect.element(tester.discoveredItemsStale).not.toBeInTheDocument();
        await expect.element(tester.addItemsButton).toBeEnabled();
      });

      test('should discover again on demand', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([discovered('Reactor/a', 'a.csv')]));
        const tester = explore();
        await addAsItems(tester);
        await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
        await expect.element(tester.discoveredItemNames).toHaveLength(1);
        southConnectorService.discoverItems.mockClear();

        await tester.refreshItemsButton.click();

        expect(southConnectorService.discoverItems).toHaveBeenCalledTimes(1);
      });

      test('should keep the review when coming back to the step with the same nodes and mapping', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([discovered('Reactor/a', 'a.csv'), discovered('Reactor/b', 'b.csv')]));
        const tester = explore();
        await addAsItems(tester);
        await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
        await expect.element(tester.discoveredItemNames).toHaveLength(2);
        await tester.discoveredItemNames.nth(0).fill('renamed');
        southConnectorService.discoverItems.mockClear();

        await tester.goToStep('explore');
        await tester.addAsItemsButton.click();

        await expect.element(tester.discoveredItemNames.nth(0)).toHaveValue('renamed');
        expect(southConnectorService.discoverItems).not.toHaveBeenCalled();
      });

      test('should discover again from the nodes when they changed', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([discovered('Reactor/a', 'a.csv')]));
        const tester = explore();
        await addAsItems(tester);
        await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
        await expect.element(tester.discoveredItemNames).toHaveLength(1);

        await tester.goToStep('explore');
        await tester.exploreCheck('Boiler').click();
        await tester.addAsItemsButton.click();

        await vi.waitFor(() =>
          expect(southConnectorService.discoverItems).toHaveBeenLastCalledWith(
            southId,
            exploreManifest.id,
            southSettings,
            { nodeIds: ['ns=1;s=Reactor', 'ns=1;s=Boiler'] },
            expect.anything()
          )
        );
      });

      test('should show why the discovery failed', async () => {
        southConnectorService.discoverItems.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'unreachable' } })));
        const tester = explore();

        await addAsItems(tester);
        await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

        await expect.element(tester.discoveredItemsError).toMatchTextContent(/unreachable$/);
        await expect.element(tester.addItemsButton).toBeDisabled();
      });

      test('should say when there is nothing to add', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = explore();

        await addAsItems(tester);
        await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

        await expect.element(tester.discoveredItemsEmpty).toMatchTextContent(/^Nothing to add/);
      });

      test('should ask for nodes when none is checked', async () => {
        const tester = explore();
        await tester.exploreCheck('Reactor').click();
        await tester.addAsItemsButton.click();
        await tester.goToStep('explore');
        await tester.exploreCheck('Reactor').click();

        await tester.goToStep('add-items');

        await expect.element(tester.discoveredItemsNoNode).toBeInTheDocument();
        expect(southConnectorService.discoverItems).not.toHaveBeenCalled();
      });

      test('should close with the items included, under the name given, with the schedule picked in the form', async () => {
        const scheduled = (name: string, regex: string) => ({ ...discovered(name, regex), scanModeId: scanModes[0].id });
        southConnectorService.discoverItems.mockReturnValue(of([scheduled('Reactor/a', 'a.csv'), scheduled('Reactor/b', 'b.csv')]));
        const tester = explore();
        await addAsItems(tester);
        await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
        await expect.element(tester.discoveredItemNames).toHaveLength(2);

        await tester.root.getByCss('.discovered-item-included').nth(0).click();
        await tester.discoveredItemNames.nth(1).fill('Reactor/b2');
        await expect.element(tester.addItemsButton).toHaveTextContent('Add items (1)');
        await tester.addItemsButton.click();

        expect(closedWith()).toEqual({
          kind: 'items',
          commands: [
            {
              ...scheduled('Reactor/b2', 'b.csv'),
              groupId: null,
              groupName: null,
              syncWithGroup: false,
              scanModeId: scanModes[0].id,
              scanModeName: scanModes[0].name
            }
          ]
        });
      });

      test('should have the items of a group follow its schedule', async () => {
        southConnectorService.discoverItems.mockReturnValue(
          of([{ ...discovered('Reactor/a', 'a.csv'), groupId: 'group1', syncWithGroup: true }])
        );
        const tester = explore();
        await addAsItems(tester);
        await tester.selectGroup('Group 1');

        await expect.element(tester.discoveredItemNames).toHaveLength(1);
        await tester.addItemsButton.click();

        expect(southConnectorService.discoverItems).toHaveBeenLastCalledWith(
          southId,
          exploreManifest.id,
          southSettings,
          expect.anything(),
          { name: '{{name}}', enabled: 'true', groupId: 'group1', syncWithGroup: 'true' }
        );
        expect(closedWith()).toEqual({
          kind: 'items',
          commands: [
            expect.objectContaining({ groupId: 'group1', groupName: 'Group 1', syncWithGroup: true, scanModeId: null, scanModeName: null })
          ]
        });
      });

      test('should give an item of a group its group schedule, even when it has its own history settings', async () => {
        southConnectorService.discoverItems.mockReturnValue(
          of([{ ...discovered('Reactor/a', 'a.csv'), groupId: 'group1', scanModeId: scanModes[0].id, syncWithGroup: false }])
        );
        const tester = explore();
        await addAsItems(tester);
        await tester.selectGroup('Group 1');
        await tester.mappingField('syncWithGroup').selectOptions('No');
        await expect.element(tester.discoveredItemNames).toHaveLength(1);

        await tester.addItemsButton.click();

        expect(closedWith()).toEqual({
          kind: 'items',
          commands: [expect.objectContaining({ groupId: 'group1', syncWithGroup: false, scanModeId: null, scanModeName: null })]
        });
      });

      test('should discover the items of a history query through it, with no schedule to give them', async () => {
        const discover = vi.fn(() => of([discovered('Reactor/a', 'a.csv')]));
        const tester = explore({ schedule: undefined, sync: undefined, discover });

        await addAsItems(tester);

        await expect.element(tester.discoveredItemNames).toHaveLength(1);
        expect(discover).toHaveBeenCalledWith({ nodeIds: ['ns=1;s=Reactor'] }, { name: '{{name}}', enabled: 'true' });
        expect(southConnectorService.discoverItems).not.toHaveBeenCalled();
        await expect.element(tester.mappingField('scanModeId')).not.toBeInTheDocument();
        await expect.element(tester.mappingField('groupId')).not.toBeInTheDocument();
        await expect.element(tester.mappingField('maxReadInterval')).not.toBeInTheDocument();
        await expect.element(tester.root.getByCss('#item-field-mapping-history')).not.toBeInTheDocument();
        await tester.addItemsButton.click();
        expect(closedWith()).toEqual({ kind: 'items', commands: [expect.objectContaining({ name: 'Reactor/a' })] });
      });

      test('should give the items of a connector that only subscribes the subscription, with nothing to pick', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([{ ...discovered('Reactor/a', 'a.csv'), scanModeId: 'subscription' }]));
        const subscriptionManifest: SouthConnectorManifest = {
          ...exploreManifest,
          items: {
            ...exploreManifest.items,
            rootAttribute: {
              ...exploreManifest.items.rootAttribute,
              attributes: exploreManifest.items.rootAttribute.attributes.map(attribute =>
                attribute.type === 'scan-mode' ? { ...attribute, acceptableType: 'SUBSCRIPTION' as const } : attribute
              )
            }
          }
        };
        const subscription: (typeof scanModes)[number] = { ...scanModes[0], id: 'subscription', name: 'Subscription' };
        const tester = explore({
          manifest: subscriptionManifest,
          schedule: { scanModes: [...scanModes, subscription], groups }
        });

        await addAsItems(tester);

        await expect.element(tester.discoveredItemNames).toHaveLength(1);
        await expect.element(tester.mappingField('scanModeId')).not.toBeInTheDocument();
        expect(southConnectorService.discoverItems).toHaveBeenLastCalledWith(
          southId,
          exploreManifest.id,
          southSettings,
          expect.anything(),
          { name: '{{name}}', scanModeId: 'subscription', ...historyDefaults }
        );
        await tester.addItemsButton.click();
        expect(closedWith()).toEqual({
          kind: 'items',
          commands: [expect.objectContaining({ scanModeId: 'subscription', scanModeName: 'Subscription' })]
        });
      });

      test('should not offer the subscription as a schedule to a connector that only polls', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const subscription: (typeof scanModes)[number] = { ...scanModes[0], id: 'subscription', name: 'Subscription' };
        const tester = explore({ schedule: { scanModes: [...scanModes, subscription], groups } });

        await addAsItems(tester);

        await expect.element(tester.mappingField('scanModeId')).toBeInTheDocument();
        await expect.element(tester.mappingField('scanModeId').getByRole('option', { name: 'Subscription' })).not.toBeInTheDocument();
        await expect.element(tester.mappingField('scanModeId').getByRole('option', { name: scanModes[0].name })).toBeInTheDocument();
      });

      test('should go back to the Explore step', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = explore();
        await addAsItems(tester);

        await tester.backButton.click();

        await expect.element(tester.exploreStep).toBeVisible();
        await expect.element(tester.nextButton).not.toBeInTheDocument();
      });

      test('should not submit anything from the Add as items step', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = explore();
        await addAsItems(tester);

        tester.fixture.componentInstance.save();
        tester.fixture.componentInstance.addItems();

        expect(activeModal.close).not.toHaveBeenCalled();
      });

      test('should change the flow when coming back to the Explore step', async () => {
        southConnectorService.discoverItems.mockReturnValue(of([]));
        const tester = explore();
        await addAsItems(tester);

        await tester.goToStep('explore');
        await tester.keepInSyncButton.click();

        await expect.element(tester.stepButton('filter')).toBeInTheDocument();
        await expect.element(tester.stepButton('add-items')).not.toBeInTheDocument();
        await expect.element(tester.discoveredItemsTable).not.toBeInTheDocument();
      });
    });
  });
});
