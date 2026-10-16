import { AfterViewInit, ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';
import { SouthConnectorExploreEntry } from '@oibus/shared/domain/south-connector.model';

import { ExploreOptions, ExploreTreeComponent } from '../explore-tree/explore-tree.component';

export type { ExploreOptions, SouthExploreApi } from '../explore-tree/explore-tree.component';

/** What the explore modal closes with: the node its node action ran on, or the nodes checked to add as items. */
export type SouthExploreResult = { type: 'node'; entry: SouthConnectorExploreEntry } | { type: 'items'; nodeIds: Array<string> };

/**
 * "Explore/discovery" modal: interactively browse a data source (OPC-UA nodes, folder tree, SQLite
 * tables/columns, ...) one level at a time. Thin modal chrome (header/footer/dismiss) around
 * `ExploreTreeComponent`, which owns the session itself and is released automatically when this modal
 * (and so the child) is torn down.
 *
 * With a node action (see `prepare()`), running it on a node closes this modal with that node
 * (`NgbActiveModal.close`) instead of just letting the user browse read-only - used to pick a
 * Configuration Workflow's discovery root, or to create a workflow from the explored node. With
 * checkable nodes, "Add as items" closes it with the checked ones (see {@link SouthExploreResult}).
 */
@Component({
  selector: 'oib-south-explore-modal',
  templateUrl: './south-explore-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ExploreTreeComponent]
})
export class SouthExploreModalComponent implements AfterViewInit {
  private readonly modal = inject(NgbActiveModal);

  private readonly tree = viewChild(ExploreTreeComponent);
  // A caller (matching every other "prepare"-style modal in this app) calls prepare() right after
  // opening the modal, before Angular has necessarily run its first change detection pass - i.e.
  // possibly before the view child is resolved. Buffered here and flushed in ngAfterViewInit so prepare()
  // works regardless of that timing, rather than requiring every caller to know or care about it.
  private pendingPrepare: (() => void) | null = null;
  readonly checkable = computed(() => this.tree()?.checkable() ?? false);
  readonly checkedCount = computed(() => this.tree()?.checkedIds().size ?? 0);

  /**
   * Start the explore session and load the root-level entries.
   *
   * @param connectorId - id used to scope the session when exploring a persisted south connector's
   *   own settings; pass `null` for unsaved settings (create/edit forms)
   * @param settingsToExplore - the south settings to explore
   * @param southType - the south connector type
   * @param options - see {@link ExploreOptions}; pure read-only browsing of a south connector by default
   */
  prepare(connectorId: string | null, settingsToExplore: SouthSettings, southType: OIBusSouthType, options: ExploreOptions = {}) {
    const apply = () => this.tree()!.prepare(connectorId, settingsToExplore, southType, options);
    if (this.tree()) {
      apply();
    } else {
      this.pendingPrepare = apply;
    }
  }

  ngAfterViewInit() {
    if (this.pendingPrepare) {
      this.pendingPrepare();
      this.pendingPrepare = null;
    }
  }

  onNodeSelected(entry: SouthConnectorExploreEntry) {
    const result: SouthExploreResult = { type: 'node', entry };
    this.modal.close(result);
  }

  addCheckedAsItems() {
    const result: SouthExploreResult = { type: 'items', nodeIds: Array.from(this.tree()!.checkedIds()) };
    this.modal.close(result);
  }

  cancel() {
    this.modal.dismiss();
  }
}
