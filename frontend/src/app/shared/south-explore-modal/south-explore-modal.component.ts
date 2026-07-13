import { Component, inject, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { NgTemplateOutlet } from '@angular/common';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { OIBusSouthType, SouthConnectorExploreEntry } from '../../../../../backend/shared/model/south-connector.model';

interface ExploreTreeNode {
  entry: SouthConnectorExploreEntry;
  depth: number;
  expanded: boolean;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  children: Array<ExploreTreeNode>;
}

/**
 * Interactive, stateful "explore/discovery" modal. Opens an explore session on the backend and
 * lets the user lazily expand the data source (OPC-UA nodes, folder tree, ...). The session is
 * released when the modal is dismissed.
 */
@Component({
  selector: 'oib-south-explore-modal',
  templateUrl: './south-explore-modal.component.html',
  styleUrl: './south-explore-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, NgTemplateOutlet]
})
export class SouthExploreModalComponent implements OnDestroy {
  private modal = inject(NgbActiveModal);
  private southConnectorService = inject(SouthConnectorService);

  southId = 'create';
  loading = false;
  error: string | null = null;
  sessionId: string | null = null;
  nodes: Array<ExploreTreeNode> = [];

  /**
   * Start the explore session and load the root-level entries.
   */
  prepare(connectorId: string | null, settingsToExplore: SouthSettings, southType: OIBusSouthType) {
    this.southId = connectorId || 'create';
    this.loading = true;
    this.southConnectorService.startExplore(this.southId, settingsToExplore, southType).subscribe({
      error: httpError => {
        this.error = httpError.error?.message ?? httpError.message;
        this.loading = false;
      },
      next: result => {
        this.sessionId = result.sessionId;
        this.nodes = result.entries.map(entry => this.createNode(entry, 0));
        this.loading = false;
      }
    });
  }

  /**
   * Expand or collapse a node, lazily loading its children the first time it is expanded.
   */
  toggle(node: ExploreTreeNode) {
    if (!node.entry.hasChildren) {
      return;
    }
    if (node.expanded) {
      node.expanded = false;
      return;
    }
    if (node.loaded) {
      node.expanded = true;
      return;
    }
    if (!this.sessionId) {
      return;
    }
    node.loading = true;
    node.error = null;
    this.southConnectorService.browseExplore(this.southId, this.sessionId, node.entry.id).subscribe({
      error: httpError => {
        node.error = httpError.error?.message ?? httpError.message;
        node.loading = false;
      },
      next: result => {
        node.children = result.entries.map(entry => this.createNode(entry, node.depth + 1));
        node.loaded = true;
        node.expanded = true;
        node.loading = false;
        // The entry was optimistically marked expandable; if it has no children, drop the caret.
        if (result.entries.length === 0) {
          node.entry.hasChildren = false;
        }
      }
    });
  }

  private createNode(entry: SouthConnectorExploreEntry, depth: number): ExploreTreeNode {
    return { entry, depth, expanded: false, loading: false, loaded: false, error: null, children: [] };
  }

  cancel() {
    this.modal.dismiss();
  }

  /**
   * Release the backend session whenever the modal is torn down — this covers the Close button
   * as well as ESC / backdrop-click dismissal, which bypass cancel().
   */
  ngOnDestroy() {
    if (this.sessionId) {
      this.southConnectorService.closeExplore(this.southId, this.sessionId).subscribe({ error: () => undefined });
    }
  }
}
