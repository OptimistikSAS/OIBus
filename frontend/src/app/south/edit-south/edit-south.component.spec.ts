import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { EditSouthComponent } from './edit-south.component';
import ManageGroupsModalComponent from '../south-items/manage-groups-modal/manage-groups-modal.component';
import ManageWorkflowsModalComponent from '../south-workflows/manage-workflows-modal/manage-workflows-modal.component';
import { ConfigurationWorkflowService } from '../../services/configuration-workflow.service';
import { ConfigurationWorkflowDTO } from '@oibus/shared/configuration-workflow.model';
import { ImportSouthItemsModalComponent } from '../south-items/import-south-items-modal/import-south-items-modal.component';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { CertificateService } from '../../services/certificate.service';
import { NotificationService } from '../../shared/notification.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { ModalService } from '../../shared/modal.service';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { TransformerService } from '../../services/transformer.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { SouthExploreModalComponent } from '../../shared/south-explore-modal/south-explore-modal.component';
import { SouthConnectorDTO, SouthItemGroupDTO } from '@oibus/shared/south-connector.model';
import { ScanModeDTO } from '@oibus/shared/scan-mode.model';
import testData from '../../../../../backend/src/tests/utils/test-data';

const manifest = testData.south.manifest;
const southConnector = testData.south.list[0] as unknown as SouthConnectorDTO;
const scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;

const buildGroup = (id: string, name: string, scanMode: ScanModeDTO): SouthItemGroupDTO => ({
  id,
  createdAt: '',
  updatedAt: '',
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' },
  standardSettings: { name, scanMode },
  historySettings: {
    startTimeOffset: 0,
    endTimeOffset: 0,
    maxReadInterval: 3600,
    readDelay: 200,
    recoveryStrategy: 'oldest',
    cachingStrategy: null
  }
});

const createRouteStub = {
  paramMap: of({ get: () => null }),
  queryParamMap: of({ get: (key: string) => (key === 'type' ? 'folder-scanner' : null), getAll: () => [] as Array<string> })
};

const editRouteStub = {
  paramMap: of({ get: (key: string) => (key === 'southId' ? southConnector.id : null) }),
  queryParamMap: of({ get: () => null, getAll: () => [] as Array<string> })
};

const duplicateRouteStub = {
  paramMap: of({ get: () => null }),
  queryParamMap: of({ get: (key: string) => (key === 'duplicate' ? southConnector.id : null), getAll: () => [] as Array<string> })
};

const buildWorkflow = (id: string, name: string, overrides: Partial<ConfigurationWorkflowDTO> = {}): ConfigurationWorkflowDTO => ({
  id,
  name,
  southId: southConnector.id,
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [],
  itemFieldMapping: { name: '{{name}}' },
  pushToOIAnalytics: false,
  scanMode: null,
  enabled: true,
  createdAt: '',
  updatedAt: '',
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' },
  ...overrides
});

