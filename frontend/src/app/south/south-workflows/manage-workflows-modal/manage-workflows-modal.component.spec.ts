import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { ConfigurationWorkflowCommandDTO, ConfigurationWorkflowDTO } from '@oibus/shared/api/configuration-workflow.model';
import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';
import { WorkflowRunDTO } from '@oibus/shared/api/workflow-run.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup, buildWorkflow, buildWorkflowCommand } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { MockModalService, provideModalTesting } from '../../../shared/mock-modal.service.testing';
import { NotificationService } from '../../../shared/notification.service';
import EditWorkflowModalComponent from '../edit-workflow-modal/edit-workflow-modal.component';
import PreviewWorkflowModalComponent from '../preview-workflow-modal/preview-workflow-modal.component';
import ManageWorkflowsModalComponent, { toConfigurationWorkflowCommand } from './manage-workflows-modal.component';

type AddOrEditGroup = (command: {
  mode: 'create' | 'edit';
  group: SouthItemGroupCommandDTO;
}) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
type DeleteGroup = (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>;

const scanModes = testData.scanMode.list;
const manifest = testData.south.manifest;
const southSettings = testData.south.list[0].settings;
const workflowRun: WorkflowRunDTO = {
  id: 'runId1',
  workflowId: 'workflow1',
  triggerType: 'manual',
  status: 'COMPLETED',
  startedAt: '',
  completedAt: '',
  error: null,
  triggeredBy: null,
  discoveredCount: 0,
  eligibleCount: 0,
  createdCount: 0,
  updatedCount: 0,
  disabledCount: 0,
  pushedCount: 0
};

class ManageWorkflowsModalComponentTester {
  readonly fixture = TestBed.createComponent(ManageWorkflowsModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly spinner = this.root.getByRole('status');
  readonly addButton = this.root.getByRole('button', { name: 'Create a new configuration workflow' });
  readonly closeButton = this.root.getByRole('button', { name: 'Close' });
  readonly search = this.root.getByPlaceholder('Search workflows by name');
  readonly rows = this.root.getByCss('tbody tr');
  readonly none = this.root.getByText('No configuration workflows for this south connector');
  readonly noMatch = this.root.getByText('No configuration workflows match the current filters');
  readonly runButtons = this.root.getByRole('button', { name: 'Run now' });
  readonly historyButtons = this.root.getByRole('button', { name: 'Run history' });

  row(index: number) {
    return this.rows.nth(index);
  }

  rowButton(index: number, name: 'Run now' | 'Preview' | 'Run history' | 'Edit configuration workflow' | 'Duplicate' | 'Delete') {
    return this.row(index).getByRole('button', { name });
  }
}

describe('ManageWorkflowsModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let router: MockObject<Router>;
  let modalService: MockModalService<unknown>;
  let groups: Array<SouthItemGroupDTO>;
  let addOrEditGroup: Mock<AddOrEditGroup>;
  let deleteGroup: Mock<DeleteGroup>;
  let commands: Array<ConfigurationWorkflowCommandDTO>;
  let tester: ManageWorkflowsModalComponentTester;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    router = createMock(Router);
    groups = [buildSouthItemGroup('group1', 'Group 1')];
    addOrEditGroup = vi.fn<AddOrEditGroup>();
    deleteGroup = vi.fn<DeleteGroup>();
    const workflows = [
      buildWorkflow('workflow1', 'Alpha'),
      buildWorkflow('workflow2', 'Beta', { scanMode: scanModes[0], pushToOIAnalytics: true })
    ];
    commands = workflows.map(workflow => toConfigurationWorkflowCommand(workflow));
    configurationWorkflowService.list.mockReturnValue(of(workflows));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: Router, useValue: router }
      ]
    });

    modalService = TestBed.inject(MockModalService);
    tester = new ManageWorkflowsModalComponentTester();
  });

  function mockEditModal(result: ConfigurationWorkflowCommandDTO) {
    const editModal = createMock(EditWorkflowModalComponent);
    modalService.mockClosedModal(editModal, result);
    return editModal;
  }

  function mockPreviewModal() {
    const previewModal = createMock(PreviewWorkflowModalComponent);
    modalService.mockClosedModal(previewModal);
    return previewModal;
  }

  describe('direct mode', () => {
    let onWorkflowRun: Mock<() => void>;

    beforeEach(() => {
      onWorkflowRun = vi.fn();
      tester.fixture.componentInstance.prepareForDirectSave(
        'southId1',
        southSettings,
        scanModes,
        manifest,
        groups,
        addOrEditGroup,
        deleteGroup,
        onWorkflowRun
      );
    });

    test('should load and render every workflow of the south connector', async () => {
      expect(configurationWorkflowService.list).toHaveBeenCalledWith('southId1');
      await expect.element(tester.title).toHaveTextContent('Configuration workflows (2)');
      await expect.element(tester.rows).toHaveLength(2);
      await expect.element(tester.row(0)).toMatchTextContent(/Alpha\s*Manual only\s*Create\/update items locally/);
      await expect.element(tester.row(1)).toMatchTextContent(new RegExp(`Beta\\s*${scanModes[0].name}\\s*Push to OIAnalytics`));
      await expect.element(tester.row(0).getByRole('img', { name: 'Yes' })).toBeInTheDocument();
    });

    test('should show a spinner while loading', async () => {
      const workflows$ = new Subject<Array<ConfigurationWorkflowDTO>>();
      configurationWorkflowService.list.mockReturnValue(workflows$);
      const loadingTester = new ManageWorkflowsModalComponentTester();
      loadingTester.fixture.componentInstance.prepareForDirectSave(
        'southId1',
        southSettings,
        scanModes,
        manifest,
        groups,
        addOrEditGroup,
        deleteGroup
      );

      await expect.element(loadingTester.spinner).toBeInTheDocument();

      workflows$.next([]);
      await expect.element(loadingTester.none).toBeInTheDocument();
      await expect.element(loadingTester.spinner).not.toBeInTheDocument();
    });

    test('should offer run now and run history for every workflow', async () => {
      await expect.element(tester.runButtons).toHaveLength(2);
      await expect.element(tester.historyButtons).toHaveLength(2);
    });

    test('should filter the displayed workflows by name', async () => {
      await tester.search.fill('alp');
      await expect.element(tester.rows).toHaveLength(1);
      await expect.element(tester.row(0)).toMatchTextContent('Alpha');

      await tester.search.fill('nothing');
      await expect.element(tester.noMatch).toBeInTheDocument();
    });

    test('should add a workflow through the edit modal and create it', async () => {
      const command = buildWorkflowCommand(null, 'Gamma');
      const editModal = mockEditModal(command);
      configurationWorkflowService.create.mockReturnValue(of(buildWorkflow('workflow3', 'Gamma')));

      await tester.addButton.click();

      expect(editModal.directSave).toBe(true);
      expect(editModal.prepareForCreation).toHaveBeenCalledWith(
        scanModes,
        expect.arrayContaining(commands),
        manifest,
        'southId1',
        southSettings,
        groups,
        addOrEditGroup,
        deleteGroup
      );
      expect(configurationWorkflowService.create).toHaveBeenCalledWith('southId1', command);
      expect(notificationService.success).toHaveBeenCalledWith('south.workflows.created');
      await expect.element(tester.rows).toHaveLength(3);
      await expect.element(tester.title).toHaveTextContent('Configuration workflows (3)');
    });

    test('should edit a workflow through the edit modal and update it', async () => {
      const command = buildWorkflowCommand('workflow1', 'Alpha renamed');
      const editModal = mockEditModal(command);
      configurationWorkflowService.update.mockReturnValue(of(buildWorkflow('workflow1', 'Alpha renamed')));

      await tester.rowButton(0, 'Edit configuration workflow').click();

      expect(editModal.prepareForEdition).toHaveBeenCalledWith(
        scanModes,
        expect.any(Array),
        manifest,
        commands[0],
        'southId1',
        southSettings,
        groups,
        addOrEditGroup,
        deleteGroup
      );
      expect(configurationWorkflowService.update).toHaveBeenCalledWith('southId1', 'workflow1', command);
      expect(notificationService.success).toHaveBeenCalledWith('south.workflows.updated');
      await expect.element(tester.row(0)).toMatchTextContent('Alpha renamed');
    });

    test('should duplicate a workflow through the edit modal and create the copy', async () => {
      const command = buildWorkflowCommand(null, 'Alpha-copy');
      const editModal = mockEditModal(command);
      configurationWorkflowService.create.mockReturnValue(of(buildWorkflow('workflow3', 'Alpha-copy')));

      await tester.rowButton(0, 'Duplicate').click();

      expect(editModal.directSave).toBe(true);
      expect(editModal.prepareForCopy).toHaveBeenCalledWith(
        scanModes,
        expect.arrayContaining(commands),
        manifest,
        commands[0],
        'southId1',
        southSettings,
        groups,
        addOrEditGroup,
        deleteGroup
      );
      expect(configurationWorkflowService.create).toHaveBeenCalledWith('southId1', command);
      await expect.element(tester.row(2)).toMatchTextContent('Alpha-copy');
    });

    test('should confirm, delete, and remove the workflow from the list', async () => {
      confirmationService.confirm.mockReturnValue(of(undefined));
      configurationWorkflowService.delete.mockReturnValue(of(undefined));

      await tester.rowButton(0, 'Delete').click();

      expect(confirmationService.confirm).toHaveBeenCalledWith({
        messageKey: 'south.workflows.confirm-deletion',
        interpolateParams: { name: 'Alpha' }
      });
      expect(configurationWorkflowService.delete).toHaveBeenCalledWith('southId1', 'workflow1');
      expect(notificationService.success).toHaveBeenCalledWith('south.workflows.deleted');
      await expect.element(tester.rows).toHaveLength(1);
      await expect.element(tester.row(0)).toMatchTextContent('Beta');
    });

    test('should show a delete error notification on failure', async () => {
      confirmationService.confirm.mockReturnValue(of(undefined));
      configurationWorkflowService.delete.mockReturnValue(throwError(() => ({ error: { message: 'boom' } })));

      await tester.rowButton(0, 'Delete').click();

      expect(notificationService.error).toHaveBeenCalledWith('south.workflows.delete-error', { error: 'boom' });
      await expect.element(tester.rows).toHaveLength(2);
    });

    test('should run a workflow now, notify and let the page behind reload', async () => {
      const run$ = new Subject<WorkflowRunDTO>();
      configurationWorkflowService.runNow.mockReturnValue(run$);

      await tester.rowButton(0, 'Run now').click();

      expect(configurationWorkflowService.runNow).toHaveBeenCalledWith('southId1', 'workflow1');
      await expect.element(tester.rowButton(0, 'Run now')).toBeDisabled();
      await expect.element(tester.rowButton(1, 'Run now')).toBeEnabled();

      run$.next(workflowRun);
      run$.complete();

      await expect.element(tester.rowButton(0, 'Run now')).toBeEnabled();
      expect(notificationService.success).toHaveBeenCalledWith('south.workflows.run-now-success');
      expect(onWorkflowRun).toHaveBeenCalled();
    });

    test('should show a run-now error notification on failure, without reloading the page behind', async () => {
      configurationWorkflowService.runNow.mockReturnValue(throwError(() => ({ error: { message: 'not running' } })));

      await tester.rowButton(0, 'Run now').click();

      expect(notificationService.error).toHaveBeenCalledWith('south.workflows.run-now-error', { error: 'not running' });
      expect(onWorkflowRun).not.toHaveBeenCalled();
      await expect.element(tester.rowButton(0, 'Run now')).toBeEnabled();
    });

    test('should open the preview modal immediately, letting it fetch the preview itself', async () => {
      const previewModal = mockPreviewModal();
      const open = vi.spyOn(modalService, 'open');

      await tester.rowButton(0, 'Preview').click();

      expect(open).toHaveBeenCalledWith(PreviewWorkflowModalComponent, { size: 'xl' });
      expect(previewModal.prepareForPreview).toHaveBeenCalledWith('southId1', 'workflow1', 'Alpha');
      expect(configurationWorkflowService.preview).not.toHaveBeenCalled();
    });

    test('should navigate to the run history page and close the modal', async () => {
      await tester.rowButton(0, 'Run history').click();

      expect(activeModal.close).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/south', 'southId1', 'workflows', 'workflow1', 'history']);
    });

    test('should close the modal', async () => {
      await tester.closeButton.click();

      expect(activeModal.close).toHaveBeenCalled();
    });
  });

  describe('in-memory mode', () => {
    function prepareInMemory(southId = 'create') {
      tester.fixture.componentInstance.prepareForInMemory(
        commands,
        southId,
        southSettings,
        scanModes,
        manifest,
        groups,
        addOrEditGroup,
        deleteGroup
      );
    }

    test("should display the page's own workflows without loading anything, resolving scan mode names by id", async () => {
      prepareInMemory();

      expect(configurationWorkflowService.list).not.toHaveBeenCalled();
      await expect.element(tester.title).toHaveTextContent('Configuration workflows (2)');
      await expect.element(tester.row(0)).toMatchTextContent('Manual only');
      await expect.element(tester.row(1)).toMatchTextContent(scanModes[0].name);
    });

    test('should show a message when there is no workflow', async () => {
      commands = [];
      prepareInMemory();

      await expect.element(tester.none).toBeInTheDocument();
    });

    test('should not offer run now nor run history, only preview/edit/duplicate/delete', async () => {
      prepareInMemory();

      await expect.element(tester.rowButton(0, 'Preview')).toBeInTheDocument();
      await expect.element(tester.rowButton(0, 'Edit configuration workflow')).toBeInTheDocument();
      await expect.element(tester.rowButton(0, 'Duplicate')).toBeInTheDocument();
      await expect.element(tester.rowButton(0, 'Delete')).toBeInTheDocument();
      await expect.element(tester.runButtons).not.toBeInTheDocument();
      await expect.element(tester.historyButtons).not.toBeInTheDocument();
    });

    test("should add a workflow to the page's own array with a temp id, without calling the backend", async () => {
      prepareInMemory();
      const editModal = mockEditModal(buildWorkflowCommand(null, 'Gamma'));

      await tester.addButton.click();

      expect(editModal.directSave).toBe(false);
      expect(editModal.prepareForCreation).toHaveBeenCalledWith(
        scanModes,
        commands,
        manifest,
        'create',
        southSettings,
        groups,
        addOrEditGroup,
        deleteGroup
      );
      expect(configurationWorkflowService.create).not.toHaveBeenCalled();
      expect(notificationService.success).not.toHaveBeenCalled();
      expect(commands).toHaveLength(3);
      expect(commands[2]).toEqual(expect.objectContaining({ name: 'Gamma', id: expect.stringMatching(/^temp_/) }));
      await expect.element(tester.row(2)).toMatchTextContent('Gamma');
    });

    test("should replace the edited workflow in the page's own array, keeping its id", async () => {
      prepareInMemory();
      mockEditModal(buildWorkflowCommand(null, 'Alpha renamed'));

      await tester.rowButton(0, 'Edit configuration workflow').click();

      expect(configurationWorkflowService.update).not.toHaveBeenCalled();
      expect(commands[0]).toEqual(expect.objectContaining({ id: 'workflow1', name: 'Alpha renamed' }));
      expect(commands).toHaveLength(2);
      await expect.element(tester.row(0)).toMatchTextContent('Alpha renamed');
    });

    test("should add a duplicate to the page's own array with a fresh temp id", async () => {
      prepareInMemory();
      mockEditModal(buildWorkflowCommand(null, 'Alpha-copy'));

      await tester.rowButton(0, 'Duplicate').click();

      expect(configurationWorkflowService.create).not.toHaveBeenCalled();
      expect(commands).toHaveLength(3);
      expect(commands[2]).toEqual(expect.objectContaining({ name: 'Alpha-copy', id: expect.stringMatching(/^temp_/) }));
    });

    test("should confirm then remove the workflow from the page's own array, without calling the backend", async () => {
      prepareInMemory();
      confirmationService.confirm.mockReturnValue(of(undefined));

      await tester.rowButton(0, 'Delete').click();

      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(configurationWorkflowService.delete).not.toHaveBeenCalled();
      expect(commands.map(workflow => workflow.id)).toEqual(['workflow2']);
      await expect.element(tester.rows).toHaveLength(1);
    });

    test('should preview a persisted workflow as currently edited, against its previous run', async () => {
      prepareInMemory('southId1');
      const previewModal = mockPreviewModal();

      await tester.rowButton(0, 'Preview').click();

      expect(previewModal.prepareForCommandPreview).toHaveBeenCalledWith(
        'southId1',
        manifest.id,
        southSettings,
        'workflow1',
        commands[0],
        'Alpha'
      );
      expect(configurationWorkflowService.preview).not.toHaveBeenCalled();
    });

    test('should preview a not-yet-saved (temp id) workflow with no persisted workflow id', async () => {
      const unsaved = buildWorkflowCommand('temp_123', 'Unsaved');
      commands.push(unsaved);
      prepareInMemory();
      const previewModal = mockPreviewModal();

      await tester.rowButton(2, 'Preview').click();

      expect(previewModal.prepareForCommandPreview).toHaveBeenCalledWith('create', manifest.id, southSettings, null, unsaved, 'Unsaved');
    });
  });
});
