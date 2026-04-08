import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, firstValueFrom, merge, of, switchMap } from 'rxjs';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import {
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryItemDTO,
  HistoryQueryStatus
} from '../../../../../backend/shared/model/history-query.model';
import { SouthConnectorCommandDTO, SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HistoryMetricsComponent } from './history-metrics/history-metrics.component';
import { HistoryQueryMetrics, OIBusInfo } from '../../../../../backend/shared/model/engine.model';
import { WindowService } from '../../shared/window.service';
import { NotificationService } from '../../shared/notification.service';
import { ObservableState } from '../../shared/save-button/save-button.component';
import { EngineService } from '../../services/engine.service';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { ModalService } from '../../shared/modal.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { LogsComponent } from '../../logs/logs.component';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { CertificateService } from '../../services/certificate.service';
import { isDisplayableAttribute } from '../../shared/form/dynamic-form.builder';
import { NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TransformerService } from '../../services/transformer.service';
import { HistoryTransformerDTOWithOptions, TransformerDTO } from '../../../../../backend/shared/model/transformer.model';
import { HistoryQueryTransformersComponent } from '../history-query-transformers/history-query-transformers.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { ConfirmationService } from '../../shared/confirmation.service';
import { EditHistoryQueryItemModalComponent } from '../history-query-items/edit-history-query-item-modal/edit-history-query-item-modal.component';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { ImportItemModalComponent } from '../../shared/import-item-modal/import-item-modal.component';
import { ImportHistoryQueryItemsModalComponent } from '../history-query-items/import-history-query-items-modal/import-history-query-items-modal.component';
import { OIBusAttribute, OIBusObjectAttribute } from '../../../../../backend/shared/model/form.model';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';

const PAGE_SIZE = 20;

const enum ColumnSortState {
  INDETERMINATE = 0,
  ASCENDING = 1,
  DESCENDING = 2
}

export interface TableData {
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'oib-history-query-detail',
  imports: [
    TranslateDirective,
    RouterLink,
    BoxComponent,
    BoxTitleDirective,
    ReactiveFormsModule,
    FormsModule,
    HistoryMetricsComponent,
    AsyncPipe,
    ClipboardModule,
    LogsComponent,
    OIBusNorthTypeEnumPipe,
    OIBusSouthTypeEnumPipe,
    TranslatePipe,
    NgbTooltip,
    HistoryQueryTransformersComponent,
    PaginationComponent,
    DatetimePipe,
    NgbDropdown,
    NgbDropdownMenu,
    NgbDropdownToggle,
    NgbDropdownItem,
    OibHelpComponent
  ],
  templateUrl: './history-query-detail.component.html',
  styleUrl: './history-query-detail.component.scss',
  providers: [PageLoader]
})
export class HistoryQueryDetailComponent implements OnInit, OnDestroy {
  private historyQueryService = inject(HistoryQueryService);
  private northConnectorService = inject(NorthConnectorService);
  private southConnectorService = inject(SouthConnectorService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);
  private scanModeService = inject(ScanModeService);
  private certificateService = inject(CertificateService);
  private transformerService = inject(TransformerService);
  private modalService = inject(ModalService);
  private engineService = inject(EngineService);
  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private windowService = inject(WindowService);
  private cd = inject(ChangeDetectorRef);
  private translateService = inject(TranslateService);

  historyQuery: HistoryQueryDTO | null = null;
  northDisplayedSettings: Array<{ key: string; value: string }> = [];
  southDisplayedSettings: Array<{ key: string; value: string }> = [];

  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  transformers: Array<TransformerDTO> = [];
  northManifest: NorthConnectorManifest | null = null;
  southManifest: SouthConnectorManifest | null = null;

  historyMetrics: HistoryQueryMetrics | null = null;
  historyStream: EventSource | null = null;
  state = new ObservableState();
  oibusInfo: OIBusInfo | null = null;
  historyQueryId: string | null = null;

