import { Component, inject, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { Observable } from 'rxjs';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ModalService } from '../modal.service';
import { SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { DatetimePipe } from '../datetime.pipe';
import { FileSizePipe } from '../file-size.pipe';
import {
  OIBusSouthType,
  SouthConnectorExploreEntry,
  SouthConnectorManifest,
  SouthExploreBrowseResult,
  SouthExploreStartResult
} from '../../../../../backend/shared/model/south-connector.model';
import {
  ExistingItemForMatch,
  ItemImportWizardComponent,
  WizardCheckedItem,
  WizardCheckFn
} from '../item-import-wizard/item-import-wizard.component';

/**
 * Backend calls needed to create items from an explore-tree selection: validate the current rows
 * (`checkFn`, forwarded straight into the item-import wizard) and actually import the resolved items
 * once the wizard is done (`importFn`) — either a real HTTP import for a persisted connector, or a
 * local push into an unsaved connector's in-memory item list.
 */
export interface CreateItemsApi {
  expectedHeaders: Array<string>;
  optionalHeaders: Array<string>;
  checkFn: WizardCheckFn;
  importFn: (items: Array<WizardCheckedItem>, matchKey: string | null) => Observable<void>;
}

interface ExploreTreeNode {
  entry: SouthConnectorExploreEntry;
  depth: number;
  expanded: boolean;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  selected: boolean;
  children: Array<ExploreTreeNode>;
}

/**
 * Backend calls needed to drive an explore session, kept as a plain port so the modal isn't tied
 * to `SouthConnectorService` — a south connector and a history query's south settings start/browse/
 * close their explore sessions through different endpoints.
 */
export interface SouthExploreApi {
  start(settings: SouthSettings, type: OIBusSouthType): Observable<SouthExploreStartResult>;
  browse(sessionId: string, parentId: string | null): Observable<SouthExploreBrowseResult>;
  close(sessionId: string): Observable<void>;
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
  imports: [TranslateDirective, NgTemplateOutlet, KeyValuePipe, DatetimePipe, FileSizePipe]
})
export class SouthExploreModalComponent implements OnDestroy {
  private modal = inject(NgbActiveModal);
  private modalService = inject(ModalService);
  private southConnectorService = inject(SouthConnectorService);

  private api: SouthExploreApi | null = null;
  private createItemsApi: CreateItemsApi | null = null;
  manifest!: SouthConnectorManifest;
  existingItems: Array<ExistingItemForMatch> = [];
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
   * @param manifest - the south connector manifest, used by the item-creation wizard triggered from
   *   the selection
   * @param api - override the backend calls used to start/browse/close the session — needed when
   *   exploring settings that don't belong to a standalone south connector (e.g. a history query's
   *   south settings). Defaults to the south connector explore endpoints keyed by `connectorId`.
   * @param existingItems - the connector's current items, used by the item-creation wizard to resolve
   *   a match key onto an existing item.
   * @param createItemsApi - the check/import backend calls used by the item-creation wizard triggered
   *   from the selection. When omitted, "Create items from selection" is disabled.
   */
  prepare(
    connectorId: string | null,
    settingsToExplore: SouthSettings,
    southType: OIBusSouthType,
    manifest: SouthConnectorManifest,
    api?: SouthExploreApi,
    existingItems: Array<ExistingItemForMatch> = [],
    createItemsApi?: CreateItemsApi
  ) {
    this.manifest = manifest;
    this.existingItems = existingItems;
    this.createItemsApi = createItemsApi ?? null;
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

  private createNode(entry: SouthConnectorExploreEntry, depth: number): ExploreTreeNode {
    return { entry, depth, expanded: false, loading: false, loaded: false, error: null, selected: false, children: [] };
  }

  toggleSelection(node: ExploreTreeNode) {
    node.selected = !node.selected;
  }

  get selectedNodes(): Array<SouthConnectorExploreEntry> {
    const selected: Array<SouthConnectorExploreEntry> = [];
    const collect = (nodes: Array<ExploreTreeNode>) => {
      for (const node of nodes) {
        if (node.selected) {
          selected.push(node.entry);
        }
        collect(node.children);
      }
    };
    collect(this.nodes);
    return selected;
  }

  get canCreateItemsFromSelection(): boolean {
    return this.createItemsApi !== null;
  }

  createItemsFromSelection() {
    if (!this.createItemsApi) {
      return;
    }
    const createItemsApi = this.createItemsApi;
    const modalRef = this.modalService.open(ItemImportWizardComponent, { size: 'xl', backdrop: 'static' });
    modalRef.componentInstance.prepare(
      this.manifest,
      createItemsApi.expectedHeaders,
      createItemsApi.optionalHeaders,
      this.selectedNodes,
      this.existingItems,
      createItemsApi.checkFn
    );
    modalRef.result.subscribe((result: { items: Array<WizardCheckedItem>; matchKey: string | null } | undefined) => {
      if (!result) {
        return;
      }
      createItemsApi.importFn(result.items, result.matchKey).subscribe(() => {
        this.modal.close(result);
      });
    });
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
      this.api!.close(this.sessionId).subscribe({ error: () => undefined });
    }
  }
}
