import { Component, computed, effect, inject, input, OnInit, output } from '@angular/core';
import { TranslateDirective, TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { Modal, ModalService } from '../../shared/modal.service';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemDTO,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { EditSouthItemModalComponent } from './edit-south-item-modal/edit-south-item-modal.component';
import { debounceTime, distinctUntilChanged, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { ImportSouthItemsModalComponent } from './import-south-items-modal/import-south-items-modal.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { ImportItemModalComponent } from '../../shared/import-item-modal/import-item-modal.component';
import { OIBusAttribute, OIBusObjectAttribute, OIBusScanModeAttribute } from '../../../../../backend/shared/model/form.model';
import { isDisplayableAttribute } from '../../shared/form/dynamic-form.builder';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

const PAGE_SIZE = 20;

const enum ColumnSortState {
  INDETERMINATE = 0,
  ASCENDING = 1,
  DESCENDING = 2
}

export interface TableData {
  name: string;
  scanMode: ScanModeDTO;
}

@Component({
  selector: 'oib-south-items',
  imports: [
    TranslateDirective,
    FormsModule,
    ReactiveFormsModule,
    BoxComponent,
    BoxTitleDirective,
    PaginationComponent,
    OibHelpComponent,
    TranslatePipe,
    TranslateModule,
    NgbTooltip
  ],
  templateUrl: './south-items.component.html',
  styleUrl: './south-items.component.scss'
})
export class SouthItemsComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private southConnectorService = inject(SouthConnectorService);
  private translateService = inject(TranslateService);

  /** Actual southId (or 'create') */
  readonly southId = input.required<string>();
  readonly southConnectorCommand = input.required<SouthConnectorCommandDTO>();
  /** Either the edited dto or the duplicated dto */
  readonly southConnector = input<SouthConnectorDTO | null>(null);
  readonly southManifest = input.required<SouthConnectorManifest>();
  readonly scanModes = input.required<Array<ScanModeDTO>>();
  readonly certificates = input.required<Array<CertificateDTO>>();
  /**
   * Save the changes in the backend or just emit inMemoryItems.
   * If this is true, then southId needs to be an actual id
   */
  readonly saveChangesDirectly = input.required<boolean>();

  readonly scanModeManifest = computed(() => {
    return this.southManifest().items.rootAttribute.attributes.find(attribute => attribute.key === 'scanMode')! as OIBusScanModeAttribute;
  });

  readonly inMemoryItems = output<Array<SouthConnectorItemDTO> | null>();

  allItems: Array<SouthConnectorItemDTO> = []; // Array used to store item commands on south connector creation
  filteredItems: Array<SouthConnectorItemDTO> = [];

  displayedItems: Page<SouthConnectorItemDTO> = emptyPage();
  displaySettings: Array<OIBusAttribute> = [];

  searchControl = inject(NonNullableFormBuilder).control(null as string | null);

  // Mass action properties
  selectedItems = new Set<string>();
  isAllSelected = false;
  isIndeterminate = false;

  columnSortStates: { [key in keyof TableData]: ColumnSortState } = {
    name: ColumnSortState.INDETERMINATE,
    scanMode: ColumnSortState.INDETERMINATE
  };
  currentColumnSort: keyof TableData | null = 'name';

  constructor() {
    // This effect runs every time the south connector input changes
    effect(() => {
      const southConnector = this.southConnector();
      if (!southConnector) return;

      // initialize/update item list
      this.allItems = southConnector.items.map(item => ({
        ...item,
        // Keep existing id when editing; when creating/duplicating, ids are handled by parent component
        id: item.id ?? null
      }));

      // reset column sorting
      this.columnSortStates = { name: ColumnSortState.INDETERMINATE, scanMode: ColumnSortState.INDETERMINATE };
      this.currentColumnSort = 'name';
      this.resetPage();
    });

    // This runs every time in memory items change
    this.inMemoryItems.subscribe(() => {
      // reset column sorting
      this.columnSortStates = { name: ColumnSortState.INDETERMINATE, scanMode: ColumnSortState.INDETERMINATE };
      this.currentColumnSort = 'name';
      this.resetPage();
    });
  }

  ngOnInit() {
    const settingsAttribute = this.southManifest().items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    this.displaySettings = settingsAttribute.attributes.filter(setting => isDisplayableAttribute(setting));

    // subscribe to changes to search control
    this.searchControl.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      this.resetPage();
    });
  }

  resetPage() {
    this.filteredItems = this.filter();
    this.changePage(0);
  }

  changePage(pageNumber: number) {
    this.sortTable();
    this.displayedItems = createPageFromArray(this.filteredItems, PAGE_SIZE, pageNumber);
  }

  refreshCurrentPage() {
    this.sortTable();
    this.displayedItems = createPageFromArray(this.filteredItems, PAGE_SIZE, this.displayedItems.number);
  }

  filter(): Array<SouthConnectorItemDTO> {
    const searchText = this.searchControl.value || '';
    return this.allItems.filter(item => item.name.toLowerCase().includes(searchText.toLowerCase()));
  }

  editItem(southItem: SouthConnectorItemDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditSouthItemModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;

    const tableIndex = this.allItems.findIndex(i => i.id === southItem.id || i.name === southItem.name);
    component.prepareForEdition(
      this.allItems,
      this.scanModes(),
      this.certificates(),
      southItem,
      this.southId(),
      this.southConnectorCommand(),
      this.southManifest(),
      tableIndex
    );
    this.refreshAfterEditionModalClosed(modalRef, southItem);
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
      this.allItems,
      this.scanModes(),
      this.certificates(),
      this.southId(),
      this.southConnectorCommand(),
      this.southManifest()
    );
    this.refreshAfterCreationModalClosed(modalRef);
  }

  /**
   * Refresh the South item list when a South item is created
   */
  private refreshAfterCreationModalClosed(modalRef: Modal<any>) {
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemDTO) => {
          if (this.saveChangesDirectly()) {
            return this.southConnectorService.createItem(this.southId(), {
              id: command.id || null,
              name: command.name,
              enabled: command.enabled,
              scanModeId: command.scanMode.id,
              scanModeName: null,
              settings: command.settings
            });
          } else {
            this.allItems.push({
              id: command.id,
              name: command.name,
              enabled: command.enabled,
              scanMode: command.scanMode,
              settings: command.settings
            });
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success(`south.items.created`);
          this.inMemoryItems.emit(null);
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  /**
   * Refresh the South item list when a South item is edited
   */
  private refreshAfterEditionModalClosed(modalRef: Modal<any>, oldItem: SouthConnectorItemDTO) {
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemDTO) => {
          if (this.saveChangesDirectly()) {
            return this.southConnectorService.updateItem(this.southId(), command.id!, {
              id: command.id,
              enabled: command.enabled,
              name: command.name,
              settings: command.settings,
              scanModeName: null,
              scanModeId: command.scanMode.id
            });
          } else {
            this.allItems = this.allItems.filter(item => item.name !== oldItem.name);
            // Preserve id when present, merge changes otherwise
            this.allItems.push({ ...oldItem, ...command, id: (oldItem as any).id ?? command.id ?? null });
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success(`south.items.updated`);
          this.inMemoryItems.emit(null);
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  deleteItem(item: SouthConnectorItemDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-deletion'
      })
      .pipe(
        switchMap(() => {
          if (this.saveChangesDirectly()) {
            return this.southConnectorService.deleteItem(this.southId(), item.id!);
          } else {
            this.allItems = this.allItems.filter(element => element.name !== item.name);
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('south.items.deleted');
          this.inMemoryItems.emit(null);
          // Refresh current page instead of resetting to page 0
          this.refreshCurrentPage();
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  duplicateItem(item: SouthConnectorItemDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCopy(
      this.allItems,
      this.scanModes(),
      this.certificates(),
      item,
      this.southId(),
      this.southConnectorCommand(),
      this.southManifest()
    );
    this.refreshAfterCreationModalClosed(modalRef);
  }

  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent, { backdrop: 'static' });
    modalRef.componentInstance.prepare(this.southConnector()?.name);
    modalRef.result.subscribe(response => {
      if (response && this.southId() !== 'create') {
        this.southConnectorService.exportItems(this.southId(), response.fileName, response.delimiter).subscribe();
      } else if (response && this.southId() === 'create') {
        this.southConnectorService
          .itemsToCsv(
            this.southManifest().id,
            this.allItems.map(item => ({
              id: item.id,
              enabled: item.enabled,
              name: item.name,
              settings: item.settings,
              scanModeId: item.scanMode.id,
              scanModeName: item.scanMode.name
            })),
            response.fileName,
            response.delimiter
          )
          .subscribe();
      }
    });
  }

  deleteAllItems() {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-delete-all'
      })
      .pipe(
        switchMap(() => {
          if (this.saveChangesDirectly()) {
            return this.southConnectorService.deleteAllItems(this.southId());
          } else {
            this.allItems = [];
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('south.items.all-deleted');
          this.inMemoryItems.emit(null);
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  importItems() {
    const modalRef = this.modalService.open(ImportItemModalComponent, { backdrop: 'static' });

    const expectedHeaders = ['name', 'enabled'];
    const optionalHeaders: Array<string> = [];

    if (this.scanModes().length > 0) {
      expectedHeaders.push('scanMode');
    }

    const settingsAttribute = this.southManifest().items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    settingsAttribute.attributes.forEach(setting => {
      if (settingsAttribute.enablingConditions.find(element => element.targetPathFromRoot === setting.key)) {
        optionalHeaders.push(`settings_${setting.key}`);
      } else {
        expectedHeaders.push(`settings_${setting.key}`);
      }
    });

    modalRef.componentInstance.expectedHeaders = expectedHeaders;
    modalRef.componentInstance.optionalHeaders = optionalHeaders;

    if (this.southManifest().id === 'mqtt') {
      modalRef.componentInstance.isMqttConnector = true;
      modalRef.componentInstance.existingMqttTopics = this.allItems
        .map(item => (item.settings as any)?.topic)
        .filter(topic => topic && typeof topic === 'string' && topic.trim());
    }

    modalRef.result.subscribe(response => {
      if (!response) return;
      this.checkImportItems(response.file, response.delimiter);
    });
  }

  checkImportItems(file: File, delimiter: string) {
    this.southConnectorService.checkImportItems(this.southManifest().id, this.allItems, file, delimiter).subscribe(
      (result: {
        items: Array<SouthConnectorItemDTO>;
        errors: Array<{
          item: Record<string, string>;
          error: string;
        }>;
      }) => {
        const modalRef = this.modalService.open(ImportSouthItemsModalComponent, { size: 'xl', backdrop: 'static' });
        const component: ImportSouthItemsModalComponent = modalRef.componentInstance;
        component.prepare(this.southManifest(), this.allItems, result.items, result.errors, this.scanModes());
        this.refreshAfterImportModalClosed(modalRef);
      }
    );
  }

  /**
   * Refresh the South item list when South items are imported
   */
  private refreshAfterImportModalClosed(modalRef: Modal<any>) {
    modalRef.result
      .pipe(
        switchMap((newItems: Array<SouthConnectorItemDTO>) => {
          if (this.saveChangesDirectly()) {
            return this.southConnectorService.importItems(
              this.southId(),
              newItems.map(item => ({
                id: item.id,
                enabled: item.enabled,
                name: item.name,
                settings: item.settings,
                scanModeId: item.scanMode.id,
                scanModeName: null
              }))
            );
          } else {
            this.allItems.push(...newItems);
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success(`south.items.import.imported`);
          this.inMemoryItems.emit(null);
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  toggleItem(item: SouthConnectorItemDTO, value: boolean) {
    if (value) {
      this.southConnectorService
        .enableItem(this.southId(), item.id!)
        .pipe(
          tap(() => {
            this.notificationService.success('south.items.enabled', { name: item.name });
          })
        )
        .subscribe(() => {
          if (this.southConnector()) {
            this.inMemoryItems.emit(null);
          }
          // Refresh current page instead of resetting to page 0
          this.refreshCurrentPage();
        });
    } else {
      this.southConnectorService
        .disableItem(this.southId(), item.id!)
        .pipe(
          tap(() => {
            this.notificationService.success('south.items.disabled', { name: item.name });
          })
        )
        .subscribe(() => {
          if (this.southConnector()) {
            this.inMemoryItems.emit(null);
          }
          // Refresh current page instead of resetting to page 0
          this.refreshCurrentPage();
        });
    }
  }

  getFieldValue(element: any, field: string): string {
    const settingsAttribute = this.southManifest().items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;

    const foundFormControl = settingsAttribute.attributes.find(formControl => formControl.key === field);
    if (foundFormControl && element[field] && foundFormControl.type === 'string-select') {
      return this.translateService.instant(foundFormControl.translationKey + '.' + element[field]);
    }
    return element[field];
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
      }
    }
  }

  // Mass action methods
  toggleItemSelection(itemId: string) {
    if (this.selectedItems.has(itemId)) {
      this.selectedItems.delete(itemId);
    } else {
      this.selectedItems.add(itemId);
    }
    this.updateSelectionState();
  }

  toggleSelectAll() {
    if (this.isAllSelected) {
      this.selectedItems.clear();
    } else {
      this.displayedItems.content.forEach(item => {
        if (item.id) {
          this.selectedItems.add(item.id);
        }
      });
    }
    this.updateSelectionState();
  }

  updateSelectionState() {
    const totalItems = this.displayedItems.content.length;
    const selectedCount = this.selectedItems.size;

    this.isAllSelected = selectedCount === totalItems && totalItems > 0;
    this.isIndeterminate = selectedCount > 0 && selectedCount < totalItems;
  }

  enableSelectedItems() {
    const itemIds = Array.from(this.selectedItems);
    if (itemIds.length === 0) return;

    this.southConnectorService.enableItems(this.southId(), itemIds).subscribe({
      next: () => {
        this.notificationService.success('south.items.enabled-multiple', { count: itemIds.length.toString() });
        this.selectedItems.clear();
        this.updateSelectionState();
        if (this.southConnector()) {
          this.inMemoryItems.emit(null);
        }
      },
      error: error => {
        this.notificationService.error('south.items.enable-error', { error: error.message });
      }
    });
  }

  disableSelectedItems() {
    const itemIds = Array.from(this.selectedItems);
    if (itemIds.length === 0) return;

    this.southConnectorService.disableItems(this.southId(), itemIds).subscribe({
      next: () => {
        this.notificationService.success('south.items.disabled-multiple', { count: itemIds.length.toString() });
        this.selectedItems.clear();
        this.updateSelectionState();
        if (this.southConnector()) {
          this.inMemoryItems.emit(null);
        }
      },
      error: error => {
        this.notificationService.error('south.items.disable-error', { error: error.message });
      }
    });
  }

  deleteSelectedItems() {
    const itemIds = Array.from(this.selectedItems);
    if (itemIds.length === 0) return;

    this.confirmationService
      .confirm({
        messageKey: 'south.items.delete-multiple-message',
        interpolateParams: { count: itemIds.length.toString() }
      })
      .subscribe(() => {
        this.southConnectorService.deleteItems(this.southId(), itemIds).subscribe({
          next: () => {
            this.notificationService.success('south.items.deleted-multiple', { count: itemIds.length.toString() });
            this.selectedItems.clear();
            this.updateSelectionState();
            if (this.southConnector()) {
              this.inMemoryItems.emit(null);
            }
          },
          error: error => {
            this.notificationService.error('south.items.delete-error', { error: error.message });
          }
        });
      });
  }
}