  // Item management properties
  filteredItems: Array<HistoryQueryItemDTO> = [];
  displayedItems: Page<HistoryQueryItemDTO> = emptyPage();
  displaySettings: Array<OIBusAttribute> = [];
  searchControl = inject(NonNullableFormBuilder).control(null as string | null);
  statusFilterControl = inject(NonNullableFormBuilder).control(null as string | null);

  selectedItems = new Map<string, HistoryQueryItemDTO>();
  isAllSelected = false;
  isIndeterminate = false;

  columnSortStates: { [key in keyof TableData]: ColumnSortState } = {
    name: ColumnSortState.INDETERMINATE,
    enabled: ColumnSortState.INDETERMINATE,
    createdAt: ColumnSortState.INDETERMINATE,
    updatedAt: ColumnSortState.INDETERMINATE
  };
  currentColumnSort: keyof TableData | null = null;

  ngOnInit() {
    combineLatest([
      this.scanModeService.list(),
      this.certificateService.list(),
      this.transformerService.list(),
      this.engineService.info$
    ]).subscribe(([scanModes, certificates, transformers, engineInfo]) => {
      this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
      this.certificates = certificates;
      this.transformers = transformers;
      this.oibusInfo = engineInfo;
    });
    this.route.paramMap
      .pipe(
        switchMap(params => {
          this.historyQueryId = params.get('historyQueryId') || '';

          if (this.historyQueryId) {
            return this.historyQueryService.findById(this.historyQueryId);
          }
          return of(null);
        }),
        switchMap(historyQuery => {
          if (!historyQuery) {
            return combineLatest([of(null), of(null), of(null)]);
          }
          this.historyQuery = historyQuery;
          return combineLatest([
            this.northConnectorService.getNorthManifest(historyQuery.northType),
            this.southConnectorService.getSouthManifest(historyQuery.southType)
          ]);
        })
      )
      .subscribe(([northManifest, southManifest]) => {
        if (!northManifest || !southManifest) {
          return;
        }
        this.northManifest = northManifest;
        this.southManifest = southManifest;
        this.connectToEventSource();

        // Initialize display settings for items
        const settingsAttribute = southManifest.items.rootAttribute.attributes.find(
          attribute => attribute.key === 'settings'
        )! as OIBusObjectAttribute;
        this.displaySettings = settingsAttribute.attributes.filter(setting => isDisplayableAttribute(setting));

        const northSettings: Record<string, string> = JSON.parse(JSON.stringify(this.historyQuery!.northSettings));
        this.northDisplayedSettings = northManifest.settings.attributes
          .filter(setting => isDisplayableAttribute(setting))
          .filter(setting => {
            const condition = northManifest.settings.enablingConditions.find(
              enablingCondition => enablingCondition.targetPathFromRoot === setting.key
            );
            return (
              !condition ||
              (condition &&
                northSettings[condition.referralPathFromRoot] &&
                condition.values.includes(northSettings[condition.referralPathFromRoot]))
            );
          })
          .map(setting => {
            return {
              key: setting.type === 'string-select' ? setting.translationKey + '.title' : setting.translationKey,
              value:
                setting.type === 'string-select'
                  ? this.translateService.instant(setting.translationKey + '.' + northSettings[setting.key])
                  : northSettings[setting.key]
            };
          });

        const southSettings: Record<string, string> = JSON.parse(JSON.stringify(this.historyQuery!.southSettings));
        this.southDisplayedSettings = southManifest.settings.attributes
          .filter(setting => isDisplayableAttribute(setting))
          .filter(setting => {
            const condition = southManifest.settings.enablingConditions.find(
              enablingCondition => enablingCondition.targetPathFromRoot === setting.key
            );
            return (
              !condition ||
              (condition &&
                southSettings[condition.referralPathFromRoot] &&
                condition.values.includes(southSettings[condition.referralPathFromRoot]))
            );
          })
          .map(setting => {
            return {
              key: setting.type === 'string-select' ? setting.translationKey + '.title' : setting.translationKey,
              value:
                setting.type === 'string-select'
                  ? this.translateService.instant(setting.translationKey + '.' + southSettings[setting.key])
                  : southSettings[setting.key]
            };
          });

        this.resetPage();
      });

    // Subscribe to filter control changes
    merge(this.searchControl.valueChanges, this.statusFilterControl.valueChanges).subscribe(() => {
      this.resetPage();
    });
  }

