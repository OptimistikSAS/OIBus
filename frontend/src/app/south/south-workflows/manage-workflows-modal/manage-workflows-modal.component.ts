import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { map, Observable, of, switchMap } from 'rxjs';

import { ConfigurationWorkflowCommandDTO, ConfigurationWorkflowDTO } from '@oibus/shared/api/configuration-workflow.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';
import { OIBusSouthType, SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';

import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { extractErrorMessage } from '../../../shared/extract-error-message';
import { ModalService } from '../../../shared/modal.service';
import { NotificationService } from '../../../shared/notification.service';
import EditWorkflowModalComponent from '../edit-workflow-modal/edit-workflow-modal.component';
import PreviewWorkflowModalComponent from '../preview-workflow-modal/preview-workflow-modal.component';

type AddOrEditGroup = (command: {
  mode: 'create' | 'edit';
  group: SouthItemGroupCommandDTO;
}) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
type DeleteGroup = (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>;

/** Prefix of the client-side id given to a workflow created in memory (not persisted yet) - the backend
 *  treats such an id as "create" when the south connector is saved, same convention as in-memory groups. */
const TEMP_ID_PREFIX = 'temp_';

/** A persisted workflow as the command the edit modal works on (and edit-south keeps in memory). */
export function toConfigurationWorkflowCommand(workflow: ConfigurationWorkflowDTO): ConfigurationWorkflowCommandDTO {
  return {
    id: workflow.id,
    name: workflow.name,
    discoveryScope: workflow.discoveryScope,
    identityKeyFields: workflow.identityKeyFields,
    eligibilityFilter: workflow.eligibilityFilter,
    itemFieldMapping: workflow.itemFieldMapping,
    pushToOIAnalytics: workflow.pushToOIAnalytics,
    scanModeId: workflow.scanMode?.id ?? null,
    enabled: workflow.enabled
  };
}

/**
 * Lists a south connector's Configuration Workflows, in one of two modes (like ManageGroupsModalComponent's
 * own directSave):
 * - direct (prepareForDirectSave, from south-detail): every change is saved straight through the REST
 *   endpoints, and a workflow can also be run now, previewed as persisted, and have its run history opened.
 * - in memory (prepareForInMemory, from edit-south): add/edit/duplicate/delete only mutate the array the
 *   page owns (saved along with the connector itself), and a preview runs the workflow as currently
 *   edited against the page's current, possibly unsaved, settings. No run, no history - there may not
 *   even be a persisted connector/workflow to run yet.
 * Both modes display the same command shape - persisted DTOs are converted on load.
 */
@Component({
  selector: 'oib-manage-workflows-modal',
  templateUrl: './manage-workflows-modal.component.html',
  styleUrl: './manage-workflows-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, TranslatePipe, NgbTooltip, ReactiveFormsModule]
})
export default class ManageWorkflowsModalComponent {
  private modal = inject(NgbActiveModal);
  private modalService = inject(ModalService);
  private configurationWorkflowService = inject(ConfigurationWorkflowService);
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private fb = inject(NonNullableFormBuilder);

  readonly directSave = signal(true);
  /** The connector id - or `create` for a connector being created (in-memory mode only). */
  private southId!: string;
  private southType!: OIBusSouthType;
  private southSettings!: SouthSettings;
  private readonly scanModes = signal<Array<ScanModeDTO>>([]);
  private groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];
  private manifest!: SouthConnectorManifest;
  /**
   * The workflows, mutated in place - in in-memory mode, this is edit-south's own array (shared by reference), which is
   * how the page gets the changes back. The template renders the `workflows` snapshot instead, refreshed after every change.
   */
  private sharedWorkflows: Array<ConfigurationWorkflowCommandDTO> = [];
  readonly workflows = signal<Array<ConfigurationWorkflowCommandDTO>>([]);
  readonly loading = signal(true);
  readonly runningWorkflowId = signal<string | null>(null);

  private addOrEditGroup!: AddOrEditGroup;
  private deleteGroup!: DeleteGroup;
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
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    addOrEditGroup: AddOrEditGroup,
    deleteGroup: DeleteGroup,
    onWorkflowRun?: () => void
  ) {
    this.directSave.set(true);
    this.southId = southId;
    this.southType = manifest.id;
    this.southSettings = southSettings;
    this.scanModes.set(scanModes);
    this.manifest = manifest;
    this.groups = groups;
    this.addOrEditGroup = addOrEditGroup;
    this.deleteGroup = deleteGroup;
    this.onWorkflowRun = onWorkflowRun;
    this.loading.set(true);
    this.configurationWorkflowService.list(this.southId).subscribe(workflows => {
      this.sharedWorkflows = workflows.map(workflow => toConfigurationWorkflowCommand(workflow));
      this.loading.set(false);
      this.refreshWorkflows();
    });
  }

  /**
   * In-memory mode: `workflows` is the page's own array, mutated in place. `southId` is the connector id,
   * or `create` for a connector being created - only used to test/preview against `southSettings`.
   */
  prepareForInMemory(
    workflows: Array<ConfigurationWorkflowCommandDTO>,
    southId: string,
    southSettings: SouthSettings,
    scanModes: Array<ScanModeDTO>,
    manifest: SouthConnectorManifest,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    addOrEditGroup: AddOrEditGroup,
    deleteGroup: DeleteGroup
  ) {
    this.directSave.set(false);
    this.sharedWorkflows = workflows;
    this.southId = southId;
    this.southType = manifest.id;
    this.southSettings = southSettings;
    this.scanModes.set(scanModes);
    this.manifest = manifest;
    this.groups = groups;
    this.addOrEditGroup = addOrEditGroup;
    this.deleteGroup = deleteGroup;
    this.onWorkflowRun = undefined;
    this.loading.set(false);
    this.refreshWorkflows();
  }

  /** Re-renders the workflow list after it was changed in place. */
  private refreshWorkflows() {
    this.workflows.set([...this.sharedWorkflows]);
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
    component.prepareForCreation(
      this.scanModes(),
      this.sharedWorkflows,
      this.manifest,
      this.southId,
      this.southSettings,
      this.groups,
      this.addOrEditGroup,
      this.deleteGroup
    );
    result.subscribe(command => this.createWorkflow(command));
  }

  onEdit(workflow: ConfigurationWorkflowCommandDTO) {
    const { component, result } = this.openEditModal();
    component.prepareForEdition(
      this.scanModes(),
      this.sharedWorkflows,
      this.manifest,
      workflow,
      this.southId,
      this.southSettings,
      this.groups,
      this.addOrEditGroup,
      this.deleteGroup
    );
    result.subscribe(command => {
      const save$: Observable<ConfigurationWorkflowCommandDTO> = this.directSave()
        ? this.configurationWorkflowService
            .update(this.southId, workflow.id!, command)
            .pipe(map(updated => toConfigurationWorkflowCommand(updated)))
        : of({ ...command, id: workflow.id });
      save$.subscribe(updated => {
        const index = this.sharedWorkflows.findIndex(w => w.id === workflow.id);
        if (index >= 0) {
          this.sharedWorkflows[index] = updated;
        }
        this.refreshWorkflows();
        if (this.directSave()) {
          this.notificationService.success('south.workflows.updated');
        }
      });
    });
  }

  onDuplicate(workflow: ConfigurationWorkflowCommandDTO) {
    const { component, result } = this.openEditModal();
    component.prepareForCopy(
      this.scanModes(),
      this.sharedWorkflows,
      this.manifest,
      workflow,
      this.southId,
      this.southSettings,
      this.groups,
      this.addOrEditGroup,
      this.deleteGroup
    );
    result.subscribe(command => this.createWorkflow(command));
  }

  private createWorkflow(command: ConfigurationWorkflowCommandDTO) {
    if (!this.directSave()) {
      this.sharedWorkflows.push({ ...command, id: `${TEMP_ID_PREFIX}${Date.now()}` });
      this.refreshWorkflows();
      return;
    }
    this.configurationWorkflowService.create(this.southId, command).subscribe(created => {
      this.sharedWorkflows.push(toConfigurationWorkflowCommand(created));
      this.refreshWorkflows();
      this.notificationService.success('south.workflows.created');
    });
  }

  onDelete(workflow: ConfigurationWorkflowCommandDTO) {
    const confirmation$ = this.confirmationService.confirm({
      messageKey: 'south.workflows.confirm-deletion',
      interpolateParams: { name: workflow.name }
    });
    const removeFromList = () => {
      const index = this.sharedWorkflows.findIndex(w => w.id === workflow.id);
      if (index >= 0) {
        this.sharedWorkflows.splice(index, 1);
      }
      this.refreshWorkflows();
    };
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
