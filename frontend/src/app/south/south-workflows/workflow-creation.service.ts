import { inject, Service } from '@angular/core';

import { map, Observable, of, switchMap } from 'rxjs';

import { ConfigurationWorkflowCommandDTO, ConfigurationWorkflowDTO } from '@oibus/shared/api/configuration-workflow.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';
import { SouthConnectorExploreEntry } from '@oibus/shared/domain/south-connector.model';

import { ConfigurationWorkflowService } from '../../services/configuration-workflow.service';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { SouthItemGroups } from '../south-items/south-item-groups';
import EditWorkflowModalComponent from './edit-workflow-modal/edit-workflow-modal.component';

/** Prefix of the client-side id given to a workflow created in memory (not persisted yet) - the backend
 *  treats such an id as "create" when the south connector is saved, same convention as in-memory groups. */
export const TEMP_ID_PREFIX = 'temp_';

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

/** `name`, or `name-2`, `name-3`, ... - the first one no existing workflow uses (case-insensitive, like the edit modal's check). */
export function uniqueWorkflowName(name: string, existingWorkflows: Array<{ name: string }>): string {
  const taken = new Set(existingWorkflows.map(workflow => workflow.name.toLowerCase()));
  let candidate = name;
  for (let suffix = 2; taken.has(candidate.toLowerCase()); suffix++) {
    candidate = `${name}-${suffix}`;
  }
  return candidate;
}

/**
 * Creates Configuration Workflows the same way wherever they come from - the Manage workflows modal, or a
 * node picked in the Explore modal - in either of the two modes of the page (see {@link WorkflowCreationContext}).
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
   * Opens the workflow edit modal to create a workflow that discovers the data source from `entry` (a node
   * picked in the Explore modal, tree-based discovery only), named after it, then saves it. Emits the saved
   * workflow; completes without emitting if the modal is dismissed.
   */
  createFromExploredNode(context: WorkflowCreationContext, entry: SouthConnectorExploreEntry): Observable<ConfigurationWorkflowCommandDTO> {
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
      { name: uniqueWorkflowName(entry.name, context.existingWorkflows), discoveryScope: { rootNodeId: entry.id } }
    );
    return modalRef.result.pipe(
      switchMap((command: ConfigurationWorkflowCommandDTO) => this.save(context.southId, command, context.directSave))
    );
  }
}
