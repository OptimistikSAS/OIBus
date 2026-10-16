import { AfterViewInit, ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';

import { ExploreOptions, ExploreTreeComponent } from '../explore-tree/explore-tree.component';

export type { SouthExploreApi } from '../explore-tree/explore-tree.component';

/** An action offered on the checked nodes, in the modal footer. */
export interface ExploreCheckedAction {
  /** What the modal closes with, to tell the actions apart */
  id: string;
  labelKey: string;
}

export interface ExploreModalOptions extends Omit<ExploreOptions, 'checkable'> {
  /** The actions offered on the checked nodes - the nodes get a checkbox when there are some. The last one is the main one. */
  checkedActions?: Array<ExploreCheckedAction>;
}

/** What the explore modal closes with: the action run on the checked nodes, and their ids. */
export interface SouthExploreResult {
  action: string;
  nodeIds: Array<string>;
}

/**
 * "Explore/discovery" modal: interactively browse a data source (OPC-UA nodes, folder tree, SQLite
 * tables/columns, ...) one level at a time. Thin modal chrome (header/footer/dismiss) around
 * `ExploreTreeComponent`, which owns the session itself and is released automatically when this modal
 * (and so the child) is torn down.
 *
 * With checked actions (see `prepare()`), every node gets a checkbox, and running an action closes this modal
 * with the checked nodes (see {@link SouthExploreResult}) - e.g. to add them as items, to keep items in sync
 * with them through a Configuration Workflow, or to pick the nodes a workflow discovers from.
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
  readonly checkedActions = signal<Array<ExploreCheckedAction>>([]);
  readonly checkedCount = computed(() => this.tree()?.checkedIds().size ?? 0);

  /**
   * Start the explore session and load the root-level entries.
   *
   * @param connectorId - id used to scope the session when exploring a persisted south connector's
   *   own settings; pass `null` for unsaved settings (create/edit forms)
   * @param settingsToExplore - the south settings to explore
   * @param southType - the south connector type
   * @param options - see {@link ExploreModalOptions}; pure read-only browsing of a south connector by default
   */
  prepare(connectorId: string | null, settingsToExplore: SouthSettings, southType: OIBusSouthType, options: ExploreModalOptions = {}) {
    const { checkedActions = [], ...treeOptions } = options;
    this.checkedActions.set(checkedActions);
    const apply = () =>
      this.tree()!.prepare(connectorId, settingsToExplore, southType, { ...treeOptions, checkable: checkedActions.length > 0 });
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

  runCheckedAction(action: ExploreCheckedAction) {
    const result: SouthExploreResult = { action: action.id, nodeIds: Array.from(this.tree()!.checkedIds()) };
    this.modal.close(result);
  }

  cancel() {
    this.modal.dismiss();
  }
}