  updateInMemoryTransformers(_transformers: Array<HistoryTransformerDTOWithOptions> | null) {
    this.refreshHistoryQuery();
  }

  private refreshHistoryQuery() {
    this.historyQueryService.findById(this.historyQuery!.id).subscribe(historyQuery => {
      this.historyQuery = JSON.parse(JSON.stringify(historyQuery));
      this.resetPage();
    });
  }

  connectToEventSource(): void {
    if (this.historyStream) {
      this.historyStream.close();
    }

    const token = this.windowService.getStorageItem('oibus-token');
    this.historyStream = new EventSource(`/sse/history-queries/${this.historyQuery!.id}?token=${token}`, { withCredentials: true });
    this.historyStream.addEventListener('message', (event: MessageEvent) => {
      if (event && event.data) {
        this.historyMetrics = JSON.parse(event.data);
        this.cd.detectChanges();

        if (this.historyQuery && this.historyQueryFinishedByMetrics) {
          this.historyQuery.status = 'FINISHED';
        }
      }
    });
  }

  ngOnDestroy() {
    this.historyStream?.close();
  }

  toggleHistoryQuery(newStatus: HistoryQueryStatus) {
    if (newStatus === 'RUNNING') {
      this.historyQueryService
        .start(this.historyQuery!.id)
        .pipe(
          this.state.pendingUntilFinalization(),
          switchMap(() => {
            return this.historyQueryService.findById(this.historyQuery!.id);
          })
        )
        .subscribe(updatedHistoryQuery => {
          this.historyQuery = updatedHistoryQuery;
          this.notificationService.success('history-query.started', { name: this.historyQuery!.name });
          this.connectToEventSource();
        });
    } else {
      this.historyQueryService
        .pause(this.historyQuery!.id)
        .pipe(
          this.state.pendingUntilFinalization(),
          switchMap(() => {
            return this.historyQueryService.findById(this.historyQuery!.id);
          })
        )
        .subscribe(updatedHistoryQuery => {
          this.historyQuery = updatedHistoryQuery;
          this.notificationService.success('history-query.paused', { name: this.historyQuery!.name });
          this.historyStream?.close();
        });
    }
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
    component.runHistoryQueryTest(
      type,
      this.historyQuery!.id,
      type === 'south' ? this.historyQuery!.southSettings : this.historyQuery!.northSettings,
      type === 'south' ? this.historyQuery!.southType : this.historyQuery!.northType
    );
  }

  get historyQueryFinishedByMetrics() {
    if (!this.historyMetrics || this.historyMetrics.historyMetrics.intervalProgress !== 1) {
      return false;
    }
    return this.historyMetrics.north.currentCacheSize === 0;
  }

  get southConnectorCommand() {
    return {
      type: this.southManifest!.id,
      settings: this.historyQuery!.southSettings
    } as SouthConnectorCommandDTO;
  }

  // Item management methods

