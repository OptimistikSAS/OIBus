import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';

import ManageWorkflowsModalComponent from './manage-workflows-modal.component';
import { ModalService } from '../../../shared/modal.service';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { NotificationService } from '../../../shared/notification.service';
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
const manifest = testData.south.manifest as unknown as SouthConnectorManifest;
const groups = [{ id: 'group1', standardSettings: { name: 'Group 1' } }] as unknown as Array<SouthItemGroupDTO>;

const buildWorkflow = (id: string, name: string, overrides: Partial<ConfigurationWorkflowDTO> = {}): ConfigurationWorkflowDTO => ({
  id,
  name,
  southId: 'southId1',
  targetItemId: null,
  discoveryScope: {},
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [],
  itemFieldMapping: { name: '{{name}}' },
  remoteFieldMapping: null,
  scanMode: null,
  enabled: true,
  createdAt: '',
  updatedAt: '',
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' },
  ...overrides
});

describe('ManageWorkflowsModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let modalService: MockObject<ModalService>;
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let router: MockObject<Router>;
  let workflows: Array<ConfigurationWorkflowDTO>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    modalService = createMock(ModalService);
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    router = createMock(Router);
    workflows = [buildWorkflow('workflow1', 'Alpha'), buildWorkflow('workflow2', 'Beta', { scanMode: scanModes[0] })];
    configurationWorkflowService.list.mockReturnValue(of(workflows));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ModalService, useValue: modalService },
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: Router, useValue: router }
      ]
    });
  });

  function createComponent() {
    const fixture = TestBed.createComponent(ManageWorkflowsModalComponent);
    fixture.componentInstance.prepare('southId1', scanModes, items, manifest, groups);
    fixture.detectChanges();
    return fixture;
  }

  test('should load and render every workflow for the south connector', async () => {
    const fixture = createComponent();

    expect(configurationWorkflowService.list).toHaveBeenCalledWith('southId1');
    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.modal-title')).toHaveTextContent('Configuration workflows (2)');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('Alpha');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('Beta');
  });

  test('should show a self-scoped/manual-only placeholder when scanMode/targetItemId are null', async () => {
    const fixture = createComponent();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('tbody')).toHaveTextContent('Manual only');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('None - self-scoped', { normalizeWhitespace: true });
  });

  test('should filter the displayed workflows by name', () => {
    const fixture = createComponent();

    fixture.componentInstance.searchControl.setValue('alp');

    expect(fixture.componentInstance.displayedWorkflows.map(w => w.name)).toEqual(['Alpha']);
  });

  test('should open the edit modal to add a workflow and create it on confirm', () => {
    const fixture = createComponent();
    const createdWorkflow = buildWorkflow('workflow3', 'Gamma');
    configurationWorkflowService.create.mockReturnValue(of(createdWorkflow));
    const editModalInstance = { prepareForCreation: vi.fn() };
    modalService.open.mockReturnValue({ componentInstance: editModalInstance, result: of({ name: 'Gamma' }) } as never);

    fixture.componentInstance.onAdd();

    expect(configurationWorkflowService.create).toHaveBeenCalledWith('southId1', { name: 'Gamma' });
    expect(fixture.componentInstance.workflows).toContainEqual(createdWorkflow);
    expect(notificationService.success).toHaveBeenCalledWith('south.workflows.created');
  });

  test('should open the edit modal to edit a workflow and update it on confirm', () => {
    const fixture = createComponent();
    const updatedWorkflow = buildWorkflow('workflow1', 'Alpha renamed');
    configurationWorkflowService.update.mockReturnValue(of(updatedWorkflow));
    modalService.open.mockReturnValue({
      componentInstance: { prepareForEdition: vi.fn() },
      result: of({ name: 'Alpha renamed' })
    } as never);

    fixture.componentInstance.onEdit(workflows[0]);

    expect(configurationWorkflowService.update).toHaveBeenCalledWith('southId1', 'workflow1', { name: 'Alpha renamed' });
    expect(fixture.componentInstance.workflows.find(w => w.id === 'workflow1')!.name).toBe('Alpha renamed');
    expect(notificationService.success).toHaveBeenCalledWith('south.workflows.updated');
  });

  test('should confirm, delete, and remove the workflow from the list', () => {
    const fixture = createComponent();
    confirmationService.confirm.mockReturnValue(of(undefined));
    configurationWorkflowService.delete.mockReturnValue(of(undefined));

    fixture.componentInstance.onDelete(workflows[0]);

    expect(configurationWorkflowService.delete).toHaveBeenCalledWith('southId1', 'workflow1');
    expect(fixture.componentInstance.workflows.find(w => w.id === 'workflow1')).toBeUndefined();
    expect(notificationService.success).toHaveBeenCalledWith('south.workflows.deleted');
  });

  test('should show a delete error notification on failure', () => {
    const fixture = createComponent();
    confirmationService.confirm.mockReturnValue(of(undefined));
    configurationWorkflowService.delete.mockReturnValue(throwError(() => ({ error: { message: 'boom' } })));

    fixture.componentInstance.onDelete(workflows[0]);

    expect(notificationService.error).toHaveBeenCalledWith('south.workflows.delete-error', { error: 'boom' });
  });

  test('should run a workflow now and show a success notification', () => {
    const fixture = createComponent();
    configurationWorkflowService.runNow.mockReturnValue(of({}) as never);

    fixture.componentInstance.onRunNow(workflows[0]);

    expect(configurationWorkflowService.runNow).toHaveBeenCalledWith('southId1', 'workflow1');
    expect(notificationService.success).toHaveBeenCalledWith('south.workflows.run-now-success');
    expect(fixture.componentInstance.runningWorkflowId).toBeNull();
  });

  test('should show a run-now error notification on failure', () => {
    const fixture = createComponent();
    configurationWorkflowService.runNow.mockReturnValue(throwError(() => ({ error: { message: 'not running' } })));

    fixture.componentInstance.onRunNow(workflows[0]);

    expect(notificationService.error).toHaveBeenCalledWith('south.workflows.run-now-error', { error: 'not running' });
  });

  test('should preview a workflow and open the preview modal with the result', () => {
    const fixture = createComponent();
    const previewResult = { discoveredCount: 1, eligibleCount: 1, entries: [] };
    configurationWorkflowService.preview.mockReturnValue(of(previewResult));
    const previewModalInstance = { prepare: vi.fn() };
    modalService.open.mockReturnValue({ componentInstance: previewModalInstance } as never);

    fixture.componentInstance.onPreview(workflows[0]);

    expect(configurationWorkflowService.preview).toHaveBeenCalledWith('southId1', 'workflow1');
    expect(previewModalInstance.prepare).toHaveBeenCalledWith('Alpha', previewResult);
  });

  test('should navigate to the run history page and close the modal', () => {
    const fixture = createComponent();

    fixture.componentInstance.onViewHistory(workflows[0]);

    expect(activeModal.close).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/south', 'southId1', 'workflows', 'workflow1', 'history']);
  });

  test('should close the modal', () => {
    const fixture = createComponent();

    fixture.componentInstance.close();

    expect(activeModal.close).toHaveBeenCalled();
  });
});
