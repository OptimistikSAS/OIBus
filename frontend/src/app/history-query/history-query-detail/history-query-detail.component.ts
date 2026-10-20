import { ClipboardModule } from '@angular/cdk/clipboard';
import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, EMPTY, firstValueFrom, map, switchMap, tap } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { OIBusInfo } from '@oibus/shared/api/engine.model';
import { HistoryQueryDTO, HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '@oibus/shared/api/history-query.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorCommandDTO, SouthConnectorItemCommandDTO } from '@oibus/shared/api/south-connector.model';
import { HistoryTransformerDTOWithOptions, TransformerDTO } from '@oibus/shared/api/transformer.model';
import { OIBusAttribute, OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { NorthConnectorManifest } from '@oibus/shared/connector/north-manifest.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { AuditEntityType } from '@oibus/shared/domain/audit.model';
import { HistoryQueryMetrics } from '@oibus/shared/domain/engine.model';
import { HistoryQueryStatus } from '@oibus/shared/domain/history-query.model';

import { LogsComponent } from '../../logs/logs.component';
import { CertificateService } from '../../services/certificate.service';
import { EngineService } from '../../services/engine.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { TransformerService } from '../../services/transformer.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DocsUrlService } from '../../shared/docs-url.service';
import { ExploreButtonComponent } from '../../shared/explore-button/explore-button.component';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { findItemIndex } from '../../shared/find-item-index';
import { isDisplayableAttribute } from '../../shared/form/dynamic-form.builder';
import { OIBusSettingsSummaryComponent } from '../../shared/form/oibus-settings-summary/oibus-settings-summary.component';
import { SettingSummary, summarizeSettings } from '../../shared/form/oibus-settings-summary/settings-summary';
import { ItemTableComponent } from '../../shared/item-table/item-table.component';
import { ITEM_TABLE_TEMPLATES } from '../../shared/item-table/item-table-templates';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { pollMetrics } from '../../shared/polling';
import { ObservableState } from '../../shared/save-button/save-button.component';
import { isScanModeWindowExpired } from '../../shared/scan-mode-schedule.pipe';
import { SouthExploreModalComponent, SouthExploreResult } from '../../shared/south-explore-modal/south-explore-modal.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { AddDiscoveredItemsModalComponent } from '../../south/south-items/add-discovered-items-modal/add-discovered-items-modal.component';
import { exploreCheckedActions } from '../../south/south-workflows/workflow-creation.service';
import { EditHistoryQueryItemModalComponent } from '../history-query-items/edit-history-query-item-modal/edit-history-query-item-modal.component';
import { toHistoryQueryItemCommand } from '../history-query-items/history-query-item-command';
import { ImportHistoryQueryItemsModalComponent } from '../history-query-items/import-history-query-items-modal/import-history-query-items-modal.component';
import { HistoryQueryTransformersComponent } from '../history-query-transformers/history-query-transformers.component';
import { HistoryMetricsComponent } from './history-metrics/history-metrics.component';

@Component({
  selector: 'oib-history-query-detail',
  imports: [
    TranslateDirective,
    RouterLink,
    BoxComponent,
    BoxTitleDirective,
    HistoryMetricsComponent,
    AsyncPipe,
    ClipboardModule,
    LogsComponent,
    OIBusNorthTypeEnumPipe,
    OIBusSouthTypeEnumPipe,
    TranslatePipe,
    NgbTooltip,
    HistoryQueryTransformersComponent,
    OibHelpComponent,
    DatetimePipe,
    ItemTableComponent,
    ...ITEM_TABLE_TEMPLATES,
    OIBusSettingsSummaryComponent,
    ExploreButtonComponent
  ],
  templateUrl: './history-query-detail.component.html',
  styleUrl: './history-query-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryQueryDetailComponent {
  private readonly historyQueryService = inject(HistoryQueryService);
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly notificationService = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly scanModeService = inject(ScanModeService);
  private readonly certificateService = inject(CertificateService);
  private readonly transformerService = inject(TransformerService);
  private readonly modalService = inject(ModalService);
  private readonly engineService = inject(EngineService);
  protected readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translateService = inject(TranslateService);
  private readonly docsUrlService = inject(DocsUrlService);

  readonly itemSectionHelpUrl = this.docsUrlService.resolve('guide/south-connectors/common-settings#item-section');

  private readonly references = toSignal(
    combineLatest([this.scanModeService.list(), this.certificateService.list(), this.transformerService.list(), this.engineService.info$])
  );
  readonly scanModes = computed<Array<ScanModeDTO>>(() =>
    (this.references()?.[0] ?? []).filter(scanMode => scanMode.id !== 'subscription')
  );
  readonly certificates = computed<Array<CertificateDTO>>(() => this.references()?.[1] ?? []);
  readonly transformers = computed<Array<TransformerDTO>>(() => this.references()?.[2] ?? []);
  readonly oibusInfo = computed<OIBusInfo | null>(() => this.references()?.[3] ?? null);

  readonly historyQueryId = toSignal(this.route.paramMap.pipe(map(params => params.get('historyQueryId') || '')), {
    initialValue: ''
  });
  private readonly historyQueryResource = rxResource({
    params: () => this.historyQueryId() || undefined,
    stream: ({ params }) => this.historyQueryService.findById(params)
  });
  private readonly itemTable = viewChild(ItemTableComponent);
  readonly historyQuery = computed<HistoryQueryDTO | null>(() =>
    this.historyQueryResource.hasValue() ? this.historyQueryResource.value() : null
  );

  private readonly northType = computed(() => this.historyQuery()?.northType);
  private readonly southType = computed(() => this.historyQuery()?.southType);
  private readonly manifests = rxResource({
    params: () => {
      const northType = this.northType();
      const southType = this.southType();
      return northType && southType ? { northType, southType } : undefined;
    },
    stream: ({ params }) =>
      combineLatest([
        this.northConnectorService.getNorthManifest(params.northType),
        this.southConnectorService.getSouthManifest(params.southType)
      ])
  });
  readonly northManifest = computed<NorthConnectorManifest | null>(() => (this.manifests.hasValue() ? this.manifests.value()[0] : null));
  readonly southManifest = computed<SouthConnectorManifest | null>(() => (this.manifests.hasValue() ? this.manifests.value()[1] : null));

  readonly northDisplayedSettings = computed(() => {
    const northManifest = this.northManifest();
    const historyQuery = this.historyQuery();
    return northManifest && historyQuery ? this.displayedSettings(northManifest.settings, historyQuery.northSettings) : [];
  });
  readonly southDisplayedSettings = computed(() => {
    const southManifest = this.southManifest();
    const historyQuery = this.historyQuery();
    return southManifest && historyQuery ? this.displayedSettings(southManifest.settings, historyQuery.southSettings) : [];
  });
  /** The item settings displayed as columns of the items table */
  readonly displaySettings = computed<Array<OIBusAttribute>>(() => {
    const settingsAttribute = this.itemSettingsAttribute();
    return settingsAttribute ? settingsAttribute.attributes.filter(setting => isDisplayableAttribute(setting)) : [];
  });
  private readonly itemSettingsAttribute = computed(
    () =>
      (this.southManifest()?.items.rootAttribute.attributes.find(attribute => attribute.key === 'settings') as
        OIBusObjectAttribute | undefined) ?? null
  );

  /**
   * The metrics are polled once the history query is displayed, and polling is restarted when the history query is
   * started and stopped when it is paused. Null when stopped, incremented to restart.
   */
  private readonly metricsPollingRun = signal<number | null>(0);
  private readonly metricsPolling = computed(() => {
    const historyId = this.historyQuery()?.id;
    const run = this.metricsPollingRun();
    return historyId && run !== null && this.manifests.hasValue() ? { historyId, run } : null;
  });
  readonly historyMetrics = toSignal(
    toObservable(this.metricsPolling).pipe(
      switchMap(polling => (polling ? pollMetrics(() => this.historyQueryService.getMetrics(polling.historyId)) : EMPTY)),
      tap(metrics => {
        const historyQuery = this.historyQuery();
        if (historyQuery && historyQuery.status !== 'FINISHED' && this.isFinished(metrics)) {
          this.historyQueryResource.set({ ...historyQuery, status: 'FINISHED' });
        }
      })
    ),
    { initialValue: null }
  );
  readonly state = new ObservableState();

  /** The items of the history query, as an array of the item union type (the DTO is typed by connector type) */
  readonly items = computed<Array<HistoryQueryItemDTO>>(() => this.historyQuery()?.items ?? []);
  /** The selected items, by name */
  readonly selectedItems = signal<ReadonlyMap<string, HistoryQueryItemDTO>>(new Map());

  /** Whether a scan mode's activation window can never fire again. */
  isWindowExpired(scanMode: ScanModeDTO | null | undefined): boolean {
    return isScanModeWindowExpired(scanMode);
  }

  updateInMemoryTransformers(_transformers: Array<HistoryTransformerDTOWithOptions> | null) {
    this.refreshHistoryQuery();
  }

  private refreshHistoryQuery() {
    this.historyQueryResource.reload();
  }

  /** Settings of the north or south of the history query, summed up from their manifest */
  private displayedSettings(settingsManifest: OIBusObjectAttribute, settingsValue: object): Array<SettingSummary> {
    return summarizeSettings(settingsManifest, settingsValue, {
      translateService: this.translateService,
      scanModes: this.scanModes(),
      certificates: this.certificates(),
      applyEnablingConditions: true
    });
  }

  toggleHistoryQuery(newStatus: HistoryQueryStatus) {
    const historyQueryId = this.historyQuery()!.id;
    const toggle =
      newStatus === 'RUNNING' ? this.historyQueryService.start(historyQueryId) : this.historyQueryService.pause(historyQueryId);
    toggle
      .pipe(
        this.state.pendingUntilFinalization(),
        switchMap(() => this.historyQueryService.findById(historyQueryId))
      )
      .subscribe(updatedHistoryQuery => {
        this.historyQueryResource.set(updatedHistoryQuery);
        if (newStatus === 'RUNNING') {
          this.notificationService.success('history-query.started', { name: updatedHistoryQuery.name });
          this.metricsPollingRun.update(run => (run ?? 0) + 1);
        } else {
          this.notificationService.success('history-query.paused', { name: updatedHistoryQuery.name });
          this.metricsPollingRun.set(null);
        }
      });
  }

  onClipboardCopy(result: boolean) {
    if (result) {
      this.notificationService.success('history-query.cache-path-copy.success');
    } else {
      this.notificationService.error('history-query.cache-path-copy.error');
    }
  }

  test(type: 'south' | 'north') {
    const modalRef = this.modalService.open(TestConnectionResultModalComponent, { backdrop: 'static' });
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    const historyQuery = this.historyQuery()!;
    component.runHistoryQueryTest(
      type,
      historyQuery.id,
      type === 'south' ? historyQuery.southSettings : historyQuery.northSettings,
      type === 'south' ? historyQuery.southType : historyQuery.northType
    );
  }

  explore() {
    const historyQuery = this.historyQuery()!;
    const modalRef = this.modalService.open(SouthExploreModalComponent, { size: 'xl' });
    const component: SouthExploreModalComponent = modalRef.componentInstance;
    component.prepare(historyQuery.id, historyQuery.southSettings, historyQuery.southType, {
      api: {
        start: (settings, type) => this.historyQueryService.startExplore(historyQuery.id, settings, type),
        browse: (sessionId, parentId) => this.historyQueryService.browseExplore(historyQuery.id, sessionId, parentId),
        close: sessionId => this.historyQueryService.closeExplore(historyQuery.id, sessionId)
      },
      // the items of the checked nodes can be added, with the discovery defaults of the connector: there is no synchronisation
      checkedActions: exploreCheckedActions(this.southManifest()!).filter(action => action.id === 'add-items')
    });
    modalRef.result.subscribe((result: SouthExploreResult) => {
      if (result?.action === 'add-items') {
        this.addDiscoveredItems(result.nodeIds);
      }
    });
  }

  /** Reviews the items the checked nodes give, then creates them and reloads the history query. */
  private addDiscoveredItems(nodeIds: Array<string>) {
    const historyQuery = this.historyQuery()!;
    const modalRef = this.modalService.open(AddDiscoveredItemsModalComponent, { size: 'xl', backdrop: 'static' });
    const component: AddDiscoveredItemsModalComponent = modalRef.componentInstance;
    component.prepare({
      southId: historyQuery.id,
      southSettings: historyQuery.southSettings,
      manifest: this.southManifest()!,
      existingItems: historyQuery.items,
      nodeIds,
      discover: (discoveryScope, itemFieldMapping) =>
        this.historyQueryService.discoverItems(
          historyQuery.id,
          historyQuery.southType,
          historyQuery.southSettings,
          discoveryScope,
          itemFieldMapping
        )
    });
    modalRef.result
      .pipe(
        switchMap((commands: Array<SouthConnectorItemCommandDTO>) =>
          this.historyQueryService
            .importItems(
              historyQuery.id,
              commands.map(command => toHistoryQueryItemCommand(command))
            )
            .pipe(map(() => commands.length))
        )
      )
      .subscribe(count => {
        this.refreshHistoryQuery();
        this.itemTable()?.goToFirstPage();
        this.notificationService.success('south.add-discovered-items.added', { count: String(count) });
      });
  }

  /** The history query is finished when all the intervals are retrieved and all the data is sent */
  private isFinished(historyMetrics: HistoryQueryMetrics): boolean {
    return historyMetrics.historyMetrics.intervalProgress === 1 && historyMetrics.north.currentCacheSize === 0;
  }

  private get southConnectorCommand() {
    return {
      type: this.southManifest()!.id,
      settings: this.historyQuery()!.southSettings
    } as SouthConnectorCommandDTO;
  }

  // Item management methods

  addItem() {
    this.openItemCreation(this.historyQuery()!.items, null);
  }

  /**
   * Opens the modal for a new item, and again after each item saved with "save and add another".
   * @param items the items of the history query, the ones added just before included
   * @param previousItem the item added just before, whose shared settings the new one starts with
   */
  private openItemCreation(
    items: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO>,
    previousItem: HistoryQueryItemCommandDTO | null
  ) {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    const historyQuery = this.historyQuery()!;
    component.prepareForCreation(items, historyQuery.id, null, this.southConnectorCommand, this.southManifest()!, previousItem);
    modalRef.result
      .pipe(
        switchMap((command: HistoryQueryItemCommandDTO) =>
          this.historyQueryService.createItem(historyQuery.id, command).pipe(map(() => command))
        )
      )
      .subscribe(command => {
        this.notificationService.success('history-query.items.created');
        this.refreshHistoryQuery();
        // the history query is reloaded in the background: the next item is checked against the item just added too
        if (component.addAnother) {
          this.openItemCreation([...items, command], command);
        }
      });
  }

  editItem(historyQueryItem: HistoryQueryItemDTO) {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    const historyQuery = this.historyQuery()!;
    const tableIndex = findItemIndex(historyQuery.items, historyQueryItem);
    component.prepareForEdition(
      historyQuery.items,
      historyQueryItem,
      historyQuery.id,
      null,
      this.southConnectorCommand,
      this.southManifest()!,
      tableIndex
    );
    modalRef.result
      .pipe(switchMap((command: HistoryQueryItemCommandDTO) => this.historyQueryService.updateItem(historyQuery.id, command.id!, command)))
      .subscribe(() => {
        this.notificationService.success('history-query.items.updated');
        this.refreshHistoryQuery();
      });
  }

  duplicateItem(item: HistoryQueryItemDTO) {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    const historyQuery = this.historyQuery()!;
    component.prepareForCopy(historyQuery.items, item, historyQuery.id, null, this.southConnectorCommand, this.southManifest()!);
    modalRef.result
      .pipe(switchMap((command: HistoryQueryItemCommandDTO) => this.historyQueryService.createItem(historyQuery.id, command)))
      .subscribe(() => {
        this.notificationService.success('history-query.items.created');
        this.refreshHistoryQuery();
      });
  }

  deleteItem(item: HistoryQueryItemDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'history-query.items.confirm-deletion'
      })
      .pipe(switchMap(() => this.historyQueryService.deleteItem(this.historyQuery()!.id, item.id)))
      .subscribe(() => {
        this.notificationService.success('history-query.items.deleted');
        this.refreshHistoryQuery();
      });
  }

  deleteAllItems() {
    this.confirmationService
      .confirm({
        messageKey: 'history-query.items.confirm-delete-all'
      })
      .pipe(switchMap(() => this.historyQueryService.deleteAllItems(this.historyQuery()!.id)))
      .subscribe(() => {
        this.notificationService.success('history-query.items.all-deleted');
        this.refreshHistoryQuery();
      });
  }

  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent, { backdrop: 'static' });
    const filename = `${this.historyQuery()?.name || 'items'}`;
    modalRef.componentInstance.prepare(filename);
    modalRef.result.subscribe(response => {
      if (response) {
        this.historyQueryService.exportItems(this.historyQuery()!.id, response.filename, response.delimiter).subscribe();
      }
    });
  }

  importItems() {
    const modalRef = this.modalService.open(ImportHistoryQueryItemsModalComponent, { size: 'xl', backdrop: 'static' });
    const expectedHeaders = ['name', 'enabled'];
    const optionalHeaders: Array<string> = ['scanMode'];

    const settingsAttribute = this.itemSettingsAttribute()!;
    settingsAttribute.attributes.forEach(setting => {
      if (settingsAttribute.enablingConditions.find(element => element.targetPathFromRoot === setting.key)) {
        optionalHeaders.push(`settings_${setting.key}`);
      } else {
        expectedHeaders.push(`settings_${setting.key}`);
      }
    });

    const checkFn = (file: File, delimiter: string, deleteItemsNotPresent: boolean) =>
      this.historyQueryService.checkImportItems(
        this.southManifest()!.id,
        this.historyQuery()!.items,
        file,
        delimiter,
        deleteItemsNotPresent
      );

    modalRef.componentInstance.prepare(this.southManifest()!, expectedHeaders, optionalHeaders, true, checkFn);
    modalRef.result.subscribe((response: { items: Array<HistoryQueryItemCommandDTO>; eraseExisting: boolean } | undefined) => {
      if (!response) return;
      this.historyQueryService.importItems(this.historyQuery()!.id, response.items, response.eraseExisting).subscribe(() => {
        this.notificationService.success('history-query.items.imported');
        this.refreshHistoryQuery();
      });
    });
  }

  getFieldValue(settings: object, field: string): string {
    const value: unknown = (settings as Record<string, unknown>)[field];
    const foundFormControl = this.itemSettingsAttribute()?.attributes.find(formControl => formControl.key === field);
    if (foundFormControl && value && foundFormControl.type === 'string-select') {
      return this.translateService.instant(`${foundFormControl.translationKey}.${value}`);
    }
    return value == null ? '' : String(value);
  }

  // Mass action methods

  unselectAll() {
    this.selectedItems.set(new Map());
  }

  enableSelectedItems() {
    const itemIds = Array.from(this.selectedItems().values(), item => item.id);
    if (itemIds.length === 0) return;
    this.historyQueryService.enableItems(this.historyQuery()!.id, itemIds).subscribe(() => {
      this.notificationService.success('history-query.items.enabled-multiple', { count: itemIds.length.toString() });
      this.unselectAll();
      this.refreshHistoryQuery();
    });
  }

  disableSelectedItems() {
    const itemIds = Array.from(this.selectedItems().values(), item => item.id);
    if (itemIds.length === 0) return;
    this.historyQueryService.disableItems(this.historyQuery()!.id, itemIds).subscribe(() => {
      this.notificationService.success('history-query.items.disabled-multiple', { count: itemIds.length.toString() });
      this.unselectAll();
      this.refreshHistoryQuery();
    });
  }

  deleteSelectedItems() {
    const itemIds = Array.from(this.selectedItems().values(), item => item.id);
    if (itemIds.length === 0) return;
    this.confirmationService
      .confirm({
        messageKey: 'history-query.items.delete-multiple-message',
        interpolateParams: { count: itemIds.length.toString() }
      })
      .pipe(switchMap(() => this.historyQueryService.deleteItems(this.historyQuery()!.id, itemIds)))
      .subscribe(() => {
        this.notificationService.success('history-query.items.deleted-multiple', { count: itemIds.length.toString() });
        this.unselectAll();
        this.refreshHistoryQuery();
      });
  }

  /**
   * Open a modal to view the audit history of the history query or one of its items
   */
  showAudit(entityType: Extract<AuditEntityType, 'history_query' | 'history_query_item'>, entityId: string) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare(entityType, entityId);
  }
}