  addItem() {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.historyQuery!.items, this.historyQuery!.id, null, this.southConnectorCommand, this.southManifest!);
    modalRef.result
      .pipe(
        switchMap((command: HistoryQueryItemCommandDTO) => {
          return this.historyQueryService.createItem(this.historyQuery!.id, command);
        })
      )
      .subscribe(() => {
        this.notificationService.success('history-query.items.created');
        this.refreshHistoryQuery();
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
    const tableIndex = this.historyQuery!.items.findIndex(i => i.id === historyQueryItem.id || i.name === historyQueryItem.name);
    component.prepareForEdition(
      this.historyQuery!.items,
      historyQueryItem,
      this.historyQuery!.id,
      null,
      this.southConnectorCommand,
      this.southManifest!,
      tableIndex
    );
    modalRef.result
      .pipe(
        switchMap((command: HistoryQueryItemCommandDTO) => {
          return this.historyQueryService.updateItem(this.historyQuery!.id, command.id!, command);
        })
      )
      .subscribe(() => {
        this.notificationService.success('history-query.items.updated');
        this.refreshHistoryQuery();
      });
  }

  duplicateItem(item: HistoryQueryItemDTO) {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    component.prepareForCopy(this.historyQuery!.items, item, this.historyQuery!.id, null, this.southConnectorCommand, this.southManifest!);
    modalRef.result
      .pipe(
        switchMap((command: HistoryQueryItemCommandDTO) => {
          return this.historyQueryService.createItem(this.historyQuery!.id, command);
        })
      )
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
      .pipe(
        switchMap(() => {
          return this.historyQueryService.deleteItem(this.historyQuery!.id, item.id!);
        })
      )
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
      .pipe(
        switchMap(() => {
          return this.historyQueryService.deleteAllItems(this.historyQuery!.id);
        })
      )
      .subscribe(() => {
        this.notificationService.success('history-query.items.all-deleted');
        this.refreshHistoryQuery();
      });
  }

  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent, { backdrop: 'static' });
    const filename = `${this.historyQuery?.name || 'items'}`;
    modalRef.componentInstance.prepare(filename);
    modalRef.result.subscribe(response => {
      if (response) {
        this.historyQueryService.exportItems(this.historyQuery!.id, response.filename, response.delimiter).subscribe();
      }
    });
  }

  importItems() {
    const modalRef = this.modalService.open(ImportItemModalComponent, { backdrop: 'static' });
    const expectedHeaders = ['name', 'enabled'];
    const optionalHeaders: Array<string> = ['scanMode'];

    const settingsAttribute = this.southManifest!.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    settingsAttribute.attributes.forEach(setting => {
      if (settingsAttribute.enablingConditions.find(element => element.targetPathFromRoot === setting.key)) {
        optionalHeaders.push(`settings_${setting.key}`);
      } else {
        expectedHeaders.push(`settings_${setting.key}`);
      }
    });
    modalRef.componentInstance.prepare(expectedHeaders, optionalHeaders, [], false);
    modalRef.result.subscribe(response => {
      if (!response) return;
      this.checkImportItems(response.file, response.delimiter);
    });
  }

  checkImportItems(file: File, delimiter: string) {
    this.historyQueryService.checkImportItems(this.southManifest!.id, this.historyQuery!.items, file, delimiter).subscribe(result => {
      const modalRef = this.modalService.open(ImportHistoryQueryItemsModalComponent, { size: 'xl', backdrop: 'static' });
      const component: ImportHistoryQueryItemsModalComponent = modalRef.componentInstance;
      component.prepare(this.southManifest!, this.historyQuery!.items, result.items, result.errors);
      modalRef.result
        .pipe(
          switchMap((newItems: Array<HistoryQueryItemCommandDTO>) => {
            return this.historyQueryService.importItems(this.historyQuery!.id, newItems);
          })
        )
        .subscribe(() => {
          this.notificationService.success('history-query.items.imported');
          this.refreshHistoryQuery();
        });
    });
  }

  getFieldValue(element: any, field: string): string {
    const settingsAttribute = this.southManifest!.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;

    const foundFormControl = settingsAttribute.attributes.find(formControl => formControl.key === field);
    if (foundFormControl && element[field] && foundFormControl.type === 'string-select') {
      return this.translateService.instant(foundFormControl.translationKey + '.' + element[field]);
    }
    return element[field];
  }

  // Filter, sort, pagination

  resetPage() {
    this.filteredItems = this.filter();
    this.changePage(0);
  }

  changePage(pageNumber: number) {
    this.sortTable();
    this.displayedItems = createPageFromArray(this.filteredItems, PAGE_SIZE, pageNumber);
  }

  filter(): Array<HistoryQueryItemDTO> {
    if (!this.historyQuery) return [];
    const searchText = this.searchControl.value || '';
    const statusFilter = this.statusFilterControl.value;

    return this.historyQuery.items.filter(item => {
      if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (statusFilter === 'enabled' && !item.enabled) return false;
      if (statusFilter === 'disabled' && item.enabled) return false;
      return true;
    });
  }

  toggleColumnSort(columnName: keyof TableData) {
    this.currentColumnSort = columnName;
    this.columnSortStates[this.currentColumnSort] = (this.columnSortStates[this.currentColumnSort] + 1) % 3;

    Object.keys(this.columnSortStates).forEach(key => {
      if (this.currentColumnSort !== key) {
        this.columnSortStates[key as keyof typeof this.columnSortStates] = 0;
      }
    });

    this.changePage(0);
  }

  private sortTable() {
    if (this.currentColumnSort && this.columnSortStates[this.currentColumnSort] !== ColumnSortState.INDETERMINATE) {
      const ascending = this.columnSortStates[this.currentColumnSort] === ColumnSortState.ASCENDING;

      switch (this.currentColumnSort) {
        case 'name':
          this.filteredItems.sort((a, b) => (ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
          break;
        case 'enabled':
          this.filteredItems.sort((a, b) => {
            const aVal = a.enabled ? 1 : 0;
            const bVal = b.enabled ? 1 : 0;
            return ascending ? aVal - bVal : bVal - aVal;
          });
          break;
        case 'createdAt':
          this.filteredItems.sort((a, b) =>
            ascending ? (a.createdAt || '').localeCompare(b.createdAt || '') : (b.createdAt || '').localeCompare(a.createdAt || '')
          );
          break;
        case 'updatedAt':
          this.filteredItems.sort((a, b) =>
            ascending ? (a.updatedAt || '').localeCompare(b.updatedAt || '') : (b.updatedAt || '').localeCompare(a.updatedAt || '')
          );
          break;
      }
    }
  }

  // Mass action methods

  toggleItemSelection(item: HistoryQueryItemDTO) {
    if (this.selectedItems.has(item.name)) {
      this.selectedItems.delete(item.name);
    } else {
      this.selectedItems.set(item.name, item);
    }
    this.updateSelectionState();
  }

  selectAll() {
    this.filteredItems.forEach(item => {
      this.selectedItems.set(item.name, item);
    });
    this.updateSelectionState();
  }

  unselectAll() {
    this.selectedItems.clear();
    this.updateSelectionState();
  }

  updateSelectionState() {
    const totalItems = this.filteredItems.length;
    const selectedCount = this.selectedItems.size;

    this.isAllSelected = selectedCount === totalItems && totalItems > 0;
    this.isIndeterminate = selectedCount > 0 && selectedCount < totalItems;
  }

  getSelectedItemsCount(): number {
    return this.selectedItems.size;
  }

  enableSelectedItems() {
    const itemIds = Array.from(this.selectedItems.values(), item => item.id);
    if (itemIds.length === 0) return;
    this.historyQueryService.enableItems(this.historyQuery!.id, itemIds).subscribe(() => {
      this.notificationService.success('history-query.items.enabled-multiple', { count: itemIds.length.toString() });
      this.selectedItems.clear();
      this.updateSelectionState();
      this.refreshHistoryQuery();
    });
  }

  disableSelectedItems() {
    const itemIds = Array.from(this.selectedItems.values(), item => item.id);
    if (itemIds.length === 0) return;
    this.historyQueryService.disableItems(this.historyQuery!.id, itemIds).subscribe(() => {
      this.notificationService.success('history-query.items.disabled-multiple', { count: itemIds.length.toString() });
      this.selectedItems.clear();
      this.updateSelectionState();
      this.refreshHistoryQuery();
    });
  }

  deleteSelectedItems() {
    const itemIds = Array.from(this.selectedItems.values(), item => item.id);
    if (itemIds.length === 0) return;
    this.confirmationService
      .confirm({
        messageKey: 'history-query.items.delete-multiple-message',
        interpolateParams: { count: this.selectedItems.size.toString() }
      })
      .pipe(
        switchMap(() => {
          return this.historyQueryService.deleteItems(this.historyQuery!.id, itemIds);
        })
      )
      .subscribe(() => {
        this.notificationService.success('history-query.items.deleted-multiple', { count: itemIds.length.toString() });
        this.selectedItems.clear();
        this.updateSelectionState();
        this.refreshHistoryQuery();
      });
  }
}
