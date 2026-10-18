import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ConfigurationWorkflowCommandDTO } from '@oibus/shared/api/configuration-workflow.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { buildSouthItemGroup, buildWorkflow, buildWorkflowCommand } from '../../../test/builders';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { ConfigurationWorkflowService } from '../../services/configuration-workflow.service';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { fakeSouthItemGroups } from '../south-items/south-item-groups.testing';
import EditWorkflowModalComponent from './edit-workflow-modal/edit-workflow-modal.component';
import { exploreCheckedActions, WorkflowCreationContext, WorkflowCreationService } from './workflow-creation.service';

const manifest: SouthConnectorManifest = {
  ...testData.south.manifest,
  id: 'opcua',
  discovery: { kind: 'tree', defaults: { identityKeyFields: ['id'], itemFieldMapping: { name: '{{path}}' } } }
};

describe('exploreCheckedActions', () => {
  test('should offer to keep in sync with tree-based discovery, and to add items with discovery defaults', () => {
    expect(exploreCheckedActions(manifest)).toEqual([
      { id: 'keep-in-sync', labelKey: 'south.explore.keep-in-sync' },
      { id: 'add-items', labelKey: 'south.explore.add-as-items' }
    ]);
    expect(exploreCheckedActions({ ...manifest, discovery: { kind: 'tree' } })).toEqual([
      { id: 'keep-in-sync', labelKey: 'south.explore.keep-in-sync' }
    ]);
    expect(exploreCheckedActions({ ...manifest, discovery: { kind: 'query' } })).toEqual([]);
    // SQL tables can be added as items, but their synchronisation discovers from a query
    expect(exploreCheckedActions({ ...manifest, discovery: { kind: 'query', defaults: manifest.discovery!.defaults } })).toEqual([
      { id: 'add-items', labelKey: 'south.explore.add-as-items' }
    ]);
    expect(exploreCheckedActions({ ...manifest, discovery: undefined })).toEqual([]);
  });
});

describe('WorkflowCreationService', () => {
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<EditWorkflowModalComponent>;
  let service: WorkflowCreationService;

  const command = buildWorkflowCommand(null, 'Reactor', { discoveryScope: { nodeIds: ['ns=1;s=Reactor'] } });

  beforeEach(() => {
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideModalTesting(),
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    modalService = TestBed.inject(MockModalService);
    service = TestBed.inject(WorkflowCreationService);
  });

  function context(directSave: boolean): WorkflowCreationContext {
    return {
      directSave,
      southId: 'southId1',
      southSettings: testData.south.list[0].settings,
      scanModes: testData.scanMode.list,
      manifest,
      groups: fakeSouthItemGroups([buildSouthItemGroup('group1', 'Group 1')]),
      existingWorkflows: [{ id: 'workflow1', name: 'Reactor' }]
    };
  }

  test('should save a new workflow through the API in direct mode', () => {
    configurationWorkflowService.create.mockReturnValue(
      of(buildWorkflow('workflow2', 'Reactor', { discoveryScope: { nodeIds: ['ns=1;s=Reactor'] } }))
    );
    const saved: Array<ConfigurationWorkflowCommandDTO> = [];

    service.save('southId1', command, true).subscribe(workflow => saved.push(workflow));

    expect(configurationWorkflowService.create).toHaveBeenCalledWith('southId1', command);
    expect(notificationService.success).toHaveBeenCalledWith('south.workflows.created');
    expect(saved).toEqual([{ ...command, id: 'workflow2' }]);
  });

  test('should give a new workflow a temporary id in memory mode', () => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
    const saved: Array<ConfigurationWorkflowCommandDTO> = [];

    service.save('create', command, false).subscribe(workflow => saved.push(workflow));

    expect(configurationWorkflowService.create).not.toHaveBeenCalled();
    expect(saved).toEqual([{ ...command, id: 'temp_42' }]);
  });

  test('should create a workflow discovering from the nodes checked in the explore modal', () => {
    const editModal = createMock(EditWorkflowModalComponent);
    modalService.mockClosedModal(editModal, command);
    const open = vi.spyOn(modalService, 'open');
    vi.spyOn(Date, 'now').mockReturnValue(42);
    const workflowContext = context(false);
    const saved: Array<ConfigurationWorkflowCommandDTO> = [];

    service.createFromExploredNodes(workflowContext, ['ns=1;s=Reactor', 'ns=1;s=Boiler']).subscribe(workflow => saved.push(workflow));

    expect(open).toHaveBeenCalledWith(EditWorkflowModalComponent, { size: 'xl', backdrop: 'static' });
    expect(editModal.directSave).toBe(false);
    expect(editModal.prepareForCreation).toHaveBeenCalledWith(
      workflowContext.scanModes,
      workflowContext.existingWorkflows,
      manifest,
      'southId1',
      workflowContext.southSettings,
      workflowContext.groups,
      { name: '', discoveryScope: { nodeIds: ['ns=1;s=Reactor', 'ns=1;s=Boiler'] } }
    );
    expect(saved).toEqual([{ ...command, id: 'temp_42' }]);
  });

  test('should not save anything when the edit modal is dismissed', () => {
    modalService.mockDismissedModal(createMock(EditWorkflowModalComponent));
    const saved: Array<ConfigurationWorkflowCommandDTO> = [];

    service.createFromExploredNodes(context(true), ['ns=1;s=Reactor']).subscribe(workflow => saved.push(workflow));

    expect(configurationWorkflowService.create).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });
});
