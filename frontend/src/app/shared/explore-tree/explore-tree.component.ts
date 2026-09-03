import { Component, EventEmitter, inject, ChangeDetectionStrategy, OnDestroy, Output } from '@angular/core';
import { KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { TranslateDirective } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { DatetimePipe } from '../datetime.pipe';
import { FileSizePipe } from '../file-size.pipe';
import {
  OIBusSouthType,
  SouthConnectorExploreEntry,
  SouthExploreBrowseResult,
  SouthExploreStartResult
} from '../../../../../backend/shared/model/south-connector.model';

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
 * Backend calls needed to drive an explore session, kept as a plain port so this component isn't tied
 * to `SouthConnectorService` — a south connector and a history query's south settings start/browse/
 * close their explore sessions through different endpoints.
 */
export interface SouthExploreApi {
  start(settings: SouthSettings, type: OIBusSouthType): Observable<SouthExploreStartResult>;
  browse(sessionId: string, parentId: string | null): Observable<SouthExploreBrowseResult>;
  close(sessionId: string): Observable<void>;
}

/**
 * Interactive, stateful "explore/discovery" tree. Opens an explore session on the backend and lets
 * the user lazily expand the data source (OPC-UA nodes, folder tree, SQLite tables/columns, ...). The
 * session is released when the component is torn down.
 *
 * Owns its own session end to end so it can be embedded either inside a dedicated modal
 * (`SouthExploreModalComponent`, read-only browsing) or directly inline in another form (e.g. the
 * Configuration Workflow discovery-scope editor), with no other coordination needed from the host.
 *
 * In `selectable` mode, every expandable node (one with children — a leaf can't meaningfully scope a
 * walk, since there would be nothing left to discover under it) gets a "Select" action; picking one
 * emits `nodeSelected` instead of toggling. Non-selectable mode (the default) is pure read-only
 * browsing, as the standalone Explore feature has always been.
 */
@Component({
  selector: 'oib-explore-tree',
  templateUrl: './explore-tree.component.html',
  styleUrl: './explore-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgTemplateOutlet, KeyValuePipe, DatetimePipe, FileSizePipe, TranslateDirective]
})
export class ExploreTreeComponent implements OnDestroy {
  private southConnectorService = inject(SouthConnectorService);

  @Output() nodeSelected = new EventEmitter<SouthConnectorExploreEntry>();

  private api: SouthExploreApi | null = null;
  selectable = false;
  loading = false;
  error: string | null = null;
  sessionId: string | null = null;
  nodes: Array<ExploreTreeNode> = [];

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
   * @param selectable - when true, every expandable node gets a "Select" action that emits
   *   `nodeSelected` instead of toggling. Defaults to false (pure read-only browsing).
   */
  prepare(
    connectorId: string | null,
    settingsToExplore: SouthSettings,
    southType: OIBusSouthType,
    api?: SouthExploreApi,
    selectable = false
  ) {
    this.selectable = selectable;
    this.api = api ?? this.defaultApi(connectorId || 'create');
    this.loading = true;
    this.api.start(settingsToExplore, southType).subscribe({
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

  private defaultApi(southId: string): SouthExploreApi {
    return {
      start: (settings, type) => this.southConnectorService.startExplore(southId, settings, type),
      browse: (sessionId, parentId) => this.southConnectorService.browseExplore(southId, sessionId, parentId),
      close: sessionId => this.southConnectorService.closeExplore(southId, sessionId)
    };
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
    this.api!.browse(this.sessionId, node.entry.id).subscribe({
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

  /** Picks this node as the caller's selection - only offered on expandable nodes (see class doc). */
  select(node: ExploreTreeNode) {
    this.nodeSelected.emit(node.entry);
  }

  private createNode(entry: SouthConnectorExploreEntry, depth: number): ExploreTreeNode {
    return { entry, depth, expanded: false, loading: false, loaded: false, error: null, children: [] };
  }

  /**
   * Release the backend session whenever this component is torn down - covers both a standalone
   * modal's dismissal (Close button, ESC, backdrop-click) and an inline host (e.g. the workflow edit
   * form) being closed or navigated away from.
   */
  ngOnDestroy() {
    if (this.sessionId) {
      this.api!.close(this.sessionId).subscribe({ error: () => undefined });
    }
  }
}
