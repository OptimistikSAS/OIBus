import { ClipboardModule } from '@angular/cdk/clipboard';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnDestroy, signal } from '@angular/core';

import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { SouthExploreBrowseResult, SouthExploreStartResult } from '@oibus/shared/api/south-connector.model';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';
import { SouthConnectorExploreEntry, SouthConnectorExploreFieldKind } from '@oibus/shared/domain/south-connector.model';

import { SouthConnectorService } from '../../services/south-connector.service';
import { DatetimePipe } from '../datetime.pipe';
import { FileSizePipe } from '../file-size.pipe';
import { NotificationService } from '../notification.service';

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

/** One metadata field of the selected node, as listed in the details panel. */
interface ExploreDetailField {
  readonly key: string;
  /** Translation key of the label, or null for a field no connector is known to send (see `humanLabel`) */
  readonly labelKey: string | null;
  readonly humanLabel: string;
  readonly value: string | number;
  readonly kind: SouthConnectorExploreFieldKind | undefined;
}

/** The metadata fields the connectors send, which have a translated label (`south.explore.metadata.<key>`). */
const TRANSLATED_METADATA_KEYS = new Set([
  'nodeId',
  'type',
  'description',
  'unit',
  'min',
  'max',
  'value',
  'columns',
  'rows',
  'nullable',
  'primaryKey',
  'default',
  'size',
  'ctime',
  'mtime',
  'files',
  'address',
  'deviceInstance',
  'networkNumber',
  'macAddress',
  'objectType',
  'objectInstance'
]);

/** The metadata fields shown next to the node name in the tree, the first one an entry has. */
const SUMMARY_METADATA_KEYS = ['type', 'objectType'];

function errorMessage(httpError: HttpErrorResponse): string {
  return httpError.error?.message ?? httpError.message;
}

/** `deviceInstance` -> `Device instance`: the fallback label of a metadata field with no translation. */
function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** How an explore session is driven and what it offers besides read-only browsing. */
export interface ExploreOptions {
  /**
   * Override the backend calls used to start/browse/close the session — needed when exploring settings that
   * don't belong to a standalone south connector (e.g. a history query's south settings). Defaults to the south
   * connector explore endpoints keyed by the connector id.
   */
  api?: SouthExploreApi;
  /** Whether every node gets a checkbox, to pick several nodes at once (see `checkedIds`) */
  checkable?: boolean;
  /** The ids of the nodes checked at the start, e.g. the ones a workflow already discovers from */
  checkedIds?: Array<string>;
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
 * Each row only shows the node name and its type; clicking it selects the node (and expands it), whose
 * metadata is listed in a details panel - beside the tree when there is room for it, under it otherwise
 * (a container query, so it adapts to the host: a modal, or inline in a form).
 *
 * Owns its own session end to end so it can be embedded either inside a dedicated modal
 * (the Explore step of the workflow wizard) or directly inline in another form (e.g. the
 * Configuration Workflow discovery-scope editor), with no other coordination needed from the host.
 *
 * With checkable nodes (see `prepare()`), every node gets a checkbox to pick several of them at once (see
 * `checkedIds`) - e.g. to add them as items, or to discover from them in a Configuration Workflow. Without
 * (the default), it is pure read-only browsing.
 */
@Component({
  selector: 'oib-explore-tree',
  templateUrl: './explore-tree.component.html',
  styleUrl: './explore-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--explore-tree-max-height]': 'maxHeight()'
  },
  imports: [NgTemplateOutlet, ClipboardModule, DatetimePipe, FileSizePipe, TranslateDirective, TranslatePipe]
})
export class ExploreTreeComponent implements OnDestroy {
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly notificationService = inject(NotificationService);

  /**
   * Height of the tree's (and the details panel's) own scroll region. Defaults to the standalone Explore modal's fill-the-modal
   * sizing; a host embedding this inline alongside other form content (e.g. the Configuration Workflow
   * discovery-scope editor) should pass a smaller value instead of wrapping this component in a second
   * `overflow: auto` container of its own - two nested scroll regions produce two vertical scrollbars.
   */
  readonly maxHeight = input('50vh');

  /**
   * What to tell about a node besides its type, e.g. the synchronisations that already keep its items in sync: a badge per
   * text. Given the ids of the entries from the root down to the node, itself included.
   */
  readonly badges = input<(path: ReadonlyArray<string>) => ReadonlyArray<string>>(() => []);

