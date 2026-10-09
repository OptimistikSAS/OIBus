import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { ConfigurationWorkflowCommandDTO } from '@oibus/shared/api/configuration-workflow.model';
import { RegistrationSettingsDTO } from '@oibus/shared/api/engine.model';
import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';
import { OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup, buildSouthItemGroupCommand, buildWorkflowCommand } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { EngineService } from '../../../services/engine.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { MockModalService, provideModalTesting } from '../../../shared/mock-modal.service.testing';
import { SouthExploreModalComponent } from '../../../shared/south-explore-modal/south-explore-modal.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditSouthItemGroupModalComponent } from '../../south-items/edit-south-item-group-modal/edit-south-item-group-modal.component';
import EditWorkflowModalComponent from './edit-workflow-modal.component';

type AddOrEditGroup = (command: {
  mode: 'create' | 'edit';
  group: SouthItemGroupCommandDTO;
}) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
type DeleteGroup = (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>;

const scanModes = testData.scanMode.list;
const southId = 'southId1';
const southSettings = testData.south.list[0].settings;
// Real manifest fixture: modes.history is true, items.rootAttribute.attributes = [name, enabled, scanMode, settings{...}] -
// exercises both the manifest-driven fields and the historian fields added alongside them.
const manifest = testData.south.manifest;
// A SQL-family connector with no explore() (e.g. MSSQL) - query-only discovery scope, no reference tree.
const sqlManifest: SouthConnectorManifest = { ...manifest, id: 'mssql', explore: false };
// A SQL-family connector that also has explore() (SQLite, today the only one) - query editor plus the reference tree.
const sqliteManifest: SouthConnectorManifest = { ...manifest, id: 'sqlite', explore: true };
// Neither tree-based nor SQL-family.
const unsupportedManifest: SouthConnectorManifest = { ...manifest, id: 'mqtt', explore: false };
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

const existingWorkflow = buildWorkflowCommand('workflowId1', 'Reactor discovery', {
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  eligibilityFilter: [{ field: 'type', operator: 'equals', value: 'Variable' }],
  scanModeId: scanModes[0].id
});

const notRegistered: RegistrationSettingsDTO = { ...testData.oIAnalytics.registration.completed, status: 'NOT_REGISTERED' };
const registered: RegistrationSettingsDTO = { ...testData.oIAnalytics.registration.completed, status: 'REGISTERED' };

class EditWorkflowModalComponentTester {
  readonly fixture = TestBed.createComponent(EditWorkflowModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly name = this.root.getByCss('#workflow-name');
  readonly scanMode = this.root.getByCss('#workflow-scan-mode');
  readonly localMode = this.root.getByLabelText('Create/update items locally');
  readonly remoteMode = this.root.getByLabelText('Push to OIAnalytics');
  readonly notRegisteredWarning = this.root.getByCss('#mode-remote-not-registered');
  readonly sqlFixedMode = this.root.getByText('This connector only supports pushing to OIAnalytics', { exact: false });
  readonly formError = this.root.getByCss('#form-error');
  readonly mustBeUnique = this.root.getByText('Must be unique');
  // discovery scope
  readonly rootNodeId = this.root.getByCss('#discovery-root-node-id');
  readonly browseButton = this.root.getByRole('button', { name: 'Explore' });
  readonly clearRootNodeButton = this.root.getByRole('button', { name: 'Clear' });
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
  readonly mappingTable = this.root.getByCss('#item-field-mapping-table');
  readonly groupToggle = this.root.getByCss('#item-field-mapping-field-groupId');
  readonly createGroupButton = this.root.getByRole('button', { name: 'Create a new group...' });
  // footer
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly okButton = this.root.getByRole('button', { name: 'OK' });
  readonly cancelButton = this.root.getByCss('#cancel-button');

  mappingField(path: string) {
    return this.root.getByCss(`[id="item-field-mapping-field-${path}"]`);
  }

  mappingExpression(path: string) {
    return this.root.getByCss(`[id="item-field-mapping-field-${path}-expression"]`);
  }

  mappingRow(path: string) {
    return this.root.getByCss(`#item-field-mapping-table tr:has([id="item-field-mapping-field-${path}"])`);
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
}

describe('EditWorkflowModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let engineService: MockObject<EngineService>;
  let unsavedChangesService: MockObject<UnsavedChangesConfirmationService>;
  let modalService: MockModalService<unknown>;
  let groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
  let addOrEditGroup: Mock<AddOrEditGroup>;
  let deleteGroup: Mock<DeleteGroup>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    southConnectorService = createMock(SouthConnectorService);
    engineService = createMock(EngineService);
    unsavedChangesService = createMock(UnsavedChangesConfirmationService);
    groups = [buildSouthItemGroup('group1', 'Group 1')];
    addOrEditGroup = vi.fn<AddOrEditGroup>();
    deleteGroup = vi.fn<DeleteGroup>();
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
      directSave = true
    } = options;
    const tester = new EditWorkflowModalComponentTester();
    const component = tester.fixture.componentInstance;
    component.directSave = directSave;
    switch (mode) {
      case 'create':
        component.prepareForCreation(
          scanModes,
          existingWorkflows,
          workflowManifest,
          workflowSouthId,
          southSettings,
          groups,
          addOrEditGroup,
          deleteGroup
        );
        break;
      case 'edit':
        component.prepareForEdition(
          scanModes,
          existingWorkflows,
          workflowManifest,
          workflow,
          workflowSouthId,
          southSettings,
          groups,
          addOrEditGroup,
          deleteGroup
        );
        break;
      case 'copy':
        component.prepareForCopy(
          scanModes,
          existingWorkflows,
          workflowManifest,
          workflow,
          workflowSouthId,
          southSettings,
          groups,
          addOrEditGroup,
          deleteGroup
        );
        break;
    }
    return tester;
  }

  function savedCommand(): ConfigurationWorkflowCommandDTO {
    return activeModal.close.mock.lastCall![0];
  }

  describe('form', () => {
    test('should populate the form and dynamic lists in edit mode', async () => {
      const tester = create({ mode: 'edit' });

      await expect.element(tester.title).toHaveTextContent('Edit configuration workflow');
      await expect.element(tester.name).toHaveValue('Reactor discovery');
      await expect.element(tester.scanMode).toHaveDisplayValue(scanModes[0].name);
      await expect.element(tester.localMode).toBeChecked();
      await expect.element(tester.identityKeyFields).toHaveTextContent('nodeId');
      await expect.element(tester.eligibilityRows.first()).toMatchTextContent(/type\s*equals\s*Variable/);
      await expect.element(tester.mappingField('name')).toHaveValue('{{name}}');
      await expect.element(tester.rootNodeId).toHaveTextContent('ns=1;s=Root');
    });

    test('should render an empty form in create mode, defaulting to local (item-creating) mode', async () => {
      const tester = create();

      await expect.element(tester.title).toHaveTextContent('Create a new configuration workflow');
      await expect.element(tester.name).toHaveValue('');
      await expect.element(tester.localMode).toBeChecked();
      await expect.element(tester.identityKeyFields).toHaveTextContent('');
      await expect.element(tester.noEligibilityCondition).toBeInTheDocument();
      await expect.element(tester.mappingField('name')).toHaveValue('');
      await expect.element(tester.rootNodeId).toHaveTextContent('None - browse from the data source root');
    });

    test('should prefill a duplicate with the source workflow settings, a "-copy" name, and create-mode uniqueness', async () => {
      const tester = create({ mode: 'copy' });

      await expect.element(tester.title).toHaveTextContent('Duplicate configuration workflow');
      await expect.element(tester.name).toHaveValue('Reactor discovery-copy');
      await expect.element(tester.identityKeyFields).toHaveTextContent('nodeId');
      await expect.element(tester.mappingField('name')).toHaveValue('{{name}}');
      await expect.element(tester.rootNodeId).toHaveTextContent('ns=1;s=Root');

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
      await tester.saveButton.click();
      expect(activeModal.close).not.toHaveBeenCalled();
    });

    test("should keep the edited workflow's own id on save, whether persisted or an in-memory temp one", async () => {
      const inMemoryWorkflow = { ...existingWorkflow, id: 'temp_123' };
      const tester = create({ mode: 'edit', workflow: inMemoryWorkflow, existingWorkflows: [inMemoryWorkflow], workflowSouthId: 'create' });
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

      await tester.saveButton.click();

      expect(savedCommand()).toEqual(expect.objectContaining({ id: 'temp_123', name: 'Reactor discovery', scanModeId: scanModes[0].id }));
    });

    test('should save a duplicate with a null id, leaving the caller to decide what to give it', async () => {
      const tester = create({ mode: 'copy' });
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

      await tester.saveButton.click();

      expect(savedCommand()).toEqual(expect.objectContaining({ id: null, name: 'Reactor discovery-copy' }));
    });

    test('should label the confirm button "OK" rather than "Save" when the caller keeps workflows in memory', async () => {
      const tester = create({ directSave: false });

      await expect.element(tester.okButton).toBeInTheDocument();
    });

    test('should close the modal with a valid command when everything is filled in', async () => {
      const tester = create();
      const exploreModal = createMock(SouthExploreModalComponent);
      modalService.mockClosedModal(exploreModal, { id: 'ns=1;s=Root', name: 'Root', metadata: {}, hasChildren: true });
      await tester.name.fill('New workflow');
      await tester.browseButton.click();
      await tester.scanMode.selectOptions(scanModes[0].name);
      await tester.addIdentityKeyField('nodeId');
      await tester.mappingField('name').fill('{{name}}');
      // scanModeId is a manifest-REQUIRED item field - a constant only, never a {{ }} expression
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
      await tester.mappingField('maxReadInterval').fill('  '); // blank after trim -> not included

      await tester.saveButton.click();

      expect(activeModal.close).toHaveBeenCalledWith({
        id: null,
        name: 'New workflow',
        discoveryScope: { rootNodeId: 'ns=1;s=Root' },
        identityKeyFields: ['nodeId'],
        eligibilityFilter: [],
        itemFieldMapping: { name: '{{name}}', scanModeId: scanModes[0].id },
        pushToOIAnalytics: false,
        scanModeId: scanModes[0].id,
        enabled: true
      });
    });

    test('should not save without a name', async () => {
      const tester = create();

      await tester.saveButton.click();

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
    test('should pick a root node in the explore modal for a tree-based connector, then clear it', async () => {
      const tester = create();
      await expect.element(tester.browseButton).toBeInTheDocument();
      await expect.element(tester.discoveryQuery).not.toBeInTheDocument();
      await expect.element(tester.unsupportedScope).not.toBeInTheDocument();
      await expect.element(tester.clearRootNodeButton).not.toBeInTheDocument();
      const exploreModal = createMock(SouthExploreModalComponent);
      modalService.mockClosedModal(exploreModal, { id: 'ns=1;s=Reactor', name: 'Reactor', metadata: {}, hasChildren: true });
      const open = vi.spyOn(modalService, 'open');

      await tester.browseButton.click();

      expect(open).toHaveBeenCalledWith(SouthExploreModalComponent, { size: 'lg' });
      expect(exploreModal.prepare).toHaveBeenCalledWith(southId, southSettings, manifest.id, undefined, true);
      await expect.element(tester.rootNodeId).toHaveTextContent('ns=1;s=Reactor');

      await tester.clearRootNodeButton.click();
      await expect.element(tester.rootNodeId).toHaveTextContent('None - browse from the data source root');
    });

    test('should default a tree-based connector to an empty discoveryScope when no root node was picked', async () => {
      const tester = create({ mode: 'edit', workflow: { ...existingWorkflow, discoveryScope: {} } });
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

      await tester.saveButton.click();

      expect(savedCommand().discoveryScope).toEqual({});
    });

    test('should show a query-only editor, with no reference tree, for a SQL-family connector without explore()', async () => {
      const tester = create({ workflowManifest: sqlManifest });

      await expect.element(tester.discoveryQuery).toBeInTheDocument();
      await expect.element(tester.browseButton).not.toBeInTheDocument();
      await expect.element(tester.exploreTree).not.toBeInTheDocument();
      await expect.element(tester.unsupportedScope).not.toBeInTheDocument();
    });

    test('should show the reference explore tree above the query editor for SQLite', async () => {
      const tester = create({ workflowManifest: sqliteManifest });

      await expect.element(tester.exploreTree).toBeInTheDocument();
      await expect.element(tester.discoveryQuery).toBeInTheDocument();
      expect(southConnectorService.startExplore).toHaveBeenCalled();
    });

    test('should show an unsupported-connector message when the connector is neither tree-based nor SQL-family', async () => {
      const tester = create({ workflowManifest: unsupportedManifest });

      await expect.element(tester.unsupportedScope).toBeInTheDocument();
      await expect.element(tester.browseButton).not.toBeInTheDocument();
      await expect.element(tester.discoveryQuery).not.toBeInTheDocument();
    });

    test('should test the discovery query as currently typed and show the raw rows', async () => {
      const tester = create({ workflowManifest: sqlManifest, workflowSouthId: 'create' });
      await expect.element(tester.testQueryButton).toBeDisabled();
      southConnectorService.testDiscoveryQuery.mockReturnValue(of([{ name: 'sensor1', unit: 'C' }]));

      await tester.discoveryQueryInput.fill('SELECT name, unit FROM metadata');
      await tester.testQueryButton.click();

      expect(southConnectorService.testDiscoveryQuery).toHaveBeenCalledWith(
        'create',
        'mssql',
        southSettings,
        'SELECT name, unit FROM metadata'
      );
      await expect.element(tester.queryTestResult).toMatchTextContent('sensor1');
      await expect.element(tester.queryTestError).not.toBeInTheDocument();
    });

    test('should show an error when the discovery query test fails', async () => {
      const tester = create({ workflowManifest: sqlManifest });
      southConnectorService.testDiscoveryQuery.mockReturnValue(throwError(() => ({ error: { message: 'no such table: nope' } })));

      await tester.discoveryQueryInput.fill('SELECT * FROM nope');
      await tester.testQueryButton.click();

      await expect.element(tester.queryTestError).toHaveTextContent('no such table: nope');
      await expect.element(tester.queryTestResult).not.toBeInTheDocument();
      await expect.element(tester.testQueryButton).toBeEnabled();
    });

    test('should read discoveryScope.query back for a SQL-family workflow being edited', async () => {
      const sqlWorkflow = { ...existingWorkflow, discoveryScope: { query: 'SELECT 1' }, pushToOIAnalytics: true };
      const tester = create({ mode: 'edit', workflow: sqlWorkflow, existingWorkflows: [sqlWorkflow], workflowManifest: sqlManifest });

      await expect.element(tester.discoveryQueryInput).toHaveTextContent('SELECT 1');
      await expect.element(tester.testQueryButton).toBeEnabled();
    });

    test('should force "Push to OIAnalytics" and hide the mode picker and item field mapping for a SQL-family connector', async () => {
      const tester = create({ workflowManifest: sqlManifest });

      await expect.element(tester.sqlFixedMode).toBeInTheDocument();
      await expect.element(tester.localMode).not.toBeInTheDocument();
      await expect.element(tester.remoteMode).not.toBeInTheDocument();
      await expect.element(tester.mappingTable).not.toBeInTheDocument();
      await expect.element(tester.identityKeyFields).not.toBeInTheDocument();
      await expect.element(tester.notRegisteredWarning).toBeInTheDocument();
    });

    test("should reject saving when a SQL connector's metadata query is blank", async () => {
      const tester = create({ workflowManifest: sqlManifest });
      await tester.name.fill('SQL workflow');

      await tester.saveButton.click();

      await expect.element(tester.formError).toHaveTextContent('A metadata query is required');
      expect(activeModal.close).not.toHaveBeenCalled();
    });

    test('should always push to OIAnalytics with a trimmed query when saving a SQL-family workflow', async () => {
      engineService.getRegistrationSettings.mockReturnValue(of(registered));
      const sqlWorkflow = { ...existingWorkflow, discoveryScope: { query: '  SELECT column_name FROM my_metadata_table  ' } };
      const tester = create({ mode: 'edit', workflow: sqlWorkflow, existingWorkflows: [sqlWorkflow], workflowManifest: sqlManifest });
      await expect.element(tester.notRegisteredWarning).not.toBeInTheDocument();

      await tester.saveButton.click();

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
    test('should allow picking the remote mode while OIBus is not registered, and show a warning instead of blocking it', async () => {
      const tester = create();
      await expect.element(tester.localMode).toBeChecked();
      await expect.element(tester.notRegisteredWarning).not.toBeInTheDocument();

      await tester.remoteMode.click();

      await expect.element(tester.notRegisteredWarning).toBeInTheDocument();
      await tester.name.fill('New workflow');
      await tester.saveButton.click();
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
      await tester.saveButton.click();

      // Identity keys only apply to local mode - never sent for a remote workflow, even if some were typed before switching.
      expect(savedCommand()).toEqual(expect.objectContaining({ pushToOIAnalytics: true, itemFieldMapping: null, identityKeyFields: [] }));
    });
  });

  describe('identity key fields', () => {
    test('should add and remove identity key fields, ignoring duplicates', async () => {
      const tester = create();

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
      const tester = create();
      await tester.name.fill('New workflow');

      await tester.saveButton.click();

      await expect.element(tester.formError).toHaveTextContent('At least one identity key field is required');
      expect(activeModal.close).not.toHaveBeenCalled();
    });
  });

  describe('eligibility filter', () => {
    test('should add conditions, without a value for "exists", and ignore an empty field', async () => {
      const tester = create({ mode: 'edit', workflow: { ...existingWorkflow, eligibilityFilter: [] } });
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

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
      await tester.saveButton.click();
      expect(savedCommand().eligibilityFilter).toEqual([
        { field: 'type', operator: 'equals', value: 'Variable' },
        { field: 'unit', operator: 'exists' }
      ]);
    });

    test('should edit an eligibility condition in place', async () => {
      const tester = create({ mode: 'edit' });
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);

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
      await tester.saveButton.click();
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
    test('should list every field the manifest exposes, plus the historian fields', async () => {
      const tester = create();

      // Top-level manifest fields (scanMode renamed to the command's own scanModeId path), settings.* fields, historian fields
      for (const path of [
        'name',
        'enabled',
        'scanModeId',
        'settings.objectValue',
        'groupId',
        'maxReadInterval',
        'readDelay',
        'startTimeOffset',
        'endTimeOffset',
        'recoveryStrategy'
      ]) {
        await expect.element(tester.mappingField(path)).toBeInTheDocument();
      }
      await expect.element(tester.mappingField('scanMode')).not.toBeInTheDocument();
    });

    test('should not add historian fields when the manifest does not support history', async () => {
      const tester = create({ workflowManifest: noHistoryManifest });

      await expect.element(tester.mappingField('name')).toBeInTheDocument();
      await expect.element(tester.mappingField('maxReadInterval')).not.toBeInTheDocument();
      await expect.element(tester.mappingField('groupId')).not.toBeInTheDocument();
    });

    test('should render a select (not a text box) for boolean, scan-mode, and string-select fields', async () => {
      const tester = create();

      await expect.element(tester.mappingField('enabled').getByRole('option', { name: 'Yes' })).toBeInTheDocument();
      await expect.element(tester.mappingField('enabled').getByRole('option', { name: 'No' })).toBeInTheDocument();
      await expect.element(tester.mappingField('scanModeId').getByRole('option', { name: scanModes[0].name })).toBeInTheDocument();
      await expect
        .element(tester.mappingField('recoveryStrategy').getByRole('option', { name: 'From oldest to newest' }))
        .toBeInTheDocument();
      await expect.element(tester.mappingField('name')).toHaveRole('textbox');
    });

    test('should label a manifest string-select field with its title, and the historian ones with their flat label', async () => {
      const tester = create({ workflowManifest: enablingManifest });

      await expect.element(tester.mappingRow('settings.mode').getByCss('label')).toHaveTextContent('Mode');
      await expect.element(tester.mappingRow('recoveryStrategy').getByCss('label')).toHaveTextContent('Recovery strategy');
    });

    test('should switch a select-type field into variable mode and expose an expression input when the sentinel is chosen', async () => {
      const tester = create({ mode: 'edit' });
      await expect.element(tester.mappingExpression('enabled')).not.toBeInTheDocument();

      await tester.mappingField('enabled').selectOptions('Use a {{ field }} expression...');

      await expect.element(tester.mappingExpression('enabled')).toHaveValue('{{}}');
      await tester.mappingExpression('enabled').fill('{{isEnabled}}');
      await tester.mappingField('scanModeId').selectOptions(scanModes[0].name);
      await tester.saveButton.click();
      expect(savedCommand().itemFieldMapping).toEqual(expect.objectContaining({ enabled: '{{isEnabled}}' }));
    });

    test('should treat an existing {{...}} value on a select-type field as already in variable mode when editing', async () => {
      const tester = create({ mode: 'edit', workflow: { ...existingWorkflow, itemFieldMapping: { enabled: '{{isEnabled}}' } } });

      await expect.element(tester.mappingField('enabled')).toHaveValue('__variable__');
      await expect.element(tester.mappingExpression('enabled')).toHaveValue('{{isEnabled}}');
    });

    test('should flag a field referenced by an enablingCondition and omit its {{ }} option, forcing a constant', async () => {
      const tester = create({ workflowManifest: enablingManifest });

      await expect.element(tester.mappingRow('settings.mode')).toMatchTextContent('Controls visibility');
      await expect.element(tester.mappingRow('name')).not.toMatchTextContent('Controls visibility');
      await expect.element(tester.mappingField('settings.mode').getByRole('option', { name: 'HA' })).toBeInTheDocument();
      await expect
        .element(tester.mappingField('settings.mode').getByRole('option', { name: 'Use a {{ field }} expression...' }))
        .not.toBeInTheDocument();
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
      await tester.saveButton.click();

      expect(savedCommand().itemFieldMapping).toEqual({ 'settings.mode': 'da' });
    });

    test('should reject saving when a field that gates other fields is mapped to a {{ }} expression', async () => {
      // Not reachable through the select itself (its {{ }} option is gone) - an existing workflow whose mapping predates
      // this restriction
      const workflow = { ...existingWorkflow, itemFieldMapping: { 'settings.mode': '{{mode}}' } };
      const tester = create({ mode: 'edit', workflow, workflowManifest: enablingManifest });

      await tester.saveButton.click();

      await expect.element(tester.formError).toMatchTextContent('This field must be mapped to a constant');
      expect(activeModal.close).not.toHaveBeenCalled();
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
      await tester.saveButton.click();

      await expect.element(tester.formError).toMatchTextContent('This field must be mapped to a constant');
      expect(activeModal.close).not.toHaveBeenCalled();
    });

    test('should reject saving when a mandatory item field is not mapped, and flag it', async () => {
      const tester = create({ mode: 'edit' });
      await expect.element(tester.mappingRow('scanModeId')).toMatchTextContent('Required');
      await expect.element(tester.mappingRow('enabled')).not.toMatchTextContent('Required');

      await tester.saveButton.click();

      await expect.element(tester.formError).toMatchTextContent('Every mandatory field (marked "Required") must be mapped');
      expect(activeModal.close).not.toHaveBeenCalled();
    });
  });

  describe('groups', () => {
    test("should map the group field to one of the connector's own groups, through a dropdown", async () => {
      const tester = create({ mode: 'edit' });
      await expect.element(tester.groupToggle).toHaveRole('button');
      await expect.element(tester.groupToggle).toHaveTextContent('None');

      await tester.selectGroup('Group 1');
      await expect.element(tester.groupToggle).toHaveTextContent('Group 1');
      // scanModeId is no longer mandatory once the item is mapped into a group
      await expect.element(tester.mappingRow('scanModeId')).not.toMatchTextContent('Required');
      await tester.saveButton.click();
      expect(savedCommand().itemFieldMapping).toEqual({ name: '{{name}}', groupId: 'group1' });

      await tester.selectGroup('None');
      await expect.element(tester.groupToggle).toHaveTextContent('None');
    });

    test('should show the item-owned historian fields and hide syncWithGroup while the item is not mapped into a group', async () => {
      const tester = create();

      for (const path of ['maxReadInterval', 'readDelay', 'startTimeOffset', 'endTimeOffset', 'recoveryStrategy']) {
        await expect.element(tester.mappingField(path)).toBeInTheDocument();
      }
      await expect.element(tester.mappingField('syncWithGroup')).not.toBeInTheDocument();
    });

    test('should still show the item-owned historian fields once grouped, as long as the item is not synced with the group', async () => {
      const tester = create();

      await tester.selectGroup('Group 1');

      for (const path of ['maxReadInterval', 'readDelay', 'startTimeOffset', 'endTimeOffset', 'recoveryStrategy', 'syncWithGroup']) {
        await expect.element(tester.mappingField(path)).toBeInTheDocument();
      }
    });

    test('should hide the item-owned historian fields once the item is actually synced with its group', async () => {
      const tester = create();
      await tester.selectGroup('Group 1');

      await tester.mappingField('syncWithGroup').selectOptions('Yes');

      for (const path of ['maxReadInterval', 'readDelay', 'startTimeOffset', 'endTimeOffset', 'recoveryStrategy']) {
        await expect.element(tester.mappingField(path)).not.toBeInTheDocument();
      }
    });

    test('should create a group, add it to the shared list and map it', async () => {
      const tester = create({ directSave: false });
      const command = buildSouthItemGroupCommand(null, 'Group 2');
      const createdGroup = buildSouthItemGroupCommand('group2', 'Group 2');
      const groupModal = createMock(EditSouthItemGroupModalComponent);
      modalService.mockClosedModal(groupModal, { mode: 'create', group: command });
      addOrEditGroup.mockReturnValue(of(createdGroup));

      await tester.groupToggle.click();
      await tester.createGroupButton.click();

      expect(groupModal.directSave).toBe(false);
      expect(groupModal.prepareForCreation).toHaveBeenCalledWith(scanModes, groups, manifest);
      expect(addOrEditGroup).toHaveBeenCalledWith({ mode: 'create', group: command });
      expect(groups).toContain(createdGroup);
      await expect.element(tester.groupToggle).toHaveTextContent('Group 2');
    });

    test('should edit a group and show its new name', async () => {
      const tester = create();
      await tester.selectGroup('Group 1');
      const editedGroup = groups[0];
      const updatedGroup = buildSouthItemGroup('group1', 'Group 1 renamed');
      const groupModal = createMock(EditSouthItemGroupModalComponent);
      modalService.mockClosedModal(groupModal, { mode: 'edit', group: buildSouthItemGroupCommand('group1', 'Group 1 renamed') });
      addOrEditGroup.mockReturnValue(of(updatedGroup));

      await tester.groupToggle.click();
      await tester.groupRowButton('Group 1', 'Edit group').click();

      expect(groupModal.prepareForEdition).toHaveBeenCalledWith(scanModes, groups, manifest, editedGroup);
      expect(groups[0]).toBe(updatedGroup);
      await expect.element(tester.groupToggle).toHaveTextContent('Group 1 renamed');
    });

    test('should delete a group, remove it from the shared list and unmap it if it was selected', async () => {
      const tester = create();
      await tester.selectGroup('Group 1');
      deleteGroup.mockReturnValue(of(undefined));
      const deletedGroup = groups[0];

      await tester.groupToggle.click();
      await tester.groupRowButton('Group 1', 'Delete').click();

      expect(deleteGroup).toHaveBeenCalledWith(deletedGroup);
      // Removed from the caller's own list too, not just from a copy of it
      expect(groups).toEqual([]);
      await expect.element(tester.groupToggle).toHaveTextContent('None');
      await expect.element(tester.groupOption('Group 1')).not.toBeInTheDocument();
    });
  });
});
