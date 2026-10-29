import { ChangeDetectionStrategy, Component, computed, input, output, viewChild } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';

import { ExploreTreeComponent } from '../../../shared/explore-tree/explore-tree.component';

/** A synchronisation of the connector that discovers from nodes - none standing for the whole data source */
export interface NodeSynchronisation {
  id: string | null;
  name: string;
  nodeIds: Array<string>;
}

/**
 * The Explore step of the explore wizard: the data source as a tree, where the nodes to use are checked, with what the
 * synchronisations of the connector already keep in sync - and, when the checked nodes are to be kept in sync, the
 * synchronisation they are added to. What is done with the checked nodes is up to the wizard.
 */
@Component({
  selector: 'oib-explore-step',
  templateUrl: './explore-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ExploreTreeComponent]
})
export class ExploreStepComponent {
  /** The synchronisations of the connector that discover from nodes */
  readonly workflows = input<ReadonlyArray<NodeSynchronisation>>([]);
  /** The synchronisation the checked nodes are added to - null for a new one */
  readonly syncTargetId = input<string | null>(null);
  /** The nodes the synchronisation had when it was picked, to tell what the checked ones add to it and remove from it */
  readonly originalNodeIds = input<ReadonlyArray<string>>([]);
  /** Whether to offer to add the checked nodes to a synchronisation the connector already has, rather than a new one */
  readonly showSyncTarget = input(false);
  /** Whether the checked nodes have nothing to read */
  readonly selectionNone = input(false);
  /** Why the checked nodes could not be used - a message, or null */
  readonly selectionError = input<string | null>(null);
  /** The synchronisation picked to add the checked nodes to - null for a new one */
  readonly syncTargetChange = output<string | null>();

  /** Where the nodes are checked: prepared by the wizard, which reads the checked ones */
  readonly tree = viewChild.required(ExploreTreeComponent);
  readonly checkedIds = computed(() => this.tree().checkedIds());

  /** The synchronisations already keeping items in sync with nodes, the edited one aside: its nodes are the checked ones */
  private readonly otherWorkflows = computed(() => this.workflows().filter(workflow => workflow.id !== this.syncTargetId()));
  /** How many nodes each synchronisation has, none for the whole data source */
  readonly coverageChips = computed(() =>
    this.otherWorkflows().map(workflow => ({ name: workflow.name, count: workflow.nodeIds.length || null }))
  );
  /** The names of the synchronisations that keep the items of a node in sync: the ones of the node or of a folder it is in */
  readonly badges = computed(() => {
    const workflows = this.otherWorkflows();
    return (path: ReadonlyArray<string>) =>
      workflows.filter(workflow => workflow.nodeIds.some(nodeId => path.includes(nodeId))).map(workflow => workflow.name);
  });
  /** The synchronisations that already keep in sync the items of the checked nodes */
  readonly coveringWorkflowNames = computed(() => {
    const checkedPaths = this.tree().checkedPaths();
    return this.otherWorkflows()
      .filter(
        workflow => workflow.nodeIds.length === 0 || workflow.nodeIds.some(nodeId => checkedPaths.some(path => path.includes(nodeId)))
      )
      .map(workflow => workflow.name);
  });
  /** The nodes of the edited synchronisation that are no longer checked: the items they gave are disabled by its next run */
  readonly removedNodeIds = computed(() => {
    const checked = this.checkedIds();
    return this.originalNodeIds().filter(nodeId => !checked.has(nodeId));
  });
  /** The nodes checked that the edited synchronisation did not have */
  readonly addedNodeIds = computed(() => {
    const original = this.originalNodeIds();
    return Array.from(this.checkedIds()).filter(nodeId => !original.includes(nodeId));
  });
}
