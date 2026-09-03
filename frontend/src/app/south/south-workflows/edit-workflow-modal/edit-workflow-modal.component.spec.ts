import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';

import EditWorkflowModalComponent from './edit-workflow-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { ModalService } from '../../../shared/modal.service';
import { SouthExploreModalComponent } from '../../../shared/south-explore-modal/south-explore-modal.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ConfigurationWorkflowDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import {
  SouthConnectorItemDTO,
  SouthConnectorManifest,
  SouthItemGroupDTO
} from '../../../../../../backend/shared/model/south-connector.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

const scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;
const items = [{ id: 'item1', name: 'Temperature' }] as unknown as Array<SouthConnectorItemDTO>;
const groups = [{ id: 'group1', standardSettings: { name: 'Group 1' } }] as unknown as Array<SouthItemGroupDTO>;
const southId = 'southId1';
const southSettings = testData.south.list[0].settings;
// Real manifest fixture: modes.history is true, items.rootAttribute.attributes = [name, enabled, scanMode, settings{...}] -
// exercises both the manifest-driven fields and the historian fields added alongside them.
const manifest = testData.south.manifest as unknown as SouthConnectorManifest;
// A SQL-family connector with no explore() (e.g. MSSQL) - query-only discovery scope, no reference tree.
const sqlManifest = { ...manifest, id: 'mssql', explore: false } as unknown as SouthConnectorManifest;
// A SQL-family connector that also has explore() (SQLite, today the only one) - query editor plus the
// reference tree above it.
const sqliteManifest = { ...manifest, id: 'sqlite', explore: true } as unknown as SouthConnectorManifest;

// Mirrors the real OPC-UA item manifest's mode -> haMode enabling condition (settings.mode is a
// string-select referral gating the whole settings.haMode object, whose own children - here just
// settings.haMode.aggregate - inherit that same condition). Reuses the real OPC-UA translation keys
// (mock-i18n throws on any key that isn't actually in en.json) rather than inventing new ones.
const enablingManifest = {
  ...manifest,
  items: {
    ...manifest.items,
    rootAttribute: {
      type: 'object',
      key: 'item',
      translationKey: 'configuration.oibus.manifest.south.items.item',
      displayProperties: { visible: true, wrapInBox: false },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          type: 'string',
          key: 'name',
          translationKey: 'configuration.oibus.manifest.south.items.name',
          defaultValue: null,
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        },
        {
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
        }
      ]
    }
  }
} as unknown as SouthConnectorManifest;

const existingWorkflow: ConfigurationWorkflowDTO = {
  id: 'workflowId1',
  name: 'Reactor discovery',
  southId: 'southId1',
  targetItemId: null,
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [{ field: 'type', operator: 'equals', value: 'Variable' }],
  itemFieldMapping: { name: '{{name}}' },
  remoteFieldMapping: { unit: '{{unit}}', customField: 'hello' },
  scanMode: scanModes[0],
  enabled: true,
  createdAt: '',
  updatedAt: '',
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' }
};