  private api: SouthExploreApi | null = null;
  readonly checkable = signal(false);
  /** Ids of the checked nodes: a point stands for itself, any other node for everything under it */
  readonly checkedIds = signal<ReadonlySet<string>>(new Set());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private sessionId: string | null = null;
  /** The tree is immutable: a node change replaces the node and its ancestors */
  readonly nodes = signal<ReadonlyArray<ExploreTreeNode>>([]);
  /** Path of the node whose details are shown - kept as a path since the node itself is replaced on each change */
  private readonly selectedPath = signal<ReadonlyArray<string> | null>(null);
  readonly selectedNode = computed(() => {
    const path = this.selectedPath();
    if (!path) {
      return null;
    }
    let node: ExploreTreeNode | undefined;
    let level = this.nodes();
    for (const id of path) {
      node = level.find(candidate => candidate.entry.id === id);
      if (!node) {
        return null;
      }
      level = node.children;
    }
    return node ?? null;
  });
  readonly selectedFields = computed<ReadonlyArray<ExploreDetailField>>(() => {
    const entry = this.selectedNode()?.entry;
    if (!entry) {
      return [];
    }
    // In the order the connector sent them, which puts the most useful ones first (unlike the keyvalue pipe)
    return Object.entries(entry.metadata).map(([key, value]) => ({
      key,
      labelKey: TRANSLATED_METADATA_KEYS.has(key) ? `south.explore.metadata.${key}` : null,
      humanLabel: humanize(key),
      value,
      kind: entry.metadataKinds?.[key]
    }));
  });

  /**
   * The ids of the entries from the root down to each checked node, itself included - just its id when it is not loaded (it
   * was checked before the session started)
   */
  readonly checkedPaths = computed<ReadonlyArray<ReadonlyArray<string>>>(() => {
    const checkedIds = this.checkedIds();
    const paths = new Map<string, ReadonlyArray<string>>();
    const visit = (nodes: ReadonlyArray<ExploreTreeNode>) => {
      for (const node of nodes) {
        if (checkedIds.has(node.entry.id)) {
          paths.set(node.entry.id, node.path);
        }
        visit(node.children);
      }
    };
    visit(this.nodes());
    return Array.from(checkedIds, id => paths.get(id) ?? [id]);
  });

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
    this.checkable.set(options.checkable ?? false);
    this.checkedIds.set(new Set(options.checkedIds ?? []));
    this.api = options.api ?? this.defaultApi(connectorId || 'create');
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
    this.loadChildren(node);
  }

  /** Browses the children of the node and expands it, then hands them to `onLoaded`. */
  private loadChildren(node: ExploreTreeNode, onLoaded: (children: ReadonlyArray<ExploreTreeNode>) => void = () => undefined) {
    if (!this.sessionId) {
      return;
    }
    this.updateNode(node.path, current => ({ ...current, loading: true, error: null }));
    this.api!.browse(this.sessionId, node.entry.id).subscribe({
      error: (httpError: HttpErrorResponse) => {
        this.updateNode(node.path, current => ({ ...current, error: errorMessage(httpError), loading: false }));
      },
      next: result => {
        const children = result.entries.map(entry => this.createNode(entry, node.path));
        this.updateNode(node.path, current => ({
          ...current,
          children,
          loaded: true,
          expanded: true,
          loading: false,
          // The entry was optimistically marked expandable; if it has no children, drop the caret.
          entry: result.entries.length === 0 ? { ...current.entry, hasChildren: false } : current.entry
        }));
        onLoaded(children);
      }
    });
  }

  /** Shows the details of this node, and expands it to browse its children (never collapses it, see `toggle()` for that). */
  showDetails(node: ExploreTreeNode) {
    this.selectedPath.set(node.path);
    if (!node.expanded) {
      this.toggle(node);
    }
  }

  /** The type shown next to the node name, if the connector sends one. */
  summary(entry: SouthConnectorExploreEntry): string | number | null {
    const key = SUMMARY_METADATA_KEYS.find(candidate => entry.metadata[candidate] !== undefined);
    return key ? entry.metadata[key] : null;
  }

  onCopied(copied: boolean) {
    if (copied) {
      this.notificationService.success('south.explore.copied');
    } else {
      this.notificationService.error('south.explore.copy-error');
    }
  }

  isChecked(node: ExploreTreeNode): boolean {
    return this.checkedIds().has(node.entry.id);
  }

  toggleChecked(node: ExploreTreeNode) {
    this.checkedIds.update(checkedIds => {
      const updated = new Set(checkedIds);
      if (!updated.delete(node.entry.id)) {
        updated.add(node.entry.id);
      }
      return updated;
    });
  }

  /** Whether every sub-node of the node is checked - none can be before they are loaded. */
  allChildrenChecked(node: ExploreTreeNode): boolean {
    const checkedIds = this.checkedIds();
    return node.loaded && node.children.length > 0 && node.children.every(child => checkedIds.has(child.entry.id));
  }

  /**
   * Checks every sub-node of the node, or unchecks them when they all are - its direct children, loaded first if
   * needed. The node is expanded to show them.
   */
  toggleChildrenChecked(node: ExploreTreeNode) {
    if (!node.loaded) {
      this.loadChildren(node, children => this.setChecked(children, true));
      return;
    }
    this.setChecked(node.children, !this.allChildrenChecked(node));
    if (!node.expanded) {
      this.updateNode(node.path, current => ({ ...current, expanded: true }));
    }
  }

  private setChecked(nodes: ReadonlyArray<ExploreTreeNode>, checked: boolean) {
    this.checkedIds.update(checkedIds => {
      const updated = new Set(checkedIds);
      for (const node of nodes) {
        if (checked) {
          updated.add(node.entry.id);
        } else {
          updated.delete(node.entry.id);
        }
      }
      return updated;
    });
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
