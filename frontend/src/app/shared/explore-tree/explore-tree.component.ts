import { KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, OnDestroy, output, signal } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { SouthExploreBrowseResult, SouthExploreStartResult } from '@oibus/shared/api/south-connector.model';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';
import { SouthConnectorExploreEntry } from '@oibus/shared/domain/south-connector.model';

import { SouthConnectorService } from '../../services/south-connector.service';
import { DatetimePipe } from '../datetime.pipe';
import { FileSizePipe } from '../file-size.pipe';

interface ExploreTreeNode {
  readonly entry: SouthConnectorExploreEntry;
  /** ids of the entries from the root down to this node's entry */
  readonly path: ReadonlyArray<string>;
  readonly expanded: boolean;
  readonly loading: boolean;
  readonly loaded: boolean;
  readonly error: string | null;
  readonly children: ReadonlyArray<ExploreTreeNode>;
}

function errorMessage(httpError: HttpErrorResponse): string {
  return httpError.error?.message ?? httpError.message;
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--explore-tree-max-height]': 'maxHeight()'
  },
  imports: [NgTemplateOutlet, KeyValuePipe, DatetimePipe, FileSizePipe, TranslateDirective]
})
export class ExploreTreeComponent implements OnDestroy {
  private readonly southConnectorService = inject(SouthConnectorService);

  readonly nodeSelected = output<SouthConnectorExploreEntry>();

  /**
   * Height of the tree's own scroll region. Defaults to the standalone Explore modal's fill-the-modal
   * sizing; a host embedding this inline alongside other form content (e.g. the Configuration Workflow
   * discovery-scope editor) should pass a smaller value instead of wrapping this component in a second
   * `overflow: auto` container of its own - two nested scroll regions produce two vertical scrollbars.
   */
  readonly maxHeight = input('50vh');

  private api: SouthExploreApi | null = null;
  readonly selectable = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private sessionId: string | null = null;
  /** The tree is immutable: a node change replaces the node and its ancestors */
  readonly nodes = signal<ReadonlyArray<ExploreTreeNode>>([]);

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
    this.selectable.set(selectable);
    this.api = api ?? this.defaultApi(connectorId || 'create');
    this.loading.set(true);
    this.api.start(settingsToExplore, southType).subscribe({
      error: (httpError: HttpErrorResponse) => {
        this.error.set(errorMessage(httpError));
        this.loading.set(false);
      },
      next: result => {
        this.sessionId = result.sessionId;
        this.nodes.set(result.entries.map(entry => this.createNode(entry, [])));
        this.loading.set(false);
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
      this.updateNode(node.path, current => ({ ...current, expanded: false }));
      return;
    }
    if (node.loaded) {
      this.updateNode(node.path, current => ({ ...current, expanded: true }));
      return;
    }
    if (!this.sessionId) {
      return;
    }
    this.updateNode(node.path, current => ({ ...current, loading: true, error: null }));
    this.api!.browse(this.sessionId, node.entry.id).subscribe({
      error: (httpError: HttpErrorResponse) => {
        this.updateNode(node.path, current => ({ ...current, error: errorMessage(httpError), loading: false }));
      },
      next: result => {
        this.updateNode(node.path, current => ({
          ...current,
          children: result.entries.map(entry => this.createNode(entry, current.path)),
          loaded: true,
          expanded: true,
          loading: false,
          // The entry was optimistically marked expandable; if it has no children, drop the caret.
          entry: result.entries.length === 0 ? { ...current.entry, hasChildren: false } : current.entry
        }));
      }
    });
  }

  /** Picks this node as the caller's selection - only offered on expandable nodes (see class doc). */
  select(node: ExploreTreeNode) {
    this.nodeSelected.emit(node.entry);
  }

  private createNode(entry: SouthConnectorExploreEntry, parentPath: ReadonlyArray<string>): ExploreTreeNode {
    return {
      entry,
      path: [...parentPath, entry.id],
      expanded: false,
      loading: false,
      loaded: false,
      error: null,
      children: []
    };
  }

  /** Replaces the node at the given path by its updated version */
  private updateNode(path: ReadonlyArray<string>, update: (node: ExploreTreeNode) => ExploreTreeNode) {
    const replace = (nodes: ReadonlyArray<ExploreTreeNode>, depth: number): ReadonlyArray<ExploreTreeNode> =>
      nodes.map(node => {
        if (node.entry.id !== path[depth]) {
          return node;
        }
        return depth === path.length - 1 ? update(node) : { ...node, children: replace(node.children, depth + 1) };
      });
    this.nodes.update(nodes => replace(nodes, 0));
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
