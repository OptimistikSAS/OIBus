import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import EditWorkflowModalComponent from './edit-workflow-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
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
// Real manifest fixture: modes.history is true, items.rootAttribute.attributes = [name, enabled, scanMode, settings{...}] -
// exercises both the manifest-driven fields and the historian fields added alongside them.
const manifest = testData.south.manifest as unknown as SouthConnectorManifest;

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

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    const unsavedChangesService = createMock(UnsavedChangesConfirmationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should populate the form and dynamic lists in edit mode', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForEdition(scanModes, items, [existingWorkflow], manifest, existingWorkflow);
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
  });

  test('should list every field the manifest exposes for item field mapping, not just the mapped ones', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
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
    fixture.componentInstance.prepareForCreation(scanModes, items, [], { ...manifest, modes: { ...manifest.modes, history: false } });
    fixture.detectChanges();

    const paths = fixture.componentInstance.itemMappableFields.map(field => field.path);
    expect(paths).not.toContain('maxReadInterval');
    expect(paths).not.toContain('groupId');
  });

  test('should render a select (not a text box) for boolean, scan-mode, string-select, and group-select fields', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, groups);
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
    // group-select historian 'groupId' -> a select of this south connector's own groups.
    await expect.element(root.getByCss('#item-field-mapping-field-groupId option[value="group1"]')).toHaveTextContent('Group 1');
    // 'name' stays a plain string field -> no select rendered for it.
    expect(fixture.nativeElement.querySelector('#item-field-mapping-field-name').tagName).toBe('INPUT');
  });

  test('should append .title to a manifest string-select field label, but not to the flat-string hardcoded ones', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
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

  test('should switch a select-type field into variable mode and expose an expression input when the sentinel is chosen', async () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest, groups);
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
    fixture.componentInstance.prepareForEdition(scanModes, items, [], manifest, workflowWithVariableBoolean, groups);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#item-field-mapping-field-enabled-expression')).toHaveValue('{{isEnabled}}');
  });

  test('should render an empty form in create mode with item field mapping enabled by default', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
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
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
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
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
    fixture.detectChanges();

    fixture.componentInstance.newEligibilityField = '  ';
    fixture.componentInstance.addEligibilityCondition();
    expect(fixture.componentInstance.eligibilityFilter).toEqual([]);
  });

  test('should not set a value on an "exists" eligibility condition', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
    fixture.detectChanges();

    fixture.componentInstance.newEligibilityField = 'unit';
    fixture.componentInstance.newEligibilityOperator = 'exists';
    fixture.componentInstance.newEligibilityValue = 'ignored';
    fixture.componentInstance.addEligibilityCondition();

    expect(fixture.componentInstance.eligibilityFilter).toEqual([{ field: 'unit', operator: 'exists' }]);
  });

  test('should add and remove a remote field mapping extra row', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
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
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
    fixture.detectChanges();
    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.form!.controls.discoveryScope.setValue('{}');

    fixture.componentInstance.save();

    expect(fixture.componentInstance.formError).toBe('south.workflows.identity-key-fields-none');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should reject saving when neither mapping is enabled', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
    fixture.detectChanges();
    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.form!.controls.discoveryScope.setValue('{}');
    fixture.componentInstance.identityKeyFields = ['nodeId'];
    fixture.componentInstance.form!.controls.itemFieldMappingEnabled.setValue(false);
    fixture.componentInstance.form!.controls.remoteFieldMappingEnabled.setValue(false);

    fixture.componentInstance.save();

    expect(fixture.componentInstance.formError).toBe('south.workflows.mapping-required');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should reject saving when item field mapping is disabled and no target item is set', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
    fixture.detectChanges();
    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.form!.controls.discoveryScope.setValue('{}');
    fixture.componentInstance.identityKeyFields = ['nodeId'];
    fixture.componentInstance.form!.controls.itemFieldMappingEnabled.setValue(false);
    fixture.componentInstance.form!.controls.remoteFieldMappingEnabled.setValue(true);

    fixture.componentInstance.save();

    expect(fixture.componentInstance.formError).toBe('south.workflows.target-item-required');
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should reject saving invalid JSON discovery scope', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
    fixture.detectChanges();
    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.form!.controls.discoveryScope.setValue('not json');
    fixture.componentInstance.identityKeyFields = ['nodeId'];

    fixture.componentInstance.save();

    expect(fixture.componentInstance.discoveryScopeError).toBe(true);
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should close the modal with a valid command when everything is filled in', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
    fixture.detectChanges();

    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.form!.controls.discoveryScope.setValue('{ "rootNodeId": "ns=1;s=Root" }');
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

  test('should merge known and extra fields into remoteFieldMapping when saving', () => {
    const fixture = TestBed.createComponent(EditWorkflowModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
    fixture.detectChanges();

    fixture.componentInstance.form!.controls.name.setValue('New workflow');
    fixture.componentInstance.form!.controls.discoveryScope.setValue('{}');
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
    fixture.componentInstance.prepareForCreation(scanModes, items, [], manifest);
    fixture.detectChanges();

    fixture.componentInstance.cancel();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
