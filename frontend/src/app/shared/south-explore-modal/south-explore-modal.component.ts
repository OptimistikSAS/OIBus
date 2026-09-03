import { Component, ChangeDetectionStrategy, inject, AfterViewInit, ViewChild } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { OIBusSouthType, SouthConnectorExploreEntry } from '../../../../../backend/shared/model/south-connector.model';
import { ExploreTreeComponent, SouthExploreApi } from '../explore-tree/explore-tree.component';

export type { SouthExploreApi } from '../explore-tree/explore-tree.component';

/**
 * "Explore/discovery" modal: interactively browse a data source (OPC-UA nodes, folder tree, SQLite
 * tables/columns, ...) one level at a time. Thin modal chrome (header/footer/dismiss) around
 * `ExploreTreeComponent`, which owns the session itself and is released automatically when this modal
 * (and so the child) is torn down.
 *
 * In `selectable` mode (see `prepare()`), picking a node in the tree closes this modal with that node
 * (`NgbActiveModal.close`) instead of just letting the user browse read-only - used e.g. to pick a
 * Configuration Workflow's discovery root.
 */
@Component({
  selector: 'oib-south-explore-modal',
  templateUrl: './south-explore-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, ExploreTreeComponent]
})
export class SouthExploreModalComponent implements AfterViewInit {
  private modal = inject(NgbActiveModal);

  @ViewChild(ExploreTreeComponent) private tree!: ExploreTreeComponent;
  // A caller (matching every other "prepare"-style modal in this app) calls prepare() right after
  // opening the modal, before Angular has necessarily run its first change detection pass - i.e.
  // possibly before @ViewChild is resolved. Buffered here and flushed in ngAfterViewInit so prepare()
  // works regardless of that timing, rather than requiring every caller to know or care about it.
  private pendingPrepare: (() => void) | null = null;

  /**
   * Start the explore session and load the root-level entries.
   *
   * @param connectorId - id used to scope the session when exploring a persisted south connector's
   *   own settings; pass `null` for unsaved settings (create/edit forms)
   * @param settingsToExplore - the south settings to explore
   * @param southType - the south connector type
   * @param api - override the backend calls used to start/browse/close the session — needed when
   *   exploring settings that don't belong to a standalone south connector (e.g. a history query's
   *   south settings). Defaults to the south connector explore endpoints keyed by `connectorId`.
   * @param selectable - when true, every expandable node gets a "Select" action that closes this
   *   modal with the picked node. Defaults to false (pure read-only browsing).
   */
  prepare(
    connectorId: string | null,
    settingsToExplore: SouthSettings,
    southType: OIBusSouthType,
    api?: SouthExploreApi,
    selectable = false
  ) {
    const apply = () => this.tree.prepare(connectorId, settingsToExplore, southType, api, selectable);
    if (this.tree) {
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
    this.modal.close(entry);
  }

  cancel() {
    this.modal.dismiss();
  }
}