describe('EditSouthComponent', () => {
  let southConnectorService: MockObject<SouthConnectorService>;
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  let scanModeService: MockObject<ScanModeService>;
  let certificateService: MockObject<CertificateService>;
  let confirmationService: MockObject<ConfirmationService>;
  let modalService: MockObject<ModalService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    configurationWorkflowService.list.mockReturnValue(of([]));
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);
    const notificationService = createMock(NotificationService);
    confirmationService = createMock(ConfirmationService);
    modalService = createMock(ModalService);
    const unsavedChangesService = createMock(UnsavedChangesConfirmationService);
    const transformerService = createMock(TransformerService);

    scanModeService.list.mockReturnValue(of(scanModes));
    certificateService.list.mockReturnValue(of([]));
    southConnectorService.list.mockReturnValue(of([]));
    southConnectorService.getSouthManifest.mockReturnValue(of(manifest));
    southConnectorService.getGroups.mockReturnValue(of([]));
    transformerService.list.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: ModalService, useValue: modalService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesService },
        { provide: TransformerService, useValue: transformerService }
      ]
    });
  });

  test('should display create mode', async () => {
    TestBed.overrideProvider(ActivatedRoute, { useValue: createRouteStub });
    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#south-name')).toBeInTheDocument();
  });

  test('should display edit mode with form populated', async () => {
    southConnectorService.findById.mockReturnValue(of(southConnector as any));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });
    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#south-name')).toHaveValue(southConnector.name);
  });

  test('duplicate mode should assign new temp ids to groups and remap items to them', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const itemWithGroup = { ...southConnector.items[0], group: groupA, syncWithGroup: true };
    const southConnectorWithGroup = { ...southConnector, groups: [groupA], items: [itemWithGroup, southConnector.items[1]] };
    southConnectorService.findById.mockReturnValue(of(southConnectorWithGroup as any));
    TestBed.overrideProvider(ActivatedRoute, { useValue: duplicateRouteStub });

    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.mode).toBe('create');
    const inMemoryGroup = fixture.componentInstance.inMemoryGroups[0];
    expect(inMemoryGroup.id).not.toBe('group1');
    expect(inMemoryGroup.id?.startsWith('temp_')).toBe(true);

    const remappedItem = fixture.componentInstance.inMemoryItems.find(item => item.id === itemWithGroup.id)!;
    expect(remappedItem.groupId).toBe(inMemoryGroup.id);
    expect(remappedItem.groupName).toBe('GroupA');
  });

  test('deleteGroup should confirm, unassign items referencing the group, and refresh the item list', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const itemWithGroup = { ...southConnector.items[0], group: groupA, syncWithGroup: true };
    const southConnectorWithGroup = { ...southConnector, groups: [groupA], items: [itemWithGroup, southConnector.items[1]] };
    southConnectorService.findById.mockReturnValue(of(southConnectorWithGroup as any));
    confirmationService.confirm.mockReturnValue(of(undefined));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });

    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const inMemoryGroup = fixture.componentInstance.inMemoryGroups.find(group => group.id === 'group1')!;
    fixture.componentInstance.deleteGroup(inMemoryGroup).subscribe();

    expect(confirmationService.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ messageKey: 'south.groups.confirm-deletion', interpolateParams: { name: 'GroupA' } })
    );
    const unassignedItem = fixture.componentInstance.inMemoryItems.find(item => item.id === itemWithGroup.id)!;
    expect(unassignedItem.groupId).toBeNull();
    expect(unassignedItem.groupName).toBeNull();
    expect(unassignedItem.syncWithGroup).toBe(false);
    expect(fixture.componentInstance.filteredItems.find(item => item.id === itemWithGroup.id)?.groupId).toBeNull();
  });

  test('deleteGroup should fill empty scan mode and history fields on items that were inheriting from the group', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const itemWithEmptyFields = {
      ...southConnector.items[0],
      group: groupA,
      syncWithGroup: true,
      scanMode: null,
      maxReadInterval: null,
      readDelay: null,
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null
    };
    const southConnectorWithGroup = { ...southConnector, groups: [groupA], items: [itemWithEmptyFields, southConnector.items[1]] };
    southConnectorService.findById.mockReturnValue(of(southConnectorWithGroup as any));
    confirmationService.confirm.mockReturnValue(of(undefined));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });

    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const inMemoryGroup = fixture.componentInstance.inMemoryGroups.find(group => group.id === 'group1')!;
    fixture.componentInstance.deleteGroup(inMemoryGroup).subscribe();

    const unassignedItem = fixture.componentInstance.inMemoryItems.find(item => item.id === itemWithEmptyFields.id)!;
    expect(unassignedItem.scanModeId).toBe(scanModes[0].id);
    expect(unassignedItem.startTimeOffset).toBe(0);
    expect(unassignedItem.endTimeOffset).toBe(0);
    expect(unassignedItem.maxReadInterval).toBe(3600);
    expect(unassignedItem.readDelay).toBe(200);
    expect(unassignedItem.recoveryStrategy).toBe('oldest');
  });

  test('deleteGroup should not overwrite an item own scan mode and history fields', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const itemWithOwnFields = {
      ...southConnector.items[0],
      group: groupA,
      syncWithGroup: false,
      scanMode: scanModes[1],
      maxReadInterval: 60,
      readDelay: 50,
      startTimeOffset: 10,
      endTimeOffset: 20,
      recoveryStrategy: 'newest' as const
    };
    const southConnectorWithGroup = { ...southConnector, groups: [groupA], items: [itemWithOwnFields, southConnector.items[1]] };
    southConnectorService.findById.mockReturnValue(of(southConnectorWithGroup as any));
    confirmationService.confirm.mockReturnValue(of(undefined));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });

    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const inMemoryGroup = fixture.componentInstance.inMemoryGroups.find(group => group.id === 'group1')!;
    fixture.componentInstance.deleteGroup(inMemoryGroup).subscribe();

    const unassignedItem = fixture.componentInstance.inMemoryItems.find(item => item.id === itemWithOwnFields.id)!;
    expect(unassignedItem.scanModeId).toBe(scanModes[1].id);
    expect(unassignedItem.startTimeOffset).toBe(10);
    expect(unassignedItem.endTimeOffset).toBe(20);
    expect(unassignedItem.maxReadInterval).toBe(60);
    expect(unassignedItem.readDelay).toBe(50);
    expect(unassignedItem.recoveryStrategy).toBe('newest');
  });

  test('manageGroups should open the manage groups modal with in-memory groups and items', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const itemWithGroup = { ...southConnector.items[0], group: groupA };
    const southConnectorWithGroup = { ...southConnector, groups: [groupA], items: [itemWithGroup, southConnector.items[1]] };
    southConnectorService.findById.mockReturnValue(of(southConnectorWithGroup as any));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });

    const prepare = vi.fn();
    modalService.open.mockReturnValue({ componentInstance: { prepare }, result: of(undefined) } as any);

    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    fixture.componentInstance.manageGroups();

    expect(modalService.open).toHaveBeenCalledWith(ManageGroupsModalComponent, expect.anything());
    expect(prepare).toHaveBeenCalledWith(
      fixture.componentInstance.inMemoryGroups,
      scanModes,
      manifest,
      false,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function)
    );
    const getItemCount = prepare.mock.calls[0][4];
    expect(getItemCount('group1')).toBe(1);
  });

  test('importItems should open the import modal with recoveryStrategy among the optional headers', () => {
    southConnectorService.findById.mockReturnValue(of(southConnector as any));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });

    const prepare = vi.fn();
    modalService.open.mockReturnValue({ componentInstance: { prepare }, result: of(undefined) } as any);

    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    fixture.componentInstance.importItems();

    expect(modalService.open).toHaveBeenCalledWith(ImportSouthItemsModalComponent, expect.anything());
    const optionalHeaders = prepare.mock.calls[0][2];
    expect(optionalHeaders).toContain('recoveryStrategy');
  });

  test('should display the explore button when the connector supports it', async () => {
    southConnectorService.findById.mockReturnValue(of(southConnector as any));
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });
    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#explore')).toBeInTheDocument();
  });

  test('should open the explore modal', () => {
    southConnectorService.findById.mockReturnValue(of(southConnector as any));
    const fakeModal = { componentInstance: { prepare: vi.fn() } };
    modalService.open.mockReturnValue(fakeModal as any);
    TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });
    const fixture = TestBed.createComponent(EditSouthComponent);
    fixture.detectChanges();

    fixture.componentInstance.explore();

    expect(modalService.open).toHaveBeenCalledWith(SouthExploreModalComponent, expect.anything());
    expect(fakeModal.componentInstance.prepare).toHaveBeenCalled();
  });
  describe('configuration workflows', () => {
    test('should start with no workflows in plain create mode, without loading any', async () => {
      TestBed.overrideProvider(ActivatedRoute, { useValue: createRouteStub });
      const fixture = TestBed.createComponent(EditSouthComponent);
      fixture.detectChanges();

      expect(configurationWorkflowService.list).not.toHaveBeenCalled();
      expect(fixture.componentInstance.inMemoryWorkflows).toEqual([]);
      expect(fixture.componentInstance.formSouthConnectorCommand.configurationWorkflows).toEqual([]);
      const root = page.elementLocator(fixture.nativeElement);
      await expect.element(root.getByCss('#manage-workflows-button')).toMatchTextContent(/Manage sync configuration\s*0/);
    });

    test("should load the connector's workflows in edit mode, keeping their ids, and include them in the command", async () => {
      southConnectorService.findById.mockReturnValue(of(southConnector as any));
      configurationWorkflowService.list.mockReturnValue(
        of([buildWorkflow('workflow1', 'Alpha', { scanMode: scanModes[0] }), buildWorkflow('workflow2', 'Beta')])
      );
      TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });
      const fixture = TestBed.createComponent(EditSouthComponent);
      fixture.detectChanges();

      expect(configurationWorkflowService.list).toHaveBeenCalledWith(southConnector.id);
      expect(fixture.componentInstance.inMemoryWorkflows).toEqual([
        {
          id: 'workflow1',
          name: 'Alpha',
          discoveryScope: { rootNodeId: 'ns=1;s=Root' },
          identityKeyFields: ['nodeId'],
          eligibilityFilter: [],
          itemFieldMapping: { name: '{{name}}' },
          pushToOIAnalytics: false,
          scanModeId: scanModes[0].id,
          enabled: true
        },
        expect.objectContaining({ id: 'workflow2', name: 'Beta', scanModeId: null })
      ]);
      expect(fixture.componentInstance.formSouthConnectorCommand.configurationWorkflows).toBe(fixture.componentInstance.inMemoryWorkflows);
      const root = page.elementLocator(fixture.nativeElement);
      await expect.element(root.getByCss('#manage-workflows-button')).toMatchTextContent(/Manage sync configuration\s*2/);
    });

    test('should send the in-memory workflows along with the connector on save', () => {
      southConnectorService.findById.mockReturnValue(of(southConnector as any));
      southConnectorService.update.mockReturnValue(of(undefined) as any);
      configurationWorkflowService.list.mockReturnValue(of([buildWorkflow('workflow1', 'Alpha')]));
      TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });
      const fixture = TestBed.createComponent(EditSouthComponent);
      fixture.detectChanges();
      fixture.componentInstance.inMemoryWorkflows.push({ ...fixture.componentInstance.inMemoryWorkflows[0], id: 'temp_1', name: 'New' });

      fixture.componentInstance.submit('save');

      expect(southConnectorService.update).toHaveBeenCalledWith(
        southConnector.id,
        expect.objectContaining({
          configurationWorkflows: [expect.objectContaining({ id: 'workflow1' }), expect.objectContaining({ id: 'temp_1', name: 'New' })]
        })
      );
    });

    test("duplicate mode should load the source's workflows with fresh temp ids, remapping a mapped group to its copy", () => {
      const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
      southConnectorService.findById.mockReturnValue(of({ ...southConnector, groups: [groupA] } as any));
      configurationWorkflowService.list.mockReturnValue(
        of([
          buildWorkflow('workflow1', 'Alpha', { itemFieldMapping: { name: '{{name}}', groupId: 'group1' } }),
          buildWorkflow('workflow2', 'Beta', { pushToOIAnalytics: true, itemFieldMapping: null })
        ])
      );
      TestBed.overrideProvider(ActivatedRoute, { useValue: duplicateRouteStub });
      const fixture = TestBed.createComponent(EditSouthComponent);
      fixture.detectChanges();

      expect(configurationWorkflowService.list).toHaveBeenCalledWith(southConnector.id);
      const [alpha, beta] = fixture.componentInstance.inMemoryWorkflows;
      expect(alpha.id).toMatch(/^temp_/);
      expect(beta.id).toMatch(/^temp_/);
      expect(alpha.id).not.toBe(beta.id);
      expect(alpha.itemFieldMapping).toEqual({ name: '{{name}}', groupId: fixture.componentInstance.inMemoryGroups[0].id });
      expect(beta.itemFieldMapping).toBeNull();
    });

    test('deleteGroup should unmap the deleted group from every in-memory workflow mapping items into it', () => {
      const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
      southConnectorService.findById.mockReturnValue(of({ ...southConnector, groups: [groupA] } as any));
      configurationWorkflowService.list.mockReturnValue(
        of([
          buildWorkflow('workflow1', 'Alpha', { itemFieldMapping: { name: '{{name}}', groupId: 'group1', syncWithGroup: 'true' } }),
          buildWorkflow('workflow2', 'Beta', { itemFieldMapping: { name: '{{name}}', groupId: 'otherGroup' } })
        ])
      );
      confirmationService.confirm.mockReturnValue(of(undefined));
      TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });
      const fixture = TestBed.createComponent(EditSouthComponent);
      fixture.detectChanges();

      const workflowsBefore = fixture.componentInstance.inMemoryWorkflows;

      fixture.componentInstance.deleteGroup(fixture.componentInstance.inMemoryGroups[0]).subscribe();

      // Same array, updated in place - an open manage workflows modal works on it
      expect(fixture.componentInstance.inMemoryWorkflows).toBe(workflowsBefore);
      const [alpha, beta] = fixture.componentInstance.inMemoryWorkflows;
      expect(alpha.itemFieldMapping).toEqual({ name: '{{name}}' });
      expect(beta.itemFieldMapping).toEqual({ name: '{{name}}', groupId: 'otherGroup' });
    });

    test('manageWorkflows should open the manage workflows modal in memory mode, against the unsaved settings', () => {
      southConnectorService.findById.mockReturnValue(of(southConnector as any));
      TestBed.overrideProvider(ActivatedRoute, { useValue: editRouteStub });
      const prepareForInMemory = vi.fn();
      modalService.open.mockReturnValue({ componentInstance: { prepareForInMemory }, result: of(undefined) } as any);
      const fixture = TestBed.createComponent(EditSouthComponent);
      fixture.detectChanges();

      fixture.componentInstance.manageWorkflows();

      expect(modalService.open).toHaveBeenCalledWith(ManageWorkflowsModalComponent, expect.anything());
      expect(prepareForInMemory).toHaveBeenCalledWith(
        fixture.componentInstance.inMemoryWorkflows,
        southConnector.id,
        fixture.componentInstance.formSouthConnectorCommand.settings,
        scanModes,
        manifest,
        fixture.componentInstance.inMemoryGroups,
        expect.any(Function),
        expect.any(Function)
      );
    });

    test("manageWorkflows should use the 'create' south id for a connector being created", () => {
      TestBed.overrideProvider(ActivatedRoute, { useValue: createRouteStub });
      const prepareForInMemory = vi.fn();
      modalService.open.mockReturnValue({ componentInstance: { prepareForInMemory }, result: of(undefined) } as any);
      const fixture = TestBed.createComponent(EditSouthComponent);
      fixture.detectChanges();

      fixture.componentInstance.manageWorkflows();

      expect(prepareForInMemory.mock.calls[0][1]).toBe('create');
    });
  });
});
