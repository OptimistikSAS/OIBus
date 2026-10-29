import { Observable } from 'rxjs';

import { ConfigurationWorkflowCommandDTO } from '@oibus/shared/api/configuration-workflow.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorItemCommandDTO } from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthItemSettings, SouthSettings } from '@oibus/shared/connector/south-settings.model';

import { SouthExploreApi } from '../../../shared/explore-tree/explore-tree.component';
import { SouthItemGroups } from '../../south-items/south-item-groups';

/**
 * The steps of the workflow wizard, in order: the Source step is for the connectors that discover from a query - the others
 * discover from the nodes checked in the Explore step - and the name comes with the schedule.
 */
export const WORKFLOW_STEPS = ['source', 'filter', 'items', 'schedule', 'review'] as const;
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];
export const TREE_WORKFLOW_STEPS: ReadonlyArray<WorkflowStep> = ['filter', 'items', 'schedule', 'review'];
/** A synchronisation of a SQL connector pushes the records of its query as they are: there is no item to map */
export const SQL_WORKFLOW_STEPS: ReadonlyArray<WorkflowStep> = ['source', 'filter', 'schedule', 'review'];

/** Why a workflow can't be previewed nor saved yet, and the step to fix it in. */
export interface WorkflowProblem {
  step: WorkflowStep;
  /** The translation key of what is wrong */
  key: string;
}

/**
 * The steps of the wizard opened from the Explore button: the Explore step first, then the ones of what is done with the
 * checked nodes - the workflow steps to keep items in sync with them, or the one step to add them as items once.
 */
export type WizardStep = 'explore' | WorkflowStep | 'add-items';

/** What the nodes checked in the Explore step are used for. */
/** Synchronising the checked nodes, adding them as items after a review (a tree), or in one item (a SQL database) */
export type ExploreFlow = 'sync' | 'items' | 'item';

/** An action of the Explore step footer, choosing what the checked nodes are used for. */
export interface ExploreFlowAction {
  flow: ExploreFlow;
  labelKey: string;
}

/** Everything the wizard needs when it is opened from the Explore button of a data source. */
export interface ExploreWizardOptions {
  /** The connector id, or `create` for a connector being created */
  southId: string;
  /** Scopes the explore session of a persisted data source; `null` for unsaved settings */
  exploreConnectorId: string | null;
  /** Override of the explore session calls, for settings that are not those of a south connector (a history query) */
  exploreApi?: SouthExploreApi;
  southSettings: SouthSettings;
  manifest: SouthConnectorManifest;
  /** The schedules the items can follow, with the groups; absent for the items of a history query, which have none */
  schedule?: { scanModes: Array<ScanModeDTO>; groups: SouthItemGroups };
  /** The items of the connector: a new one can't take their names, and one with the same settings is skipped by default */
  existingItems: ReadonlyArray<{ name: string; settings: SouthItemSettings }>;
  /**
   * Discovers the items, when they are not those of a south connector (e.g. of a history query, whose secrets it holds);
   * the mapping is the one of the item mapping form
   */
  discover?: (
    discoveryScope: Record<string, unknown>,
    itemFieldMapping: Record<string, string>
  ) => Observable<Array<SouthConnectorItemCommandDTO>>;
  /**
   * Keeping items in sync with the checked nodes through a workflow, with tree-based discovery only: whether it is saved
   * through the API (the caller saves it) or in memory, and the other workflows of the connector for the name uniqueness check
   */
  sync?: { directSave: boolean; existingWorkflows: Array<ConfigurationWorkflowCommandDTO> };
  /** Only the synchronisation is offered on the checked nodes, whatever the connector can do besides - from its New button */
  syncOnly?: boolean;
  /** Nothing is offered on the checked nodes: the data source is only browsed - e.g. to write the query of an item */
  readOnly?: boolean;
  /** A synchronisation to edit or duplicate: its nodes start checked in the Explore step, which goes on with its steps */
  workflow?: { command: ConfigurationWorkflowCommandDTO; mode: 'edit' | 'copy' };
}

/**
 * What a synchronisation discovers from: the nodes it was given, none standing for the whole data source - or null when it
 * discovers from a query, which has no node to check.
 */
export function workflowNodeIds(scope: Record<string, unknown>): Array<string> | null {
  if (typeof scope['query'] === 'string') {
    return null;
  }
  const nodeIds = scope['nodeIds'];
  if (Array.isArray(nodeIds)) {
    return nodeIds.filter((nodeId): nodeId is string => typeof nodeId === 'string');
  }
  // A workflow saved before nodes could be picked one by one has a single root node
  return typeof scope['rootNodeId'] === 'string' ? [scope['rootNodeId']] : [];
}

/** What the wizard closes with when opened from the Explore button: the workflow to create, or the items to add. */
export type ExploreWizardResult =
  | { kind: 'workflow'; command: ConfigurationWorkflowCommandDTO }
  | { kind: 'items'; commands: Array<SouthConnectorItemCommandDTO> }
  /** The item the checked tables of a SQL database give, for the item modal to complete */
  | { kind: 'item'; command: SouthConnectorItemCommandDTO };
