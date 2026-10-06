import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { ConfigurationWorkflowCommandDTO, ConfigurationWorkflowDTO } from '@oibus/shared/api/configuration-workflow.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import testData from '../../../../../../backend/src/tests/utils/test-data';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { ModalService } from '../../../shared/modal.service';
import { NotificationService } from '../../../shared/notification.service';
import ManageWorkflowsModalComponent, { toConfigurationWorkflowCommand } from './manage-workflows-modal.component';

const scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;
const manifest = testData.south.manifest as unknown as SouthConnectorManifest;
const southSettings = testData.south.list[0].settings;
const groups = [{ id: 'group1', standardSettings: { name: 'Group 1' } }] as unknown as Array<SouthItemGroupDTO>;
const addOrEditGroup = vi.fn();
const deleteGroup = vi.fn();

const buildWorkflow = (id: string, name: string, overrides: Partial<ConfigurationWorkflowDTO> = {}): ConfigurationWorkflowDTO => ({
  id,
  name,
  southId: 'southId1',
  discoveryScope: {},
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

const buildCommand = (
  id: string | null,
  name: string,
  overrides: Partial<ConfigurationWorkflowCommandDTO> = {}
): ConfigurationWorkflowCommandDTO => ({
  id,
  name,
  discoveryScope: {},
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [],
  itemFieldMapping: { name: '{{name}}' },
  pushToOIAnalytics: false,
  scanModeId: null,
  enabled: true,
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
  let commands: Array<ConfigurationWorkflowCommandDTO>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    modalService = createMock(ModalService);
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    router = createMock(Router);
    workflows = [buildWorkflow('workflow1', 'Alpha'), buildWorkflow('workflow2', 'Beta', { scanMode: scanModes[0] })];
    commands = workflows.map(workflow => toConfigurationWorkflowCommand(workflow));
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
    fixture.componentInstance.prepareForDirectSave('southId1', southSettings, scanModes, manifest, groups, addOrEditGroup, deleteGroup);
    fixture.detectChanges();
    return fixture;
  }

  test('should load and render every workflow for the south connector', async () => {
    const fixture = createComponent();

    expect(configurationWorkflowService.list).toHaveBeenCalledWith('southId1');
    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.modal-title')).toMatchTextContent('Configuration workflows (2)');
    await expect.element(root.getByCss('tbody')).toMatchTextContent('Alpha');
    await expect.element(root.getByCss('tbody')).toMatchTextContent('Beta');
  });

  test('should offer run now and run history for every workflow in direct mode', async () => {
    const fixture = createComponent();

    await expect.element(page.elementLocator(fixture.nativeElement).getByCss('.run-workflow').first()).toBeInTheDocument();
    expect(fixture.nativeElement.querySelectorAll('.run-workflow').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.history-workflow').length).toBe(2);
  });

  test('should show a manual-only placeholder and the local/remote mode for each workflow', async () => {
    const fixture = createComponent();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('tbody')).toMatchTextContent('Manual only');
    await expect.element(root.getByCss('tbody')).toMatchTextContent('Create/update items locally');
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
    expect(fixture.componentInstance.workflows).toContainEqual(toConfigurationWorkflowCommand(createdWorkflow));
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

    fixture.componentInstance.onEdit(commands[0]);

    expect(configurationWorkflowService.update).toHaveBeenCalledWith('southId1', 'workflow1', { name: 'Alpha renamed' });
    expect(fixture.componentInstance.workflows.find(w => w.id === 'workflow1')!.name).toBe('Alpha renamed');
    expect(notificationService.success).toHaveBeenCalledWith('south.workflows.updated');
  });

  test('should open the edit modal pre-filled to duplicate a workflow and create it on confirm', () => {
    const fixture = createComponent();
    const duplicatedWorkflow = buildWorkflow('workflow3', 'Alpha-copy');
    configurationWorkflowService.create.mockReturnValue(of(duplicatedWorkflow));
    const editModalInstance = { prepareForCopy: vi.fn() };
    modalService.open.mockReturnValue({ componentInstance: editModalInstance, result: of({ name: 'Alpha-copy' }) } as never);

    fixture.componentInstance.onDuplicate(commands[0]);

    // The very list this modal displays (checked by reference - the created copy has since been pushed onto it).
    expect(editModalInstance.prepareForCopy).toHaveBeenCalledWith(
      scanModes,
      fixture.componentInstance.workflows,
      manifest,
      commands[0],
      'southId1',
      southSettings,
      groups,
      addOrEditGroup,
      deleteGroup
    );
    expect((editModalInstance as { directSave?: boolean }).directSave).toBe(true);
    expect(configurationWorkflowService.create).toHaveBeenCalledWith('southId1', { name: 'Alpha-copy' });
    expect(fixture.componentInstance.workflows).toContainEqual(toConfigurationWorkflowCommand(duplicatedWorkflow));
    expect(notificationService.success).toHaveBeenCalledWith('south.workflows.created');
  });

  test('should confirm, delete, and remove the workflow from the list', () => {
    const fixture = createComponent();
    confirmationService.confirm.mockReturnValue(of(undefined));
    configurationWorkflowService.delete.mockReturnValue(of(undefined));

    fixture.componentInstance.onDelete(commands[0]);

    expect(configurationWorkflowService.delete).toHaveBeenCalledWith('southId1', 'workflow1');
    expect(fixture.componentInstance.workflows.find(w => w.id === 'workflow1')).toBeUndefined();
    expect(notificationService.success).toHaveBeenCalledWith('south.workflows.deleted');
  });

  test('should show a delete error notification on failure', () => {
    const fixture = createComponent();
    confirmationService.confirm.mockReturnValue(of(undefined));
    configurationWorkflowService.delete.mockReturnValue(throwError(() => ({ error: { message: 'boom' } })));

    fixture.componentInstance.onDelete(commands[0]);

    expect(notificationService.error).toHaveBeenCalledWith('south.workflows.delete-error', { error: 'boom' });
  });

  test('should run a workflow now and show a success notification', () => {
    const fixture = createComponent();
    configurationWorkflowService.runNow.mockReturnValue(of({}) as never);

    fixture.componentInstance.onRunNow(commands[0]);

    expect(configurationWorkflowService.runNow).toHaveBeenCalledWith('southId1', 'workflow1');
    expect(notificationService.success).toHaveBeenCalledWith('south.workflows.run-now-success');
    expect(fixture.componentInstance.runningWorkflowId).toBeNull();
  });

  test('should show a run-now error notification on failure', () => {
    const fixture = createComponent();
    configurationWorkflowService.runNow.mockReturnValue(throwError(() => ({ error: { message: 'not running' } })));

    fixture.componentInstance.onRunNow(commands[0]);

    expect(notificationService.error).toHaveBeenCalledWith('south.workflows.run-now-error', { error: 'not running' });
  });

  test('should call onWorkflowRun after a successful run, so the display page behind this modal reloads', () => {
    const fixture = TestBed.createComponent(ManageWorkflowsModalComponent);
    const onWorkflowRun = vi.fn();
    fixture.componentInstance.prepareForDirectSave(
      'southId1',
      southSettings,
      scanModes,
      manifest,
      groups,
      addOrEditGroup,
      deleteGroup,
      onWorkflowRun
    );
    fixture.detectChanges();
    configurationWorkflowService.runNow.mockReturnValue(of({}) as never);

    fixture.componentInstance.onRunNow(commands[0]);

    expect(onWorkflowRun).toHaveBeenCalled();
  });

  test('should not call onWorkflowRun when the run fails', () => {
    const fixture = TestBed.createComponent(ManageWorkflowsModalComponent);
    const onWorkflowRun = vi.fn();
    fixture.componentInstance.prepareForDirectSave(
      'southId1',
      southSettings,
      scanModes,
      manifest,
      groups,
      addOrEditGroup,
      deleteGroup,
      onWorkflowRun
    );
    fixture.detectChanges();
    configurationWorkflowService.runNow.mockReturnValue(throwError(() => ({ error: { message: 'not running' } })));

    fixture.componentInstance.onRunNow(commands[0]);

    expect(onWorkflowRun).not.toHaveBeenCalled();
  });

  test('should open the preview modal immediately, letting it fetch the preview itself', () => {
    const fixture = createComponent();
    const previewModalInstance = { prepareForPreview: vi.fn() };
    modalService.open.mockReturnValue({ componentInstance: previewModalInstance } as never);

    fixture.componentInstance.onPreview(commands[0]);

    expect(modalService.open).toHaveBeenCalledWith(expect.anything(), { size: 'xl' });
    expect(previewModalInstance.prepareForPreview).toHaveBeenCalledWith('southId1', 'workflow1', 'Alpha');
    // The request itself is PreviewWorkflowModalComponent's own responsibility now - this modal is
    // opened up front, with its own loading spinner, rather than waiting on it here first.
    expect(configurationWorkflowService.preview).not.toHaveBeenCalled();
  });

  test('should navigate to the run history page and close the modal', () => {
    const fixture = createComponent();

    fixture.componentInstance.onViewHistory(commands[0]);

    expect(activeModal.close).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/south', 'southId1', 'workflows', 'workflow1', 'history']);
  });

  test('should close the modal', () => {
    const fixture = createComponent();

    fixture.componentInstance.close();

    expect(activeModal.close).toHaveBeenCalled();
  });
  describe('in-memory mode', () => {
    function createInMemoryComponent(southId = 'create') {
      const fixture = TestBed.createComponent(ManageWorkflowsModalComponent);
      fixture.componentInstance.prepareForInMemory(
        commands,
        southId,
        southSettings,
        scanModes,
        manifest,
        groups,
        addOrEditGroup,
        deleteGroup
      );
      fixture.detectChanges();
      return fixture;
    }

    test("should display the page's own workflows without loading anything, resolving scan mode names by id", async () => {
      commands[1].scanModeId = scanModes[0].id;
      const fixture = createInMemoryComponent();

      expect(configurationWorkflowService.list).not.toHaveBeenCalled();
      expect(fixture.componentInstance.loading).toBe(false);
      expect(fixture.componentInstance.getScanModeName(commands[1])).toBe(scanModes[0].name);
      expect(fixture.componentInstance.getScanModeName(commands[0])).toBeNull();
      const root = page.elementLocator(fixture.nativeElement);
      await expect.element(root.getByCss('.modal-title')).toMatchTextContent('Configuration workflows (2)');
      await expect.element(root.getByCss('tbody')).toMatchTextContent(scanModes[0].name);
    });

    test('should not offer run now nor run history, only preview/edit/duplicate/delete', async () => {
      const fixture = createInMemoryComponent();

      const root = page.elementLocator(fixture.nativeElement);
      await expect.element(root.getByCss('.preview-workflow').first()).toBeInTheDocument();
      expect(fixture.nativeElement.querySelector('.run-workflow')).toBeNull();
      expect(fixture.nativeElement.querySelector('.history-workflow')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.edit-workflow').length).toBe(2);
      expect(fixture.nativeElement.querySelectorAll('.duplicate-workflow').length).toBe(2);
      expect(fixture.nativeElement.querySelectorAll('.delete-workflow').length).toBe(2);
    });

    test("should add a workflow to the page's own array with a temp id, without calling the backend", () => {
      const fixture = createInMemoryComponent();
      const editModalInstance = { prepareForCreation: vi.fn() };
      modalService.open.mockReturnValue({ componentInstance: editModalInstance, result: of(buildCommand(null, 'Gamma')) } as never);

      fixture.componentInstance.onAdd();

      expect(editModalInstance.prepareForCreation).toHaveBeenCalledWith(
        scanModes,
        commands,
        manifest,
        'create',
        southSettings,
        groups,
        addOrEditGroup,
        deleteGroup
      );
      expect((editModalInstance as { directSave?: boolean }).directSave).toBe(false);
      expect(configurationWorkflowService.create).not.toHaveBeenCalled();
      expect(commands.length).toBe(3);
      expect(commands[2].name).toBe('Gamma');
      expect(commands[2].id).toMatch(/^temp_/);
      expect(fixture.componentInstance.displayedWorkflows.map(w => w.name)).toContain('Gamma');
      expect(notificationService.success).not.toHaveBeenCalled();
    });

    test("should replace the edited workflow in the page's own array, keeping its id", () => {
      const fixture = createInMemoryComponent();
      modalService.open.mockReturnValue({
        componentInstance: { prepareForEdition: vi.fn() },
        result: of(buildCommand('workflow1', 'Alpha renamed'))
      } as never);

      fixture.componentInstance.onEdit(commands[0]);

      expect(configurationWorkflowService.update).not.toHaveBeenCalled();
      expect(commands[0]).toEqual(expect.objectContaining({ id: 'workflow1', name: 'Alpha renamed' }));
      expect(commands.length).toBe(2);
    });

    test("should add a duplicate to the page's own array with a fresh temp id", () => {
      const fixture = createInMemoryComponent();
      modalService.open.mockReturnValue({
        componentInstance: { prepareForCopy: vi.fn() },
        result: of(buildCommand(null, 'Alpha-copy'))
      } as never);

      fixture.componentInstance.onDuplicate(commands[0]);

      expect(configurationWorkflowService.create).not.toHaveBeenCalled();
      expect(commands.length).toBe(3);
      expect(commands[2]).toEqual(expect.objectContaining({ name: 'Alpha-copy' }));
      expect(commands[2].id).toMatch(/^temp_/);
    });

    test("should confirm then remove the workflow from the page's own array, without calling the backend", () => {
      const fixture = createInMemoryComponent();
      confirmationService.confirm.mockReturnValue(of(undefined));

      fixture.componentInstance.onDelete(commands[0]);

      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(configurationWorkflowService.delete).not.toHaveBeenCalled();
      expect(commands.map(w => w.id)).toEqual(['workflow2']);
      expect(fixture.componentInstance.displayedWorkflows.map(w => w.id)).toEqual(['workflow2']);
    });

    test('should preview a persisted workflow as currently edited, against its previous run', () => {
      const fixture = createInMemoryComponent('southId1');
      const previewModalInstance = { prepareForCommandPreview: vi.fn() };
      modalService.open.mockReturnValue({ componentInstance: previewModalInstance } as never);

      fixture.componentInstance.onPreview(commands[0]);

      expect(previewModalInstance.prepareForCommandPreview).toHaveBeenCalledWith(
        'southId1',
        manifest.id,
        southSettings,
        'workflow1',
        commands[0],
        'Alpha'
      );
      expect(configurationWorkflowService.preview).not.toHaveBeenCalled();
    });

    test('should preview a not-yet-saved (temp id) workflow with no persisted workflow id', () => {
      const unsaved = buildCommand('temp_123', 'Unsaved');
      commands.push(unsaved);
      const fixture = createInMemoryComponent();
      const previewModalInstance = { prepareForCommandPreview: vi.fn() };
      modalService.open.mockReturnValue({ componentInstance: previewModalInstance } as never);

      fixture.componentInstance.onPreview(unsaved);

      expect(previewModalInstance.prepareForCommandPreview).toHaveBeenCalledWith(
        'create',
        manifest.id,
        southSettings,
        null,
        unsaved,
        'Unsaved'
      );
    });

    test('should never run a workflow nor open its history', () => {
      const fixture = createInMemoryComponent();

      fixture.componentInstance.onRunNow(commands[0]);
      fixture.componentInstance.onViewHistory(commands[0]);

      expect(configurationWorkflowService.runNow).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