describe('EditWorkflowModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let modalService: MockObject<ModalService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    modalService = createMock(ModalService);
    const unsavedChangesService = createMock(UnsavedChangesConfirmationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ModalService, useValue: modalService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should populate the form and dynamic lists in edit mode', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForEdition(scanModes, items, [existingWorkflow], manifest, existingWorkflow, southId, southSettings);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#workflow-name')).toHaveValue('Reactor discovery');
    await expect.element(root.getByCss('#identity-key-fields-list')).toHaveTextContent('nodeId');
    await expect.element(root.getByCss('#eligibility-filter-table')).toHaveTextContent('type');
    await expect.element(root.getByCss('#item-field-mapping-field-name')).toHaveValue('{{name}}');
    await expect.element(root.getByCss('#remote-field-mapping-field-unit')).toHaveValue('{{unit}}');
    // A remoteFieldMapping key beyond the known fields lands in the extra rows, not silently dropped.
    await expect.element(root.getByCss('#remote-field-mapping-extra-table')).toHaveTextContent('customField');
    await expect.element(root.getByCss('#remote-field-mapping-extra-table')).toHaveTextContent('hello');
    // discoveryScope.rootNodeId is read back for the node picker (manifest is tree-based: explore: true).
    expect(fixture.componentInstance.discoveryRootNodeId).toBe('ns=1;s=Root');
    await expect.element(root.getByCss('#discovery-root-node-id')).toHaveTextContent('ns=1;s=Root');
  });

  test('should prefill a duplicate with the source workflow settings, a "-copy" name, and create-mode uniqueness', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCopy(scanModes, items, [existingWorkflow], manifest, existingWorkflow, southId, southSettings);
    fixture.detectChanges();

    expect(fixture.componentInstance.mode).toBe('copy');
    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.modal-title')).toHaveTextContent('Duplicate configuration workflow');
    await expect.element(root.getByCss('#workflow-name')).toHaveValue('Reactor discovery-copy');
    await expect.element(root.getByCss('#identity-key-fields-list')).toHaveTextContent('nodeId');
    await expect.element(root.getByCss('#item-field-mapping-field-name')).toHaveValue('{{name}}');
    expect(fixture.componentInstance.discoveryRootNodeId).toBe('ns=1;s=Root');

    // The clone's blanked id means the uniqueness check excludes nothing - the original workflow's own
    // name (not the "-copy" suffixed default) is still reported as taken if renamed back onto it.
    fixture.componentInstance.form!.controls.name.setValue('Reactor discovery');
    expect(fixture.componentInstance.form!.controls.name.errors).toEqual({ mustBeUnique: true });
  });

  test('should show the node picker for a tree-based connector, and open the explore modal in selectable mode', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#browse-root-node')).toBeInTheDocument();
    await expect.element(root.getByCss('#discovery-query')).not.toBeInTheDocument();
    await expect.element(root.getByCss('#discovery-scope-unsupported')).not.toBeInTheDocument();
    // Nothing picked yet - no "Clear" action, and the SQL-family-only validation doesn't apply.
    expect(fixture.nativeElement.querySelector('#clear-root-node')).toBeNull();

    const pickedEntry = { id: 'ns=1;s=Reactor', name: 'Reactor', metadata: {}, hasChildren: true };
    const exploreModalInstance = { prepare: vi.fn() };
    modalService.open.mockReturnValue({ componentInstance: exploreModalInstance, result: of(pickedEntry) } as never);

    fixture.componentInstance.openNodePicker();

    expect(modalService.open).toHaveBeenCalledWith(SouthExploreModalComponent, expect.anything());
    expect(exploreModalInstance.prepare).toHaveBeenCalledWith(southId, southSettings, manifest.id, undefined, true);
    expect(fixture.componentInstance.discoveryRootNodeId).toBe('ns=1;s=Reactor');
  });

  test('should clear a picked root node back to "browse from the true root"', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();
    fixture.componentInstance.discoveryRootNodeId = 'ns=1;s=Reactor';

    fixture.componentInstance.clearRootNodeId();

    expect(fixture.componentInstance.discoveryRootNodeId).toBeNull();
  });

  test('should show a query-only editor, with no reference tree, for a SQL-family connector without explore()', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], sqlManifest, southId, southSettings);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#discovery-query')).toBeInTheDocument();
    expect(fixture.nativeElement.querySelector('#browse-root-node')).toBeNull();
    expect(fixture.nativeElement.querySelector('#discovery-explore-tree')).toBeNull();
    expect(fixture.nativeElement.querySelector('#discovery-scope-unsupported')).toBeNull();
  });

  test('should show the reference explore tree above the query editor for SQLite', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], sqliteManifest, southId, southSettings);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#discovery-explore-tree')).toBeInTheDocument();
    await expect.element(root.getByCss('#discovery-query')).toBeInTheDocument();
  });

  test('should show an unsupported-connector message when the connector is neither tree-based nor SQL-family', () => {
    const unsupportedManifest = { ...manifest, id: 'mqtt', explore: false } as unknown as SouthConnectorManifest;
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], unsupportedManifest, southId, southSettings);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#discovery-scope-unsupported')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#browse-root-node')).toBeNull();
    expect(fixture.nativeElement.querySelector('#discovery-query')).toBeNull();
  });

  test('should read discoveryScope.query back for a SQL-family workflow being edited', () => {
    const sqlWorkflow: ConfigurationWorkflowDTO = { ...existingWorkflow, discoveryScope: { query: 'SELECT 1' } };
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForEdition(scanModes, items, [sqlWorkflow], sqlManifest, sqlWorkflow, southId, southSettings);
    fixture.detectChanges();

    expect(fixture.componentInstance.discoveryQuery).toBe('SELECT 1');
    expect(fixture.componentInstance.discoveryRootNodeId).toBeNull();
  });

  test('should list every field the manifest exposes for item field mapping, not just the mapped ones', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();

    const paths = fixture.componentInstance.itemMappableFields.map(field => field.path);
    // Top-level manifest fields (scanMode renamed to the command's own scanModeId path)...
    expect(paths).toContain('name');
    expect(paths).toContain('enabled');
    expect(paths).toContain('scanModeId');
    expect(paths).not.toContain('scanMode');
    // ...settings.* fields nested one level under the manifest's own settings object...
    expect(paths.some(path => path.startsWith('settings.'))).toBe(true);
    // ...and the historian fields added outside the manifest tree, since this fixture's manifest has modes.history: true.
    expect(paths).toEqual(
      expect.arrayContaining([
        'groupId',
        'syncWithGroup',
        'maxReadInterval',
        'readDelay',
        'startTimeOffset',
        'endTimeOffset',
        'recoveryStrategy'
      ])
    );
  });

  test('should not add historian fields when the manifest does not support history', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(
      scanModes,
      items,
      [],
      { ...manifest, modes: { ...manifest.modes, history: false } },
      southId,
      southSettings
    );
    fixture.detectChanges();

    const paths = fixture.componentInstance.itemMappableFields.map(field => field.path);
    expect(paths).not.toContain('maxReadInterval');
    expect(paths).not.toContain('groupId');
  });

  test('should render a select (not a text box) for boolean, scan-mode, and string-select fields', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings, groups);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    // boolean 'enabled' -> a select with a true/false option, not the free-form text box.
    await expect.element(root.getByCss('#item-field-mapping-field-enabled')).toBeInTheDocument();
    await expect.element(root.getByCss('#item-field-mapping-field-enabled option[value="true"]')).toBeInTheDocument();
    await expect.element(root.getByCss('#item-field-mapping-field-enabled option[value="false"]')).toBeInTheDocument();
    // scan-mode 'scanModeId' -> a select listing every scan mode.
    await expect.element(root.getByCss(`#item-field-mapping-field-scanModeId option[value="${scanModes[0].id}"]`)).toBeInTheDocument();
    // string-select historian 'recoveryStrategy' -> a select of oldest/newest.
    await expect.element(root.getByCss('#item-field-mapping-field-recoveryStrategy option[value="oldest"]')).toBeInTheDocument();
    await expect.element(root.getByCss('#item-field-mapping-field-recoveryStrategy option[value="newest"]')).toBeInTheDocument();
    // 'name' stays a plain string field -> no select rendered for it.
    expect(fixture.nativeElement.querySelector('#item-field-mapping-field-name').tagName).toBe('INPUT');
  });

  test("should render the group field as a dropdown listing this south connector's own groups, with a create-new-group action", async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings, groups);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#item-field-mapping-field-groupId')).toBeInTheDocument();
    // Not a native <select> - the dropdown supports inline edit/delete/create, which a <select> can't.
    expect(fixture.nativeElement.querySelector('#item-field-mapping-field-groupId').tagName).toBe('BUTTON');
    await expect.element(root.getByText('Group 1')).toBeInTheDocument();
    await expect.element(root.getByText('Create a new group...')).toBeInTheDocument();
  });

  test('should map the group field to a constant when a group is picked from the dropdown', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings, groups);
    fixture.detectChanges();

    fixture.componentInstance.onSelectGroup('group1');
    expect(fixture.componentInstance.itemFieldMappingValues['groupId']).toBe('group1');
    expect(fixture.componentInstance.getSelectedGroupName()).toBe('Group 1');

    fixture.componentInstance.onSelectGroup(null);
    expect(fixture.componentInstance.itemFieldMappingValues['groupId']).toBe('');
    expect(fixture.componentInstance.getSelectedGroupName()).toBe('');
  });

  test('should create a group directly against the live south connector and map it, mirroring the item edit modal', () => {
    // A fresh array, not the shared `groups` fixture - onAddGroup pushes into it in place (mirroring
    // EditSouthItemModalComponent's own onAddGroup), which would otherwise leak into every other test.
    const ownGroups = [{ id: 'group1', standardSettings: { name: 'Group 1' } }] as unknown as Array<SouthItemGroupDTO>;
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    const addOrEditGroup = vi.fn();
    const deleteGroup = vi.fn();
    const createdGroup = { id: 'group2', standardSettings: { name: 'Group 2' } } as unknown as SouthItemGroupDTO;
    addOrEditGroup.mockReturnValue(of(createdGroup));
    fixture.componentInstance.prepareForCreation(
      scanModes,
      items,
      [],
      manifest,
      southId,
      southSettings,
      ownGroups,
      addOrEditGroup,
      deleteGroup
    );
    fixture.detectChanges();
    const groupModalInstance = { prepareForCreation: vi.fn() };
    modalService.open.mockReturnValue({ componentInstance: groupModalInstance, result: of({ mode: 'create', group: {} }) } as never);

    fixture.componentInstance.onAddGroup();

    expect(addOrEditGroup).toHaveBeenCalledWith({ mode: 'create', group: {} });
    expect(fixture.componentInstance.groups).toContainEqual(createdGroup);
    expect(fixture.componentInstance.itemFieldMappingValues['groupId']).toBe('group2');
  });

  test('should delete a group and clear it from the mapping if it was the one currently selected', () => {
    const ownGroups = [{ id: 'group1', standardSettings: { name: 'Group 1' } }] as unknown as Array<SouthItemGroupDTO>;
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    const addOrEditGroup = vi.fn();
    const deleteGroup = vi.fn();
    deleteGroup.mockReturnValue(of(undefined));
    fixture.componentInstance.prepareForCreation(
      scanModes,
      items,
      [],
      manifest,
      southId,
      southSettings,
      ownGroups,
      addOrEditGroup,
      deleteGroup
    );
    fixture.detectChanges();
    fixture.componentInstance.onSelectGroup('group1');

    fixture.componentInstance.onDeleteGroup(ownGroups[0], new Event('click'));

    expect(deleteGroup).toHaveBeenCalledWith(ownGroups[0]);
    expect(fixture.componentInstance.groups).toEqual([]);
    expect(fixture.componentInstance.itemFieldMappingValues['groupId']).toBe('');
  });

  test('should append .title to a manifest string-select field label, but not to the flat-string hardcoded ones', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();

    // A manifest string-select's translationKey is a namespace object ({ title, <value>: ... }, e.g. OPC-UA's
    // security-mode) - the row label needs the same `.title` suffix the real manifest form control appends.
    const manifestStringSelect = {
      path: 'settings.securityMode',
      translationKey: 'configuration.oibus.manifest.south.opcua.settings.security-mode',
      attributeType: 'string-select' as const,
      selectableValues: ['none', 'sign']
    };
    expect(fixture.componentInstance.fieldLabelKey(manifestStringSelect)).toBe(
      'configuration.oibus.manifest.south.opcua.settings.security-mode.title'
    );

    // The two hardcoded string-select fields already resolve to a flat label string - no suffix needed.
    const recoveryStrategyField = fixture.componentInstance.itemMappableFields.find(field => field.path === 'recoveryStrategy')!;
    expect(fixture.componentInstance.fieldLabelKey(recoveryStrategyField)).toBe('south.items.recovery-strategy');
    const resamplingField = fixture.componentInstance.remoteKnownFields.find(field => field.path === 'resamplingMethod')!;
    expect(fixture.componentInstance.fieldLabelKey(resamplingField)).toBe('south.workflows.remote-known-fields.resampling-method');
  });

  test('should flag a field referenced by an enablingCondition and omit its {{ }} option, forcing a constant', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], enablingManifest, southId, southSettings);
    fixture.detectChanges();

    const modeField = fixture.componentInstance.itemMappableFields.find(field => field.path === 'settings.mode')!;
    expect(modeField.isEnablingReferral).toBe(true);
    // Every other select-type field (not referenced by any enablingCondition) keeps its escape hatch.
    const nameField = fixture.componentInstance.itemMappableFields.find(field => field.path === 'name')!;
    expect(nameField.isEnablingReferral).toBeFalsy();

    const root = page.elementLocator(fixture.nativeElement);
    await expect
      .element(root.getByCss('[id="item-field-mapping-field-settings.mode"] option[value="__variable__"]'))
      .not.toBeInTheDocument();
  });

  test('should hide a field gated by an enablingCondition until the referral constant matches, then show it', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], enablingManifest, southId, southSettings);
    fixture.detectChanges();

    const targetSelector = '[id="item-field-mapping-field-settings.haMode.aggregate"]';
    const root = page.elementLocator(fixture.nativeElement);
    const modeField = fixture.componentInstance.itemMappableFields.find(field => field.path === 'settings.mode')!;
    // settings.mode isn't mapped to anything yet, so the field it gates stays hidden - matching the real
    // manifest form, where an unmet enabling condition disables (hides) its target.
    expect(fixture.nativeElement.querySelector('[id="item-field-mapping-field-settings.haMode.aggregate"]')).toBeNull();

    fixture.componentInstance.onSelectChange(fixture.componentInstance.itemFieldMappingValues, modeField, 'da');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[id="item-field-mapping-field-settings.haMode.aggregate"]')).toBeNull();

    fixture.componentInstance.onSelectChange(fixture.componentInstance.itemFieldMappingValues, modeField, 'ha');
    fixture.detectChanges();
    await expect.element(root.getByCss(targetSelector)).toBeInTheDocument();
  });

  test('should reject saving when a field that gates other fields is mapped to a {{ }} expression', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], enablingManifest, southId, southSettings);
    fixture.detectChanges();
    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.identityKeyFields = ['nodeId'];
    // Not reachable through the select itself (its {{ }} option is gone) - simulates an existing
    // workflow whose mapping predates this restriction, loaded via prepareForEdition.
    fixture.componentInstance.itemFieldMappingValues['settings.mode'] = '{{mode}}';

    fixture.componentInstance.save();

    expect(fixture.componentInstance.formError).toBe('south.workflows.mapping-constant-only');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should never offer {{ }} for the schedule field - it must always reference a real scan mode', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();

    const scanModeIdField = fixture.componentInstance.itemMappableFields.find(field => field.path === 'scanModeId')!;
    expect(fixture.componentInstance.allowsVariable(scanModeIdField)).toBe(false);
    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('[id="item-field-mapping-field-scanModeId"] option[value="__variable__"]')).not.toBeInTheDocument();
  });

  test('should never offer {{ }} for recoveryStrategy/syncWithGroup, and hint "constant value" on the other historian fields', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings, groups);
    fixture.detectChanges();

    const byPath = (path: string) => fixture.componentInstance.itemMappableFields.find(field => field.path === path)!;
    for (const path of ['maxReadInterval', 'readDelay', 'startTimeOffset', 'endTimeOffset', 'recoveryStrategy', 'syncWithGroup']) {
      expect(fixture.componentInstance.allowsVariable(byPath(path))).toBe(false);
    }

    const root = page.elementLocator(fixture.nativeElement);
    // recoveryStrategy is select-type - the {{ }} option is omitted from its dropdown.
    await expect
      .element(root.getByCss('[id="item-field-mapping-field-recoveryStrategy"] option[value="__variable__"]'))
      .not.toBeInTheDocument();
    // maxReadInterval is a plain text field - it can't hide an escape hatch, so it hints instead.
    expect(fixture.componentInstance.itemFieldPlaceholderKey(byPath('maxReadInterval'))).toBe(
      'south.workflows.mapping-constant-placeholder'
    );
    await expect.element(root.getByCss('#item-field-mapping-field-maxReadInterval')).toHaveAttribute('placeholder', 'constant value');
  });

  test('should reject saving when a constant-only historian field is mapped to a {{ }} expression', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();
    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.identityKeyFields = ['nodeId'];
    fixture.componentInstance.itemFieldMappingValues['maxReadInterval'] = '{{interval}}';

    fixture.componentInstance.save();

    expect(fixture.componentInstance.formError).toBe('south.workflows.mapping-constant-only');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test("should keep a hidden field's value while editing, but strip it from the mapping at save time", () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], enablingManifest, southId, southSettings);
    fixture.detectChanges();
    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.identityKeyFields = ['nodeId'];
    // 'da' hides settings.haMode.aggregate, but a value was set for it earlier (e.g. while mode was 'ha').
    fixture.componentInstance.itemFieldMappingValues['settings.mode'] = 'da';
    fixture.componentInstance.itemFieldMappingValues['settings.haMode.aggregate'] = 'average';
    fixture.detectChanges();

    // Still hidden and still holding its value - nothing was cleared just by re-rendering.
    const aggregateField = fixture.componentInstance.itemMappableFields.find(field => field.path === 'settings.haMode.aggregate')!;
    expect(fixture.componentInstance.isItemFieldVisible(aggregateField)).toBe(false);
    expect(fixture.componentInstance.itemFieldMappingValues['settings.haMode.aggregate']).toBe('average');

    fixture.componentInstance.save();

    const command = (activeModal.close.mock.calls[0] as unknown as [{ itemFieldMapping: Record<string, string> }])[0];
    expect(command.itemFieldMapping).not.toHaveProperty('settings.haMode.aggregate');
    expect(command.itemFieldMapping).toEqual({ 'settings.mode': 'da' });
    // Editing state itself is untouched - toggling mode back to 'ha' would still show the same value.
    expect(fixture.componentInstance.itemFieldMappingValues['settings.haMode.aggregate']).toBe('average');
  });

  test('should record ancestor labels for a field nested beyond the top-level settings wrapper, but not for settings itself', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], enablingManifest, southId, southSettings);
    fixture.detectChanges();

    const modeField = fixture.componentInstance.itemMappableFields.find(field => field.path === 'settings.mode')!;
    expect(modeField.ancestorLabelKeys).toEqual([]);
    const aggregateField = fixture.componentInstance.itemMappableFields.find(field => field.path === 'settings.haMode.aggregate')!;
    expect(aggregateField.ancestorLabelKeys).toEqual(['configuration.oibus.manifest.south.items.opcua.ha-mode.title']);
  });

  test('should show the item-owned historian fields and hide syncWithGroup while the item is not mapped into a group', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings, groups);
    fixture.detectChanges();

    const byPath = (path: string) => fixture.componentInstance.itemMappableFields.find(field => field.path === path)!;
    for (const path of ['maxReadInterval', 'readDelay', 'startTimeOffset', 'endTimeOffset', 'recoveryStrategy']) {
      expect(fixture.componentInstance.isItemFieldVisible(byPath(path))).toBe(true);
    }
    expect(fixture.componentInstance.isItemFieldVisible(byPath('syncWithGroup'))).toBe(false);

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#item-field-mapping-field-maxReadInterval')).toBeInTheDocument();
    expect(fixture.nativeElement.querySelector('#item-field-mapping-field-syncWithGroup')).toBeNull();
  });

  test('should still show the item-owned historian fields once grouped, as long as the item is not synced with the group', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings, groups);
    fixture.detectChanges();

    fixture.componentInstance.onSelectGroup('group1');
    fixture.detectChanges();

    // Being in a group alone doesn't hide these - the item still owns its settings until it's synced.
    const byPath = (path: string) => fixture.componentInstance.itemMappableFields.find(field => field.path === path)!;
    for (const path of ['maxReadInterval', 'readDelay', 'startTimeOffset', 'endTimeOffset', 'recoveryStrategy']) {
      expect(fixture.componentInstance.isItemFieldVisible(byPath(path))).toBe(true);
    }
    expect(fixture.componentInstance.isItemFieldVisible(byPath('syncWithGroup'))).toBe(true);

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#item-field-mapping-field-maxReadInterval')).toBeInTheDocument();
    await expect.element(root.getByCss('#item-field-mapping-field-syncWithGroup')).toBeInTheDocument();
  });

  test('should hide the item-owned historian fields once the item is actually synced with its group', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings, groups);
    fixture.detectChanges();

    fixture.componentInstance.onSelectGroup('group1');
    const syncWithGroupField = fixture.componentInstance.itemMappableFields.find(field => field.path === 'syncWithGroup')!;
    fixture.componentInstance.onSelectChange(fixture.componentInstance.itemFieldMappingValues, syncWithGroupField, 'true');
    fixture.detectChanges();

    const byPath = (path: string) => fixture.componentInstance.itemMappableFields.find(field => field.path === path)!;
    for (const path of ['maxReadInterval', 'readDelay', 'startTimeOffset', 'endTimeOffset', 'recoveryStrategy']) {
      expect(fixture.componentInstance.isItemFieldVisible(byPath(path))).toBe(false);
    }

    expect(fixture.nativeElement.querySelector('#item-field-mapping-field-maxReadInterval')).toBeNull();
  });

  test('should switch a select-type field into variable mode and expose an expression input when the sentinel is chosen', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings, groups);
    fixture.detectChanges();

    const enabledField = fixture.componentInstance.itemMappableFields.find(field => field.path === 'enabled')!;
    expect(fixture.componentInstance.isVariableMode(fixture.componentInstance.itemFieldMappingValues, enabledField)).toBe(false);

    fixture.componentInstance.onSelectChange(
      fixture.componentInstance.itemFieldMappingValues,
      enabledField,
      fixture.componentInstance.variableSentinel
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.itemFieldMappingValues['enabled']).toBe('{{}}');
    expect(fixture.componentInstance.isVariableMode(fixture.componentInstance.itemFieldMappingValues, enabledField)).toBe(true);
    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#item-field-mapping-field-enabled-expression')).toBeInTheDocument();
  });

  test('should treat an existing {{...}} value on a select-type field as already in variable mode when editing', async () => {
    const workflowWithVariableBoolean: ConfigurationWorkflowDTO = {
      ...existingWorkflow,
      itemFieldMapping: { enabled: '{{isEnabled}}' }
    };
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForEdition(
      scanModes,
      items,
      [],
      manifest,
      workflowWithVariableBoolean,
      southId,
      southSettings,
      groups
    );
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#item-field-mapping-field-enabled-expression')).toHaveValue('{{isEnabled}}');
  });

  test('should render an empty form in create mode with item field mapping enabled by default', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();

    const controls = fixture.componentInstance.form!.controls;
    expect(controls.name.value).toBe('');
    expect(controls.itemFieldMappingEnabled.value).toBe(true);
    expect(controls.remoteFieldMappingEnabled.value).toBe(false);
    expect(fixture.componentInstance.identityKeyFields).toEqual([]);
    expect(fixture.componentInstance.itemFieldMappingValues).toEqual({});
  });

  test('should add and remove identity key fields', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();

    fixture.componentInstance.newIdentityKeyField = 'nodeId';
    fixture.componentInstance.addIdentityKeyField();
    expect(fixture.componentInstance.identityKeyFields).toEqual(['nodeId']);

    // Adding the same field again is a no-op
    fixture.componentInstance.newIdentityKeyField = 'nodeId';
    fixture.componentInstance.addIdentityKeyField();
    expect(fixture.componentInstance.identityKeyFields).toEqual(['nodeId']);

    fixture.componentInstance.removeIdentityKeyField('nodeId');
    expect(fixture.componentInstance.identityKeyFields).toEqual([]);
  });

  test('should not add an eligibility condition with an empty field', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();

    fixture.componentInstance.newEligibilityField = '  ';
    fixture.componentInstance.addEligibilityCondition();
    expect(fixture.componentInstance.eligibilityFilter).toEqual([]);
  });

  test('should not set a value on an "exists" eligibility condition', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();

    fixture.componentInstance.newEligibilityField = 'unit';
    fixture.componentInstance.newEligibilityOperator = 'exists';
    fixture.componentInstance.newEligibilityValue = 'ignored';
    fixture.componentInstance.addEligibilityCondition();

    expect(fixture.componentInstance.eligibilityFilter).toEqual([{ field: 'unit', operator: 'exists' }]);
  });

  test('should add and remove a remote field mapping extra row', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();

    fixture.componentInstance.newRemoteExtraKey = 'customField';
    fixture.componentInstance.newRemoteExtraValue = '{{custom}}';
    fixture.componentInstance.addRemoteExtraRow();
    expect(fixture.componentInstance.remoteFieldMappingExtraRows).toEqual([{ key: 'customField', value: '{{custom}}' }]);

    fixture.componentInstance.removeRemoteExtraRow(0);
    expect(fixture.componentInstance.remoteFieldMappingExtraRows).toEqual([]);
  });

  test('should reject saving when identityKeyFields is empty', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();
    fixture.componentInstance.form!.controls.name.setValue('New workflow');

    fixture.componentInstance.save();

    expect(fixture.componentInstance.formError).toBe('south.workflows.identity-key-fields-none');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should reject saving when neither mapping is enabled', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();
    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.identityKeyFields = ['nodeId'];
    fixture.componentInstance.form!.controls.itemFieldMappingEnabled.setValue(false);
    fixture.componentInstance.form!.controls.remoteFieldMappingEnabled.setValue(false);

    fixture.componentInstance.save();

    expect(fixture.componentInstance.formError).toBe('south.workflows.mapping-required');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should reject saving when item field mapping is disabled and no target item is set', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();
    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.identityKeyFields = ['nodeId'];
    fixture.componentInstance.form!.controls.itemFieldMappingEnabled.setValue(false);
    fixture.componentInstance.form!.controls.remoteFieldMappingEnabled.setValue(true);

    fixture.componentInstance.save();

    expect(fixture.componentInstance.formError).toBe('south.workflows.target-item-required');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test("should reject saving when a SQL connector's metadata query is blank", () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], sqlManifest, southId, southSettings);
    fixture.detectChanges();
    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.identityKeyFields = ['nodeId'];

    fixture.componentInstance.save();

    expect(fixture.componentInstance.formError).toBe('south.workflows.discovery-scope-query-required');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should close the modal with a valid command when everything is filled in', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();

    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.discoveryRootNodeId = 'ns=1;s=Root';
    fixture.componentInstance.form!.controls.scanModeId.setValue(scanModes[0].id);
    fixture.componentInstance.identityKeyFields = ['nodeId'];
    fixture.componentInstance.itemFieldMappingValues['name'] = '{{name}}';
    fixture.componentInstance.itemFieldMappingValues['enabled'] = '  '; // blank after trim -> not included

    fixture.componentInstance.save();

    expect(activeModal.close).toHaveBeenCalledWith({
      name: 'New workflow',
      targetItemId: null,
      discoveryScope: { rootNodeId: 'ns=1;s=Root' },
      identityKeyFields: ['nodeId'],
      eligibilityFilter: [],
      itemFieldMapping: { name: '{{name}}' },
      remoteFieldMapping: null,
      scanModeId: scanModes[0].id,
      enabled: true
    });
  });

  test('should build a query discoveryScope, and default a tree-based one to an empty scope, when saving', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], sqlManifest, southId, southSettings);
    fixture.detectChanges();
    fixture.componentInstance.form!.controls.name.setValue('SQL workflow');
    fixture.componentInstance.discoveryQuery = '  SELECT column_name FROM my_metadata_table  ';
    fixture.componentInstance.identityKeyFields = ['column_name'];
    fixture.componentInstance.form!.controls.itemFieldMappingEnabled.setValue(false);
    fixture.componentInstance.form!.controls.remoteFieldMappingEnabled.setValue(true);
    fixture.componentInstance.form!.controls.targetItemId.setValue(items[0].id);

    fixture.componentInstance.save();

    const command = (activeModal.close.mock.calls[0] as unknown as [{ discoveryScope: unknown }])[0];
    // Trimmed - a stray leading/trailing space in the textarea shouldn't become part of the query.
    expect(command.discoveryScope).toEqual({ query: 'SELECT column_name FROM my_metadata_table' });
  });

  test('should merge known and extra fields into remoteFieldMapping when saving', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();

    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.form!.controls.remoteFieldMappingEnabled.setValue(true);
    fixture.componentInstance.identityKeyFields = ['nodeId'];
    fixture.componentInstance.remoteFieldMappingValues['unit'] = '{{unit}}';
    fixture.componentInstance.remoteFieldMappingExtraRows = [{ key: 'customField', value: 'hello' }];

    fixture.componentInstance.save();

    const command = (activeModal.close.mock.calls[0] as unknown as [{ remoteFieldMapping: unknown }])[0];
    expect(command.remoteFieldMapping).toEqual({ unit: '{{unit}}', customField: 'hello' });
  });

  test('should cancel by dismissing the modal', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, southId, southSettings);
    fixture.detectChanges();

    fixture.componentInstance.cancel();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
