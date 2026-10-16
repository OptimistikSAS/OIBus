import { inject, Service } from '@angular/core';

import { map, Observable, of, switchMap } from 'rxjs';

import { ConfigurationWorkflowCommandDTO } from '@oibus/shared/api/configuration-workflow.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';

import { ConfigurationWorkflowService } from '../../services/configuration-workflow.service';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { ExploreCheckedAction } from '../../shared/south-explore-modal/south-explore-modal.component';
import { SouthItemGroups } from '../south-items/south-item-groups';
import EditWorkflowModalComponent from './edit-workflow-modal/edit-workflow-modal.component';
import { TEMP_ID_PREFIX, toConfigurationWorkflowCommand } from './workflow-command';

/**
 * What the Explore modal of a south connector offers on the checked nodes: keeping items in sync with them through a
 * workflow (tree-based discovery), and adding them as items once (with discovery defaults, which map them to items).
 */
export function exploreCheckedActions(manifest: SouthConnectorManifest): Array<ExploreCheckedAction> {
  const actions: Array<ExploreCheckedAction> = [];
  if (manifest.discovery?.kind === 'tree') {
    actions.push({ id: 'keep-in-sync', labelKey: 'south.explore.keep-in-sync' });
  }
  if (manifest.discovery?.defaults) {
    actions.push({ id: 'add-items', labelKey: 'south.explore.add-as-items' });
  }
  return actions;
}

/** Everything the workflow edit modal needs to create a workflow on a south connector. */
export interface WorkflowCreationContext {
  /** true from south-detail (saved through the API), false from edit-south (kept in memory until the connector is saved) */
  directSave: boolean;
  /** The connector id - or `create` for a connector being created (in-memory mode only) */
  southId: string;
  southSettings: SouthSettings;
  scanModes: Array<ScanModeDTO>;
  manifest: SouthConnectorManifest;
  groups: SouthItemGroups;
  /** The connector's other workflows, for the name uniqueness check */
  existingWorkflows: Array<{ id: string | null; name: string }>;
}

/**
 * Creates Configuration Workflows the same way wherever they come from - the Manage workflows modal, or the
 * nodes checked in the Explore modal - in either of the two modes of the page (see {@link WorkflowCreationContext}).
 */
@Service()
export class WorkflowCreationService {
  private readonly modalService = inject(ModalService);
  private readonly configurationWorkflowService = inject(ConfigurationWorkflowService);
  private readonly notificationService = inject(NotificationService);

  /**
   * Saves a new workflow: through the API in direct mode, or with a temporary id in memory mode. Emits the
   * saved workflow, as the command shape both modes work on.
   */
  save(southId: string, command: ConfigurationWorkflowCommandDTO, directSave: boolean): Observable<ConfigurationWorkflowCommandDTO> {
    if (!directSave) {
      return of({ ...command, id: `${TEMP_ID_PREFIX}${Date.now()}` });
    }
    return this.configurationWorkflowService.create(southId, command).pipe(
      map(created => {
        this.notificationService.success('south.workflows.created');
        return toConfigurationWorkflowCommand(created);
      })
    );
  }

  /**
   * Opens the workflow wizard to create a workflow that keeps items in sync with the nodes checked in the Explore
   * modal (tree-based discovery only), then saves it. Emits the saved workflow; completes without emitting if the
   * wizard is dismissed.
   */
  createFromExploredNodes(context: WorkflowCreationContext, nodeIds: Array<string>): Observable<ConfigurationWorkflowCommandDTO> {
    const modalRef = this.modalService.open(EditWorkflowModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditWorkflowModalComponent = modalRef.componentInstance;
    component.directSave = context.directSave;
    component.prepareForCreation(
      context.scanModes,
      context.existingWorkflows,
      context.manifest,
      context.southId,
      context.southSettings,
      context.groups,
      { name: '', discoveryScope: { nodeIds } }
    );
    return modalRef.result.pipe(
      switchMap((command: ConfigurationWorkflowCommandDTO) => this.save(context.southId, command, context.directSave))
    );
  }
}
