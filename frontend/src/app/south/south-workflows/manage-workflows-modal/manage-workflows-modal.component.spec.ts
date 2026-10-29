import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { ConfigurationWorkflowCommandDTO, ConfigurationWorkflowDTO } from '@oibus/shared/api/configuration-workflow.model';
import { WorkflowRunDTO } from '@oibus/shared/api/workflow-run.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup, buildWorkflow, buildWorkflowCommand } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { MockModalService, provideModalTesting } from '../../../shared/mock-modal.service.testing';
import { NotificationService } from '../../../shared/notification.service';
import { FakeSouthItemGroups, fakeSouthItemGroups } from '../../south-items/south-item-groups.testing';
import EditWorkflowModalComponent from '../edit-workflow-modal/edit-workflow-modal.component';
import { toConfigurationWorkflowCommand } from '../workflow-command';
import ManageWorkflowsModalComponent from './manage-workflows-modal.component';

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
  readonly homeTitle = this.root.getByRole('heading', { level: 4 });
  readonly title = this.root.getByRole('heading', { level: 5 });
  readonly exploreButton = this.root.getByCss('#explore');
  readonly spinner = this.root.getByRole('status');
  readonly addButton = this.root.getByRole('button', { name: 'New synchronisation' });
  readonly closeButton = this.root.getByRole('button', { name: 'Close' });
  readonly search = this.root.getByPlaceholder('Search synchronisations by name');
  readonly rows = this.root.getByCss('tbody tr');
  readonly none = this.root.getByCss('#no-workflow');
  readonly noMatch = this.root.getByText('No items synchronisation matches the current filters');
  readonly runButtons = this.root.getByRole('button', { name: 'Run now' });
  readonly historyButtons = this.root.getByRole('button', { name: 'Past runs' });

  row(index: number) {
    return this.rows.nth(index);
  }

  rowButton(index: number, name: 'Run now' | 'Past runs' | 'Edit items synchronisation' | 'Duplicate' | 'Delete') {
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
  let groups: FakeSouthItemGroups;
  let commands: Array<ConfigurationWorkflowCommandDTO>;
  let tester: ManageWorkflowsModalComponentTester;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    router = createMock(Router);
    groups = fakeSouthItemGroups([buildSouthItemGroup('group1', 'Group 1')]);
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

  describe('direct mode', () => {
    let onWorkflowRun: Mock<() => void>;

    beforeEach(() => {
      onWorkflowRun = vi.fn();
      tester.fixture.componentInstance.prepareForDirectSave('southId1', southSettings, scanModes, manifest, groups, [], onWorkflowRun);
    });

    test('should load and render every workflow of the south connector', async () => {
      expect(configurationWorkflowService.list).toHaveBeenCalledWith('southId1');
      await expect.element(tester.title).toHaveTextContent('Items synchronisations (2)');
      await expect.element(tester.rows).toHaveLength(2);
      await expect.element(tester.row(0)).toMatchTextContent(/Alpha\s*Whole data source\s*Manual only\s*Create\/update items locally/);
      await expect
        .element(tester.row(1))
        .toMatchTextContent(new RegExp(`Beta\\s*Whole data source\\s*${scanModes[0].name}\\s*Push to OIAnalytics`));
      // a workflow with no schedule only runs on demand: there is nothing to enable
      await expect.element(tester.row(0).getByRole('img')).not.toBeInTheDocument();
      await expect.element(tester.row(0).getByCss('.workflow-not-scheduled')).toHaveTextContent('-');
      await expect.element(tester.row(1).getByRole('img', { name: 'Yes' })).toBeInTheDocument();
    });

    test('should show a spinner while loading', async () => {
      const workflows$ = new Subject<Array<ConfigurationWorkflowDTO>>();
      configurationWorkflowService.list.mockReturnValue(workflows$);
      const loadingTester = new ManageWorkflowsModalComponentTester();
      loadingTester.fixture.componentInstance.prepareForDirectSave('southId1', southSettings, scanModes, manifest, groups, []);

      await expect.element(loadingTester.spinner).toBeInTheDocument();

      workflows$.next([]);
      await expect.element(loadingTester.none).toBeInTheDocument();
      await expect.element(loadingTester.spinner).not.toBeInTheDocument();
    });

    test('should offer run now and the past runs for every workflow', async () => {
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
        groups
      );
      expect(configurationWorkflowService.create).toHaveBeenCalledWith('southId1', command);
      expect(notificationService.success).toHaveBeenCalledWith('south.workflows.created');
      await expect.element(tester.rows).toHaveLength(3);
      await expect.element(tester.title).toHaveTextContent('Items synchronisations (3)');
    });

    test('should edit a workflow through the edit modal and update it', async () => {
      const command = buildWorkflowCommand('workflow1', 'Alpha renamed');
      const editModal = mockEditModal(command);
      configurationWorkflowService.update.mockReturnValue(of(buildWorkflow('workflow1', 'Alpha renamed')));

      await tester.rowButton(0, 'Edit items synchronisation').click();

      expect(editModal.prepareForEdition).toHaveBeenCalledWith(
        scanModes,
        expect.any(Array),
        manifest,
        commands[0],
        'southId1',
        southSettings,
        groups
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
        groups
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

    test('should navigate to the past runs page and close the modal', async () => {
      await tester.rowButton(0, 'Past runs').click();

      expect(activeModal.close).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/south', 'southId1', 'workflows', 'workflow1', 'history']);
    });

    test('should close the modal', async () => {
      await tester.closeButton.click();

      expect(activeModal.close).toHaveBeenCalled();
    });
  });

  describe('in-memory mode', () => {
    /** The workflows of the page */
    let pageWorkflows: WritableSignal<Array<ConfigurationWorkflowCommandDTO>>;

    function prepareInMemory(southId = 'create') {
      pageWorkflows = signal(commands);
      tester.fixture.componentInstance.prepareForInMemory(pageWorkflows, southId, southSettings, scanModes, manifest, groups, []);
    }

    test("should display the page's own workflows without loading anything, resolving scan mode names by id", async () => {
      prepareInMemory();

      expect(configurationWorkflowService.list).not.toHaveBeenCalled();
      await expect.element(tester.title).toHaveTextContent('Items synchronisations (2)');
      await expect.element(tester.row(0)).toMatchTextContent('Manual only');
      await expect.element(tester.row(1)).toMatchTextContent(scanModes[0].name);
    });

    test('should show a message when there is no workflow', async () => {
      commands = [];
      prepareInMemory();

      await expect.element(tester.none).toBeInTheDocument();
    });

    test('should not offer run now nor run history, only edit/duplicate/delete', async () => {
      prepareInMemory();

      await expect.element(tester.rowButton(0, 'Edit items synchronisation')).toBeInTheDocument();
      await expect.element(tester.rowButton(0, 'Duplicate')).toBeInTheDocument();
      await expect.element(tester.rowButton(0, 'Delete')).toBeInTheDocument();
      await expect.element(tester.runButtons).not.toBeInTheDocument();
      await expect.element(tester.historyButtons).not.toBeInTheDocument();
    });

    test('should show the workflows changed by the page', async () => {
      prepareInMemory();

      pageWorkflows.update(workflows => workflows.slice(1));

      await expect.element(tester.rows).toHaveLength(1);
      await expect.element(tester.row(0)).toMatchTextContent('Beta');
    });

    test("should add a workflow to the page's workflows with a temp id, without calling the backend", async () => {
      prepareInMemory();
      const editModal = mockEditModal(buildWorkflowCommand(null, 'Gamma'));

      await tester.addButton.click();

      expect(editModal.directSave).toBe(false);
      expect(editModal.prepareForCreation).toHaveBeenCalledWith(scanModes, commands, manifest, 'create', southSettings, groups);
      expect(configurationWorkflowService.create).not.toHaveBeenCalled();
      expect(notificationService.success).not.toHaveBeenCalled();
      expect(pageWorkflows()).toHaveLength(3);
      expect(pageWorkflows()[2]).toEqual(expect.objectContaining({ name: 'Gamma', id: expect.stringMatching(/^temp_/) }));
      await expect.element(tester.row(2)).toMatchTextContent('Gamma');
    });

    test("should replace the edited workflow in the page's workflows, keeping its id", async () => {
      prepareInMemory();
      mockEditModal(buildWorkflowCommand(null, 'Alpha renamed'));

      await tester.rowButton(0, 'Edit items synchronisation').click();

      expect(configurationWorkflowService.update).not.toHaveBeenCalled();
      expect(pageWorkflows()[0]).toEqual(expect.objectContaining({ id: 'workflow1', name: 'Alpha renamed' }));
      expect(pageWorkflows()).toHaveLength(2);
      await expect.element(tester.row(0)).toMatchTextContent('Alpha renamed');
    });

    test("should add a duplicate to the page's workflows with a fresh temp id", async () => {
      prepareInMemory();
      mockEditModal(buildWorkflowCommand(null, 'Alpha-copy'));

      await tester.rowButton(0, 'Duplicate').click();

      expect(configurationWorkflowService.create).not.toHaveBeenCalled();
      expect(pageWorkflows()).toHaveLength(3);
      expect(pageWorkflows()[2]).toEqual(expect.objectContaining({ name: 'Alpha-copy', id: expect.stringMatching(/^temp_/) }));
    });

    test("should confirm then remove the workflow from the page's workflows, without calling the backend", async () => {
      prepareInMemory();
      confirmationService.confirm.mockReturnValue(of(undefined));

      await tester.rowButton(0, 'Delete').click();

      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(configurationWorkflowService.delete).not.toHaveBeenCalled();
      expect(pageWorkflows().map(workflow => workflow.id)).toEqual(['workflow2']);
      await expect.element(tester.rows).toHaveLength(1);
    });
  });
  describe('explore and sync', () => {
    const treeManifest = {
      ...manifest,
      explore: true,
      discovery: { kind: 'tree' as const, defaults: { identityKeyFields: ['id'], itemFieldMapping: { name: '{{path}}' } } }
    };
    const scoped = (id: string, name: string, discoveryScope: Record<string, unknown>) =>
      toConfigurationWorkflowCommand(buildWorkflow(id, name, { discoveryScope }));
    let wizard: MockObject<EditWorkflowModalComponent>;

    function prepare(directSave = true, items: Array<{ name: string; settings: never }> = []) {
      commands = [
        scoped('workflow1', 'Reactor sync', { nodeIds: ['ns=1;s=Reactor', 'ns=1;s=Boiler'] }),
        scoped('workflow2', 'Everything', {}),
        scoped('workflow3', 'Tables', { query: 'SELECT 1' })
      ];
      if (directSave) {
        configurationWorkflowService.list.mockReturnValue(
          of(commands.map(command => buildWorkflow(command.id!, command.name, { discoveryScope: command.discoveryScope })))
        );
        tester.fixture.componentInstance.prepareForDirectSave('southId1', southSettings, scanModes, treeManifest, groups, items);
      } else {
        tester.fixture.componentInstance.prepareForInMemory(
          signal(commands),
          'create',
          southSettings,
          scanModes,
          treeManifest,
          groups,
          items
        );
      }
    }

    function mockWizard(result?: unknown) {
      wizard = createMock(EditWorkflowModalComponent);
      if (result === undefined) {
        modalService.mockDismissedModal(wizard);
      } else {
        modalService.mockClosedModal(wizard, result);
      }
    }

    test('should be titled Explore and sync, and say what each synchronisation discovers from', async () => {
      prepare();

      await expect.element(tester.homeTitle).toHaveTextContent('Explore and sync');
      await expect.element(tester.row(0)).toMatchTextContent('2 node(s)');
      await expect.element(tester.row(1)).toMatchTextContent('Whole data source');
      await expect.element(tester.row(2)).toMatchTextContent('SQL query');
    });

    test('should explore the data source in the wizard, with what it needs to add items and keep them in sync', async () => {
      mockWizard();
      prepare(true, [{ name: 'item', settings: {} as never }]);

      await tester.exploreButton.click();

      expect(wizard.prepareForExploration).toHaveBeenCalledWith({
        southId: 'southId1',
        exploreConnectorId: 'southId1',
        southSettings,
        manifest: treeManifest,
        schedule: { scanModes, groups },
        existingItems: [{ name: 'item', settings: {} }],
        sync: { directSave: true, existingWorkflows: commands }
      });
    });

    test('should explore a connector being created without a session to scope', async () => {
      mockWizard();
      prepare(false);

      await tester.exploreButton.click();

      expect(wizard.prepareForExploration).toHaveBeenCalledWith(
        expect.objectContaining({ southId: 'create', exploreConnectorId: null, sync: { directSave: false, existingWorkflows: commands } })
      );
    });

    test('should close with the items the wizard gave, for the page to save', async () => {
      const items = [testData.south.itemCommand];
      mockWizard({ kind: 'items', commands: items });
      prepare();

      await tester.exploreButton.click();

      expect(activeModal.close).toHaveBeenCalledWith({ kind: 'items', commands: items });
    });

    test('should create the workflow the wizard gave, and stay open', async () => {
      const command = buildWorkflowCommand(null, 'Boiler sync');
      mockWizard({ kind: 'workflow', command });
      configurationWorkflowService.create.mockReturnValue(of(buildWorkflow('workflow4', 'Boiler sync')));
      prepare();

      await tester.exploreButton.click();

      expect(configurationWorkflowService.create).toHaveBeenCalledWith('southId1', command);
      expect(activeModal.close).not.toHaveBeenCalled();
      await expect.element(tester.rows).toHaveLength(4);
    });

    test('should update the workflow the wizard gave when it is one of the list', async () => {
      const command = { ...commands[0], name: 'Reactor sync renamed' };
      mockWizard({ kind: 'workflow', command: { ...command, id: 'workflow1' } });
      configurationWorkflowService.update.mockReturnValue(of(buildWorkflow('workflow1', 'Reactor sync renamed')));
      prepare();

      await tester.exploreButton.click();

      expect(configurationWorkflowService.update).toHaveBeenCalledWith(
        'southId1',
        'workflow1',
        expect.objectContaining({ id: 'workflow1' })
      );
      await expect.element(tester.row(0)).toMatchTextContent('Reactor sync renamed');
    });

    test('should start a new synchronisation from the wizard, which only offers to keep in sync', async () => {
      mockWizard();
      prepare();

      await tester.addButton.click();

      expect(wizard.prepareForExploration).toHaveBeenCalledWith(expect.objectContaining({ syncOnly: true }));
      expect(wizard.prepareForCreation).not.toHaveBeenCalled();
    });

    test('should edit and duplicate a synchronisation from the Explore step of the wizard, with its nodes checked', async () => {
      mockWizard();
      prepare();

      await tester.rowButton(0, 'Edit items synchronisation').click();
      expect(wizard.prepareForExploration).toHaveBeenLastCalledWith(
        expect.objectContaining({ workflow: { command: commands[0], mode: 'edit' } })
      );

      mockWizard();
      await tester.rowButton(0, 'Duplicate').click();
      expect(wizard.prepareForExploration).toHaveBeenLastCalledWith(
        expect.objectContaining({ workflow: { command: commands[0], mode: 'copy' } })
      );
      expect(wizard.prepareForEdition).not.toHaveBeenCalled();
    });

    test('should keep the wizard for a connector that discovers from a query: no node to check', async () => {
      const queryManifest = { ...treeManifest, discovery: { kind: 'query' as const } };
      commands = [scoped('workflow3', 'Tables', { query: 'SELECT 1' })];
      configurationWorkflowService.list.mockReturnValue(
        of([buildWorkflow('workflow3', 'Tables', { discoveryScope: { query: 'SELECT 1' } })])
      );
      tester.fixture.componentInstance.prepareForDirectSave('southId1', southSettings, scanModes, queryManifest, groups, []);
      mockWizard(buildWorkflowCommand(null, 'Gamma'));
      configurationWorkflowService.create.mockReturnValue(of(buildWorkflow('workflow5', 'Gamma')));

      await tester.addButton.click();
      expect(wizard.prepareForCreation).toHaveBeenCalled();
      expect(wizard.prepareForExploration).not.toHaveBeenCalled();

      mockWizard();
      await tester.rowButton(0, 'Edit items synchronisation').click();
      expect(wizard.prepareForEdition).toHaveBeenCalled();
    });
  });
});
