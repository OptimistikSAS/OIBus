import { ChangeDetectionStrategy, Component, computed, inject, signal, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { map, Observable, of, switchMap } from 'rxjs';

import { ConfigurationWorkflowCommandDTO } from '@oibus/shared/api/configuration-workflow.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { OIBusSouthType, SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';

import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { extractErrorMessage } from '../../../shared/extract-error-message';
import { ModalService } from '../../../shared/modal.service';
import { NotificationService } from '../../../shared/notification.service';
import { SouthItemGroups } from '../../south-items/south-item-groups';
import EditWorkflowModalComponent from '../edit-workflow-modal/edit-workflow-modal.component';
import PreviewWorkflowModalComponent from '../preview-workflow-modal/preview-workflow-modal.component';
import { TEMP_ID_PREFIX, toConfigurationWorkflowCommand } from '../workflow-command';
import { WorkflowCreationService } from '../workflow-creation.service';

/**
 * Lists a south connector's Configuration Workflows, in one of two modes (like ManageGroupsModalComponent's
 * own directSave):
 * - direct (prepareForDirectSave, from south-detail): every change is saved straight through the REST
 *   endpoints, and a workflow can also be run now, previewed as persisted, and have its run history opened.
 * - in memory (prepareForInMemory, from edit-south): add/edit/duplicate/delete only update the signal the
 *   page owns (saved along with the connector itself), and a preview runs the workflow as currently
 *   edited against the page's current, possibly unsaved, settings. No run, no history - there may not
 *   even be a persisted connector/workflow to run yet.
 * Both modes display the same command shape - persisted DTOs are converted on load.
 */
@Component({
  selector: 'oib-manage-workflows-modal',
  templateUrl: './manage-workflows-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, TranslatePipe, NgbTooltip, ReactiveFormsModule]
})
export default class ManageWorkflowsModalComponent {
  private modal = inject(NgbActiveModal);
  private modalService = inject(ModalService);
  private configurationWorkflowService = inject(ConfigurationWorkflowService);
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private workflowCreationService = inject(WorkflowCreationService);
  private router = inject(Router);
  private fb = inject(NonNullableFormBuilder);

  readonly directSave = signal(true);
  /** The connector id - or `create` for a connector being created (in-memory mode only). */
  private southId!: string;
  private southType!: OIBusSouthType;
  private southSettings!: SouthSettings;
  private readonly scanModes = signal<Array<ScanModeDTO>>([]);
  private groups!: SouthItemGroups;
  private manifest!: SouthConnectorManifest;
  /**
   * Where the workflows are kept: in in-memory mode, edit-south's own signal, so that the page gets the changes made
   * here, and this modal shows the ones made by the page (a deleted group is unmapped from the workflows); in direct
   * mode, the workflows loaded from the API.
   */
  private readonly workflowSource = signal<WritableSignal<Array<ConfigurationWorkflowCommandDTO>>>(signal([]));
  readonly workflows = computed(() => this.workflowSource()());
  readonly loading = signal(true);
  readonly runningWorkflowId = signal<string | null>(null);

  // A manual run can create/update items directly on the south connector this modal was opened from -
  // called after each successful "Run now" so the display page behind this modal reflects them, without
  // this modal (which only has its own point-in-time snapshot of the connector) needing to know how.
  private onWorkflowRun?: () => void;

  readonly searchControl = this.fb.control(null as string | null);
  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: this.searchControl.value });
  readonly displayedWorkflows = computed(() => {
    const searchText = (this.searchText() || '').toLowerCase();
    return this.workflows().filter(workflow => !searchText || workflow.name.toLowerCase().includes(searchText));
  });

  /** Direct mode: workflows are loaded from, and every change saved to, the REST endpoints. */
  prepareForDirectSave(
    southId: string,
    southSettings: SouthSettings,
    scanModes: Array<ScanModeDTO>,
    manifest: SouthConnectorManifest,
    groups: SouthItemGroups,
    onWorkflowRun?: () => void
  ) {
    this.directSave.set(true);
    this.southId = southId;
    this.southType = manifest.id;
    this.southSettings = southSettings;
    this.scanModes.set(scanModes);
    this.manifest = manifest;
    this.groups = groups;
    this.onWorkflowRun = onWorkflowRun;
    this.loading.set(true);
    this.workflowSource.set(signal([]));
    this.configurationWorkflowService.list(this.southId).subscribe(workflows => {
      this.workflowSource().set(workflows.map(workflow => toConfigurationWorkflowCommand(workflow)));
      this.loading.set(false);
    });
  }

  /**
   * In-memory mode: `workflows` is the page's own signal, updated by this modal. `southId` is the connector id,
   * or `create` for a connector being created - only used to test/preview against `southSettings`.
   */
  prepareForInMemory(
    workflows: WritableSignal<Array<ConfigurationWorkflowCommandDTO>>,
    southId: string,
    southSettings: SouthSettings,
    scanModes: Array<ScanModeDTO>,
    manifest: SouthConnectorManifest,
    groups: SouthItemGroups
  ) {
    this.directSave.set(false);
    this.workflowSource.set(workflows);
    this.southId = southId;
    this.southType = manifest.id;
    this.southSettings = southSettings;
    this.scanModes.set(scanModes);
    this.manifest = manifest;
    this.groups = groups;
    this.onWorkflowRun = undefined;
    this.loading.set(false);
  }

  close() {
    this.modal.close();
  }

  getScanModeName(workflow: ConfigurationWorkflowCommandDTO): string | null {
    if (!workflow.scanModeId) {
      return null;
    }
    return this.scanModes().find(scanMode => scanMode.id === workflow.scanModeId)?.name ?? null;
  }

  /** Translation key for this workflow's mode badge - local (create/update items) or remote (push to OIAnalytics). */
  getModeKey(workflow: ConfigurationWorkflowCommandDTO): string {
    return workflow.pushToOIAnalytics ? 'south.workflows.mode-remote' : 'south.workflows.mode-local';
  }

  private openEditModal(): { component: EditWorkflowModalComponent; result: Observable<ConfigurationWorkflowCommandDTO> } {
    const modalRef = this.modalService.open(EditWorkflowModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditWorkflowModalComponent = modalRef.componentInstance;
    component.directSave = this.directSave();
    return { component, result: modalRef.result };
  }

  onAdd() {
    const { component, result } = this.openEditModal();
    component.prepareForCreation(this.scanModes(), this.workflows(), this.manifest, this.southId, this.southSettings, this.groups);
    result.subscribe(command => this.createWorkflow(command));
  }

  onEdit(workflow: ConfigurationWorkflowCommandDTO) {
    const { component, result } = this.openEditModal();
    component.prepareForEdition(this.scanModes(), this.workflows(), this.manifest, workflow, this.southId, this.southSettings, this.groups);
    result.subscribe(command => {
      const save$: Observable<ConfigurationWorkflowCommandDTO> = this.directSave()
        ? this.configurationWorkflowService
            .update(this.southId, workflow.id!, command)
            .pipe(map(updated => toConfigurationWorkflowCommand(updated)))
        : of({ ...command, id: workflow.id });
      save$.subscribe(updated => {
        this.workflowSource().update(workflows => workflows.map(w => (w.id === workflow.id ? updated : w)));
        if (this.directSave()) {
          this.notificationService.success('south.workflows.updated');
        }
      });
    });
  }

  onDuplicate(workflow: ConfigurationWorkflowCommandDTO) {
    const { component, result } = this.openEditModal();
    component.prepareForCopy(this.scanModes(), this.workflows(), this.manifest, workflow, this.southId, this.southSettings, this.groups);
    result.subscribe(command => this.createWorkflow(command));
  }

  private createWorkflow(command: ConfigurationWorkflowCommandDTO) {
    this.workflowCreationService
      .save(this.southId, command, this.directSave())
      .subscribe(created => this.workflowSource().update(workflows => [...workflows, created]));
  }

  onDelete(workflow: ConfigurationWorkflowCommandDTO) {
    const confirmation$ = this.confirmationService.confirm({
      messageKey: 'south.workflows.confirm-deletion',
      interpolateParams: { name: workflow.name }
    });
    const removeFromList = () => this.workflowSource().update(workflows => workflows.filter(w => w.id !== workflow.id));
    if (!this.directSave()) {
      confirmation$.subscribe(() => removeFromList());
      return;
    }
    confirmation$.pipe(switchMap(() => this.configurationWorkflowService.delete(this.southId, workflow.id!))).subscribe({
      next: () => {
        removeFromList();
        this.notificationService.success('south.workflows.deleted');
      },
      error: error => {
        this.notificationService.error('south.workflows.delete-error', { error: extractErrorMessage(error) });
      }
    });
  }

  onRunNow(workflow: ConfigurationWorkflowCommandDTO) {
    if (!this.directSave()) {
      return;
    }
    this.runningWorkflowId.set(workflow.id);
    this.configurationWorkflowService.runNow(this.southId, workflow.id!).subscribe({
      next: () => {
        this.runningWorkflowId.set(null);
        this.notificationService.success('south.workflows.run-now-success');
        // A manual run may have created/updated items directly on the connector - refresh the display
        // page behind this modal so they show up without needing to close and reopen anything.
        this.onWorkflowRun?.();
      },
      error: error => {
        this.runningWorkflowId.set(null);
        this.notificationService.error('south.workflows.run-now-error', { error: extractErrorMessage(error) });
      }
    });
  }

  onPreview(workflow: ConfigurationWorkflowCommandDTO) {
    // Opened immediately, with its own loading spinner, rather than waiting for the preview request to
    // resolve first - see PreviewWorkflowModalComponent.prepareForPreview, which makes the request itself.
    const modalRef = this.modalService.open(PreviewWorkflowModalComponent, { size: 'xl' });
    const component: PreviewWorkflowModalComponent = modalRef.componentInstance;
    if (this.directSave()) {
      component.prepareForPreview(this.southId, workflow.id!, workflow.name);
      return;
    }
    // Only a workflow that already exists server-side has a previous run to classify entries against -
    // a new (temp_) one is previewed as if it had never run.
    const persistedWorkflowId = workflow.id && !workflow.id.startsWith(TEMP_ID_PREFIX) ? workflow.id : null;
    component.prepareForCommandPreview(this.southId, this.southType, this.southSettings, persistedWorkflowId, workflow, workflow.name);
  }

  onViewHistory(workflow: ConfigurationWorkflowCommandDTO) {
    if (!this.directSave()) {
      return;
    }
    this.modal.close();
    this.router.navigate(['/south', this.southId, 'workflows', workflow.id, 'history']);
  }
}
