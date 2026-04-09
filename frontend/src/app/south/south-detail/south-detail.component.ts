import { ChangeDetectorRef, Component, inject, OnDestroy } from '@angular/core';

import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorManifest,
  SouthItemGroupCommandDTO,
  SouthItemGroupDTO
} from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, firstValueFrom, merge, Observable, of, switchMap, tap } from 'rxjs';
import { PageLoader } from '../../shared/page-loader.service';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthMetricsComponent } from './south-metrics/south-metrics.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EnabledEnumPipe } from '../../shared/enabled-enum.pipe';
import { NotificationService } from '../../shared/notification.service';
import { OIBusInfo, SouthConnectorMetrics } from '../../../../../backend/shared/model/engine.model';
import { WindowService } from '../../shared/window.service';
import { ModalService } from '../../shared/modal.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { EngineService } from '../../services/engine.service';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { LogsComponent } from '../../logs/logs.component';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { isDisplayableAttribute } from '../../shared/form/dynamic-form.builder';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { CertificateService } from '../../services/certificate.service';
import { NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import EditSouthItemModalComponent from '../south-items/edit-south-item-modal/edit-south-item-modal.component';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { ImportItemModalComponent } from '../../shared/import-item-modal/import-item-modal.component';
import { OIBusObjectAttribute } from '../../../../../backend/shared/model/form.model';
import { ImportSouthItemsModalComponent } from '../south-items/import-south-items-modal/import-south-items-modal.component';
import { emptyPage } from '../../shared/test-utils';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { ConfirmationService } from '../../shared/confirmation.service';
import { SelectGroupModalComponent } from '../south-items/select-group-modal/select-group-modal.component';
import { ViewItemValueModalComponent } from '../south-items/view-item-value-modal/view-item-value-modal.component';

const PAGE_SIZE = 20;

const enum ColumnSortState {
  INDETERMINATE = 0,
  ASCENDING = 1,
  DESCENDING = 2
}

export interface TableData {
  name: string;
  scanMode: ScanModeDTO;
  group: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'oib-south-detail',
  imports: [
    TranslateDirective,
    RouterLink,
    SouthMetricsComponent,
    BoxComponent,
    BoxTitleDirective,
    EnabledEnumPipe,
    ClipboardModule,
    LogsComponent,
    OIBusSouthTypeEnumPipe,
    TranslatePipe,
    NgbTooltip,
    FormsModule,
    NgbDropdown,
    NgbDropdownMenu,
    NgbDropdownToggle,
    OibHelpComponent,
    PaginationComponent,
    ReactiveFormsModule,
    NgbDropdownItem,
    DatetimePipe
  ],
  templateUrl: './south-detail.component.html',
  styleUrl: './south-detail.component.scss',
  providers: [PageLoader]
})
export class SouthDetailComponent implements OnDestroy {
  private windowService = inject(WindowService);
  private southConnectorService = inject(SouthConnectorService);
  private scanModeService = inject(ScanModeService);
  private certificateService = inject(CertificateService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private engineService = inject(EngineService);
  private translateService = inject(TranslateService);

  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private cd = inject(ChangeDetectorRef);

  southConnector: SouthConnectorDTO | null = null;
  manifest: SouthConnectorManifest | null = null;

  filteredItems: Array<SouthConnectorItemDTO> = [];
  displayedItems: Page<SouthConnectorItemDTO> = emptyPage();
  searchControl = inject(NonNullableFormBuilder).control(null as string | null);
  groupFilterControl = inject(NonNullableFormBuilder).control(null as string | null);
  scanModeFilterControl = inject(NonNullableFormBuilder).control(null as string | null);
  statusFilterControl = inject(NonNullableFormBuilder).control(null as string | null);

  displayedSettings: Array<{ key: string; value: string }> = [];
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];

  connectorMetrics: SouthConnectorMetrics | null = null;
  connectorStream: EventSource | null = null;
  oibusInfo: OIBusInfo | null = null;

  // Mass action properties
  selectedItems = new Map<string, SouthConnectorItemDTO>();
  isAllSelected = false;
  isIndeterminate = false;

  columnSortStates: { [key in keyof TableData]: ColumnSortState } = {
    name: ColumnSortState.INDETERMINATE,
    scanMode: ColumnSortState.INDETERMINATE,
    group: ColumnSortState.INDETERMINATE,
    enabled: ColumnSortState.INDETERMINATE,
    createdAt: ColumnSortState.INDETERMINATE,
    updatedAt: ColumnSortState.INDETERMINATE
  };
  currentColumnSort: keyof TableData | null = 'name';

  constructor() {
    // get the generator ID
    combineLatest([this.route.paramMap, this.scanModeService.list(), this.certificateService.list(), this.engineService.info$])
      .pipe(
        switchMap(([params, scanModes, certificates, engineInfo]) => {
          this.scanModes = scanModes;
          this.certificates = certificates;
          this.oibusInfo = engineInfo;
          const southId = params.get('southId');
          if (southId) {
            return this.southConnectorService.findById(southId);
          }
          return of(null);
        }),
        switchMap(southConnector => {
          if (!southConnector) {
            return of(null);
          }
          this.southConnector = southConnector;
          return this.southConnectorService.getSouthManifest(this.southConnector!.type);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          return;
        }
        this.manifest = manifest;

        const southSettings = this.southConnector!.settings as unknown as Record<string, string>;
        this.displayedSettings = manifest.settings.attributes
          .filter(setting => isDisplayableAttribute(setting))
          .filter(setting => {
            const condition = manifest.settings.enablingConditions.find(
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

        const token = this.windowService.getStorageItem('oibus-token');
        this.connectorStream = new EventSource(`/sse/south/${this.southConnector!.id}?token=${token}`, { withCredentials: true });
        this.connectorStream.addEventListener('message', (event: MessageEvent) => {
          if (event && event.data) {
            this.connectorMetrics = JSON.parse(event.data);
            this.cd.detectChanges();
          }
        });
      });

    // Subscribe to filter control changes
    merge(
      this.searchControl.valueChanges,
      this.groupFilterControl.valueChanges,
      this.scanModeFilterControl.valueChanges,
      this.statusFilterControl.valueChanges
    ).subscribe(() => {
      this.resetPage();
    });
  }

  addItem() {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditSouthItemModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCreation(
      this.southConnector!.items,
      this.scanModes,
      this.certificates,
      this.southConnector!.groups,
      this.manifest!,
      this.southConnector!.id,
      this.southConnectorCommand,
      this.addOrEditGroup.bind(this),
      this.deleteGroup.bind(this)
    );
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemCommandDTO) => {
          return this.southConnectorService.createItem(this.southConnector!.id, {
            id: command.id,
            name: command.name,
            enabled: command.enabled,
            settings: command.settings,
            scanModeId: command.scanModeId,
            scanModeName: command.scanModeName,
            groupId: command.groupId,
            groupName: command.groupName,
            syncWithGroup: command.syncWithGroup,
            maxReadInterval: command.maxReadInterval,
            readDelay: command.readDelay,
            overlap: command.overlap
          } as SouthConnectorItemCommandDTO);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector!.id);
        })
      )
      .subscribe(southConnector => {
        this.southConnector = southConnector;
        this.filteredItems = this.filter();
        this.changePage(this.displayedItems.number);
        this.notificationService.success(`south.items.created`);
      });
  }

  duplicateItem(item: SouthConnectorItemDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCopy(
      this.southConnector!.items,
      this.scanModes,
      this.certificates,
      this.southConnector!.groups,
      this.manifest!,
      item,
      this.southConnector!.id,
      this.southConnectorCommand,
      this.addOrEditGroup.bind(this),
      this.deleteGroup.bind(this)
    );
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemCommandDTO) => {
          return this.southConnectorService.createItem(this.southConnector!.id, {
            id: command.id || null,
            name: command.name,
            enabled: command.enabled,
            settings: command.settings,
            scanModeId: command.scanModeId,
            scanModeName: command.scanModeName,
            groupId: command.groupId,
            groupName: command.groupName,
            syncWithGroup: command.syncWithGroup,
            maxReadInterval: command.maxReadInterval,
            readDelay: command.readDelay,
            overlap: command.overlap
          } as SouthConnectorItemCommandDTO);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector!.id);
        })
      )
      .subscribe(southConnector => {
        this.southConnector = southConnector;
        this.filteredItems = this.filter();
        this.changePage(this.displayedItems.number);
        this.notificationService.success(`south.items.created`);
      });
  }

  editItem(item: SouthConnectorItemDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditSouthItemModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;

    const tableIndex = this.southConnector!.items.findIndex(i => i.id === item.id || i.name === item.name);
    component.prepareForEdition(
      this.southConnector!.items,
      this.scanModes,
      this.certificates,
      this.southConnector!.groups,
      this.manifest!,
      item,
      this.southConnector!.id,
      this.southConnectorCommand,
      tableIndex,
      this.addOrEditGroup.bind(this),
      this.deleteGroup.bind(this)
    );
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemCommandDTO) => {
          return this.southConnectorService.updateItem(this.southConnector!.id, command.id!, {
            id: command.id,
            enabled: command.enabled,
            name: command.name,
            settings: command.settings,
            scanModeId: command.scanModeId,
            scanModeName: command.scanModeName,
            groupId: command.groupId,
            groupName: command.groupName,
            syncWithGroup: command.syncWithGroup,
            maxReadInterval: command.maxReadInterval,
            readDelay: command.readDelay,
            overlap: command.overlap
          } as SouthConnectorItemCommandDTO);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector!.id);
        })
      )
      .subscribe(southConnector => {
        this.southConnector = southConnector;
        this.filteredItems = this.filter();
        this.changePage(this.displayedItems.number);
        this.notificationService.success(`south.items.updated`);
      });
  }

  deleteItem(item: SouthConnectorItemDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-deletion'
      })
      .pipe(
        switchMap(() => {
          return this.southConnectorService.deleteItem(this.southConnector!.id, item.id!);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector!.id);
        })
      )
      .subscribe(southConnector => {
        this.southConnector = southConnector;
        this.filteredItems = this.filter();
        this.changePage(this.displayedItems.number);
        this.notificationService.success('south.items.deleted');
      });
  }

  deleteAllItems() {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-delete-all'
      })
      .pipe(
        switchMap(() => {
          return this.southConnectorService.deleteAllItems(this.southConnector!.id);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector!.id);
        })
      )
      .subscribe(southConnector => {
        this.southConnector = southConnector;
        this.resetPage();
        this.notificationService.success('south.items.all-deleted');
      });
  }

  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent, { backdrop: 'static' });
    const filename = this.southConnector!.name;
    modalRef.componentInstance.prepare(filename);
    modalRef.result.subscribe(response => {
      if (response) {
        this.southConnectorService.exportItems(this.southConnector!.id, response.filename, response.delimiter).subscribe();
      }
    });
  }

  importItems() {
    const modal = this.modalService.open(ImportItemModalComponent, { backdrop: 'static' });
    const expectedHeaders = ['name', 'enabled', 'scanMode'];
    const optionalHeaders: Array<string> = ['group', 'maxReadInterval', 'readDelay', 'overlap', 'syncWithGroup'];
    const settingsAttribute = this.manifest!.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    settingsAttribute.attributes.forEach(setting => {
      if (settingsAttribute.enablingConditions.find(element => element.targetPathFromRoot === setting.key)) {
        optionalHeaders.push(`settings_${setting.key}`);
      } else {
        expectedHeaders.push(`settings_${setting.key}`);
      }
    });

    if (this.manifest!.id === 'mqtt') {
      modal.componentInstance.prepare(
        expectedHeaders,
        optionalHeaders,
        this.southConnector!.items.map(item => (item.settings as any)?.topic).filter(
          topic => topic && typeof topic === 'string' && topic.trim()
        ),
        true
      );
    } else {
      modal.componentInstance.prepare(expectedHeaders, optionalHeaders, [], false);
    }

    modal.result.subscribe(response => {
      if (!response) return;
      this.checkImportItems(response.file, response.delimiter);
    });
  }

  checkImportItems(file: File, delimiter: string) {
    this.southConnectorService.checkImportItems(this.manifest!.id, this.southConnector!.items, file, delimiter).subscribe(result => {
      const modalRef = this.modalService.open(ImportSouthItemsModalComponent, { size: 'xl', backdrop: 'static' });
      const component: ImportSouthItemsModalComponent = modalRef.componentInstance;
      const commandItems: Array<SouthConnectorItemCommandDTO> = result.items.map(
        item =>
          ({
            id: item.id,
            name: item.name,
            enabled: item.enabled,
            settings: item.settings,
            scanModeId: item.scanMode.id,
            scanModeName: item.scanMode.name,
            groupId: item.group?.id || null,
            groupName: item.group?.standardSettings.name ?? null,
            syncWithGroup: item.syncWithGroup,
            maxReadInterval: item.maxReadInterval,
            readDelay: item.readDelay,
            overlap: item.overlap
          }) as SouthConnectorItemCommandDTO
      );
      component.prepare(this.manifest!, this.southConnector!.items, commandItems, result.errors, this.scanModes);
      modalRef.result
        .pipe(
          switchMap((newItems: Array<SouthConnectorItemCommandDTO>) => {
            return this.southConnectorService.importItems(this.southConnector!.id, newItems);
          }),
          switchMap(() => {
            return this.southConnectorService.findById(this.southConnector!.id);
          })
        )
        .subscribe(southConnector => {
          this.southConnector = southConnector;
          this.resetPage();
          this.notificationService.success(`south.items.import.imported`);
        });
    });
  }

  addOrEditGroup(command: {
    mode: 'create' | 'edit';
    group: SouthItemGroupCommandDTO;
  }): Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO> {
    if (command.mode === 'create') {
      return this.southConnectorService.createGroup(this.southConnector!.id, command.group).pipe(
        tap(() => {
          this.notificationService.success('south.groups.created');
        })
      );
    } else {
      return this.southConnectorService.updateGroup(this.southConnector!.id, command.group!.id!, command.group).pipe(
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector!.id);
        }),
        switchMap(southConnector => {
          this.southConnector = southConnector;
          return this.southConnectorService.getGroup(this.southConnector!.id, command.group!.id!);
        }),
        tap(() => {
          this.notificationService.success('south.groups.updated');
        })
      );
    }
  }

  deleteGroup(group: SouthItemGroupDTO | SouthItemGroupCommandDTO): Observable<void> {
    return this.confirmationService
      .confirm({
        messageKey: 'south.groups.confirm-deletion',
        interpolateParams: { name: group.standardSettings.name }
      })
      .pipe(
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector!.id);
        }),
        switchMap(southConnector => {
          this.southConnector = southConnector;
          return this.southConnectorService.deleteGroup(this.southConnector!.id, group.id!);
        }),
        tap({
          next: () => {
            this.notificationService.success('south.groups.deleted');
          },
          error: error => {
            this.notificationService.error('south.groups.delete-error', { error: error.message });
          }
        })
      );
  }

  getFieldValue(element: any, field: string): string {
    const settingsAttribute = this.manifest!.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;

    const foundFormControl = settingsAttribute.attributes.find(formControl => formControl.key === field);
    if (foundFormControl && element[field] && foundFormControl.type === 'string-select') {
      return this.translateService.instant(foundFormControl.translationKey + '.' + element[field]);
    }
    return element[field];
  }

  resetPage() {
    this.filteredItems = this.filter();
    this.changePage(0);
  }

  changePage(pageNumber: number) {
    this.sortTable();
    this.displayedItems = createPageFromArray(this.filteredItems, PAGE_SIZE, pageNumber);
  }

  filter(): Array<SouthConnectorItemDTO> {
    const searchText = this.searchControl.value || '';
    const groupFilter = this.groupFilterControl.value;
    const scanModeFilter = this.scanModeFilterControl.value;
    const statusFilter = this.statusFilterControl.value;

    return this.southConnector!.items.filter(item => {
      if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (groupFilter === 'none' && item.group) return false;
      if (groupFilter && groupFilter !== 'none' && item.group?.id !== groupFilter) return false;
      if (scanModeFilter && item.scanMode.id !== scanModeFilter) return false;
      if (statusFilter === 'enabled' && !item.enabled) return false;
      if (statusFilter === 'disabled' && item.enabled) return false;
      return true;
    });
  }

  toggleColumnSort(columnName: keyof TableData) {
    this.currentColumnSort = columnName;
    // Toggle state
    this.columnSortStates[this.currentColumnSort] = (this.columnSortStates[this.currentColumnSort] + 1) % 3;

    // Reset state for every other column
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
        case 'scanMode':
          this.filteredItems.sort((a, b) =>
            ascending
              ? (a as SouthConnectorItemDTO).scanMode.name.localeCompare((b as SouthConnectorItemDTO).scanMode.name)
              : (b as SouthConnectorItemDTO).scanMode.name.localeCompare((a as SouthConnectorItemDTO).scanMode.name)
          );
          break;
        case 'group':
          this.filteredItems.sort((a, b) => {
            const aGroup = a.group?.standardSettings.name || '';
            const bGroup = b.group?.standardSettings.name || '';
            return ascending ? aGroup.localeCompare(bGroup) : bGroup.localeCompare(aGroup);
          });
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
  toggleItemSelection(item: SouthConnectorItemDTO) {
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
    this.southConnectorService
      .enableItems(this.southConnector!.id, itemIds)
      .pipe(
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector!.id);
        })
      )
      .subscribe(southConnector => {
        this.selectedItems.clear();
        this.updateSelectionState();
        this.southConnector = southConnector;
        this.filteredItems = this.filter();
        this.changePage(this.displayedItems.number);
        this.notificationService.success('south.items.enabled-multiple', { count: itemIds.length.toString() });
      });
  }

  disableSelectedItems() {
    const itemIds = Array.from(this.selectedItems.values(), item => item.id);
    if (itemIds.length === 0) return;
    this.southConnectorService
      .disableItems(this.southConnector!.id, itemIds)
      .pipe(
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector!.id);
        })
      )
      .subscribe(southConnector => {
        this.selectedItems.clear();
        this.updateSelectionState();
        this.southConnector = southConnector;
        this.filteredItems = this.filter();
        this.changePage(this.displayedItems.number);
        this.notificationService.success('south.items.disabled-multiple', { count: itemIds.length.toString() });
      });
  }

  deleteSelectedItems() {
    const itemIds = Array.from(this.selectedItems.values(), item => item.id);
    if (itemIds.length === 0) return;
    this.confirmationService
      .confirm({
        messageKey: 'south.items.delete-multiple-message',
        interpolateParams: { count: this.selectedItems.size.toString() }
      })
      .pipe(
        switchMap(() => {
          return this.southConnectorService.deleteItems(this.southConnector!.id, itemIds);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector!.id);
        })
      )
      .subscribe(southConnector => {
        this.selectedItems.clear();
        this.updateSelectionState();
        this.southConnector = southConnector;
        this.filteredItems = this.filter();
        this.changePage(this.displayedItems.number);
        this.notificationService.success('south.items.deleted-multiple', { count: itemIds.length.toString() });
      });
  }

  moveSelectedItemsToGroup() {
    const itemIds = Array.from(this.selectedItems.values(), item => item.id!);
    if (itemIds.length === 0) return;

    const modalRef = this.modalService.open(SelectGroupModalComponent, { backdrop: 'static' });
    const component: SelectGroupModalComponent = modalRef.componentInstance;
    component.prepare(this.southConnector!.groups, this.scanModes, this.manifest!, command => this.addOrEditGroup(command));

    modalRef.result
      .pipe(
        switchMap((groupId: string) => {
          return this.southConnectorService.moveItemsToGroup(this.southConnector!.id, itemIds, groupId);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector!.id);
        })
      )
      .subscribe(southConnector => {
        this.selectedItems.clear();
        this.updateSelectionState();
        this.southConnector = southConnector;
        this.filteredItems = this.filter();
        this.changePage(this.displayedItems.number);
        this.notificationService.success('south.items.moved-to-group', { count: itemIds.length.toString() });
      });
  }

  getGroupName(item: SouthConnectorItemDTO): string {
    return item.group?.standardSettings.name || this.translateService.instant('south.items.group-none');
  }

  getScanMode(scanModeId: string | undefined) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }

  viewItemLastValue(item: SouthConnectorItemDTO) {
    this.southConnectorService.getItemLastValue(this.southConnector!.id, item.id!).subscribe({
      next: lastValue => {
        const modalRef = this.modalService.open(ViewItemValueModalComponent, { size: 'lg' });
        const component: ViewItemValueModalComponent = modalRef.componentInstance;
        component.prepareForDisplay(lastValue, this.getGroupName(item));
      },
      error: error => {
        this.notificationService.error('south.items.last-value-error', { error: error.message });
      }
    });
  }

  testConnection() {
    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runTest('south', this.southConnector!.id, this.southConnector!.settings, this.southConnector!.type);
  }

  toggleConnector(value: boolean) {
    if (value) {
      this.southConnectorService
        .start(this.southConnector!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('south.started', { name: this.southConnector!.name });
          }),
          switchMap(() => {
            return this.southConnectorService.findById(this.southConnector!.id);
          })
        )
        .subscribe(southConnector => {
          this.southConnector = southConnector;
        });
    } else {
      this.southConnectorService
        .stop(this.southConnector!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('south.stopped', { name: this.southConnector!.name });
          }),
          switchMap(() => {
            return this.southConnectorService.findById(this.southConnector!.id);
          })
        )
        .subscribe(southConnector => {
          this.southConnector = southConnector;
        });
    }
  }

  ngOnDestroy() {
    this.connectorStream?.close();
  }

  onClipboardCopy(result: boolean) {
    if (result) {
      this.notificationService.success('south.cache-path-copy.success');
    } else {
      this.notificationService.error('south.cache-path-copy.error');
    }
  }

  get southConnectorCommand() {
    return {
      ...this.southConnector!,
      items: this.southConnector!.items.map(item => ({
        id: item.id,
        enabled: item.enabled,
        name: item.name,
        settings: item.settings,
        scanModeId: item.scanMode.id,
        scanModeName: null,
        groupId: item.group?.id || null,
        groupName: null,
        syncWithGroup: item.syncWithGroup,
        maxReadInterval: item.maxReadInterval,
        readDelay: item.readDelay,
        overlap: item.overlap
      })),
      groups: this.southConnector!.groups.map(group => ({
        id: group.id,
        standardSettings: {
          name: group.standardSettings.name,
          scanModeId: group.standardSettings.scanMode.id
        },
        historySettings: {
          maxReadInterval: group.historySettings.maxReadInterval,
          readDelay: group.historySettings.readDelay,
          overlap: group.historySettings.overlap
        }
      }))
    } as SouthConnectorCommandDTO;
  }
}
