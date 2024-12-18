import { Component, inject, OnInit, output, input, effect } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';

import { Modal, ModalService } from '../../shared/modal.service';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { SouthConnectorCommandDTO, SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { OibFormControl } from '../../../../../backend/shared/model/form.model';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { HistoryQueryDTO, HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '../../../../../backend/shared/model/history-query.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { ImportItemModalComponent } from '../../shared/import-item-modal/import-item-modal.component';
import { EditHistoryQueryItemModalComponent } from '../edit-history-query-item-modal/edit-history-query-item-modal.component';
import { ImportHistoryQueryItemsModalComponent } from '../import-history-query-items-modal/import-history-query-items-modal.component';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';

const PAGE_SIZE = 20;

const enum ColumnSortState {
  INDETERMINATE = 0,
  ASCENDING = 1,
  DESCENDING = 2
}

export interface TableData {
  name: string;
}

@Component({
  selector: 'oib-history-query-items',
  imports: [
    TranslateDirective,
    PaginationComponent,
    FormsModule,
    ReactiveFormsModule,
    BoxComponent,
    BoxTitleDirective,
    OibHelpComponent,
    TranslatePipe
  ],
  templateUrl: './history-query-items.component.html',
  styleUrl: './history-query-items.component.scss'
})
export class HistoryQueryItemsComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private historyQueryService = inject(HistoryQueryService);

  /** Actual historyId (or 'create') */
  readonly historyId = input.required<string>();
  readonly southConnectorCommand = input.required<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>>();
  readonly historyQuery = input<HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null>(null);
  readonly southManifest = input.required<SouthConnectorManifest>();
  /**
   * Wether to save the changes in the backend or just emit inMemoryItems.
   * If this is true, then historyId needs to be an actual id
   */
  readonly saveChangesDirectly = input.required<boolean>();
  readonly inMemoryItems = output<Array<HistoryQueryItemCommandDTO<SouthItemSettings>> | null>();

  allItems: Array<HistoryQueryItemCommandDTO<SouthItemSettings>> = [];
  filteredItems: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>> = [];

  displayedItems: Page<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>> = emptyPage();
  displaySettings: Array<OibFormControl> = [];

  searchControl = inject(NonNullableFormBuilder).control(null as string | null);

  columnSortStates: { [key in keyof TableData]: ColumnSortState } = {
    name: ColumnSortState.INDETERMINATE
  };
  currentColumnSort: keyof TableData | null = 'name';

  constructor() {
    // This effect runs every time the history query input changes
    effect(() => {
      const historyQuery = this.historyQuery();
      if (!historyQuery) return;

      // initialize/update item list
      this.allItems = historyQuery.items;

      // reset column sorting
      this.columnSortStates = { name: ColumnSortState.INDETERMINATE };
      this.currentColumnSort = 'name';
      this.resetPage();
    });

    // This runs every time in memory items change
    this.inMemoryItems.subscribe(() => {
      // reset column sorting
      this.columnSortStates = { name: ColumnSortState.INDETERMINATE };
      this.currentColumnSort = 'name';
      this.resetPage();
    });
  }

  ngOnInit() {
    this.resetPage();
    this.displaySettings = this.southManifest().items.settings.filter(setting => setting.displayInViewMode);

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

  filter(): Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>> {
    const searchText = this.searchControl.value || '';
    return this.allItems.filter(item => item.name.toLowerCase().includes(searchText.toLowerCase()));
  }

  editItem(historyQueryItem: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>) {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, { size: 'xl' });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;

    const tableIndex = this.allItems.findIndex(i => i.id === historyQueryItem.id || i.name === historyQueryItem.name);
    component.prepareForEdition(
      this.southManifest().items,
      this.allItems,
      historyQueryItem,
      this.historyId(),
      this.southConnectorCommand(),
      this.southManifest(),
      tableIndex
    );
    this.refreshAfterEditionModalClosed(modalRef, historyQueryItem);
  }

  addItem() {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, { size: 'xl' });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    component.prepareForCreation(
      this.southManifest().items,
      this.allItems,
      this.historyId(),
      this.southConnectorCommand(),
      this.southManifest()
    );
    this.refreshAfterCreationModalClosed(modalRef);
  }

  /**
   * Refresh the History Query item list when a History Query item is created
   */
  private refreshAfterCreationModalClosed(modalRef: Modal<any>) {
    modalRef.result
      .pipe(
        switchMap((command: HistoryQueryItemDTO<SouthItemSettings>) => {
          if (this.saveChangesDirectly()) {
            return this.historyQueryService.createItem(this.historyId(), command);
          } else {
            this.allItems.push({
              id: command.id ?? null,
              name: command.name,
              enabled: command.enabled,
              settings: { ...command.settings }
            });
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success(`history-query.items.created`);
          this.inMemoryItems.emit(null);
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  /**
   * Refresh the History Query item list when a History Query item is edited
   */
  private refreshAfterEditionModalClosed(
    modalRef: Modal<any>,
    oldItem: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>
  ) {
    modalRef.result
      .pipe(
        switchMap((command: HistoryQueryItemCommandDTO<SouthItemSettings>) => {
          if (this.saveChangesDirectly()) {
            return this.historyQueryService.updateItem(this.historyId(), command.id!, command);
          } else {
            this.allItems = this.allItems.filter(item => item.name !== oldItem.name);
            this.allItems.push({ ...oldItem, ...command });
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success(`history-query.items.updated`);
          this.inMemoryItems.emit(null);
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  deleteItem(item: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>) {
    this.confirmationService
      .confirm({
        messageKey: 'history-query.items.confirm-deletion'
      })
      .pipe(
        switchMap(() => {
          if (this.saveChangesDirectly()) {
            return this.historyQueryService.deleteItem(this.historyId(), item.id!);
          } else {
            this.allItems = this.allItems.filter(element => element.name !== item.name);
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('history-query.items.deleted');
          this.inMemoryItems.emit(null);
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  duplicateItem(item: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>) {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, { size: 'xl' });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    component.prepareForCopy(
      this.southManifest().items,
      this.allItems,
      item,
      this.historyId(),
      this.southConnectorCommand(),
      this.southManifest()
    );
    this.refreshAfterCreationModalClosed(modalRef);
  }

  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent);
    modalRef.componentInstance.prepare(this.historyQuery()?.name);
    modalRef.result.subscribe(response => {
      if (response.delimiter && this.historyId() !== 'create') {
        this.historyQueryService.exportItems(this.historyId(), response.fileName, response.delimiter).subscribe();
      } else if (response && this.historyId() === 'create') {
        this.historyQueryService.itemsToCsv(this.southManifest().id, this.allItems, response.fileName, response.delimiter).subscribe();
      }
    });
  }

  deleteAllItems() {
    this.confirmationService
      .confirm({
        messageKey: 'history-query.items.confirm-delete-all'
      })
      .pipe(
        switchMap(() => {
          if (this.saveChangesDirectly()) {
            return this.historyQueryService.deleteAllItems(this.historyId());
          } else {
            this.allItems = [];
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('history-query.items.all-deleted');
          this.inMemoryItems.emit(null);
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  importItems() {
    const modalRef = this.modalService.open(ImportItemModalComponent);
    modalRef.result.subscribe(response => {
      this.checkImportItems(response.file, response.delimiter);
    });
  }

  checkImportItems(file: File, delimiter: string) {
    this.historyQueryService.checkImportItems(this.southManifest().id, this.historyId(), this.allItems, file, delimiter).subscribe(
      (result: {
        items: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>;
        errors: Array<{
          item: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>;
          error: string;
        }>;
      }) => {
        const modalRef = this.modalService.open(ImportHistoryQueryItemsModalComponent, { size: 'xl' });
        const component: ImportHistoryQueryItemsModalComponent = modalRef.componentInstance;
        component.prepare(this.southManifest().items, this.allItems, result.items, result.errors);
        this.refreshAfterImportModalClosed(modalRef);
      }
    );
  }

  /**
   * Refresh the History Query item list when a History Query items are created
   */
  private refreshAfterImportModalClosed(modalRef: Modal<any>) {
    modalRef.result
      .pipe(
        switchMap((newItems: Array<HistoryQueryItemCommandDTO<SouthItemSettings>>) => {
          if (this.saveChangesDirectly()) {
            return this.historyQueryService.importItems(this.historyId(), newItems);
          } else {
            this.allItems.push(...newItems);
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success(`history-query.items.imported`);
          this.inMemoryItems.emit(null);
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  toggleItem(item: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>, value: boolean) {
    if (value) {
      this.historyQueryService
        .enableItem(this.historyId(), item.id!)
        .pipe(
          tap(() => {
            this.notificationService.success('history-query.items.enabled', { name: item.name });
          })
        )
        .subscribe(() => {
          if (this.saveChangesDirectly()) {
            this.inMemoryItems.emit(null);
          }
        });
    } else {
      this.historyQueryService
        .disableItem(this.historyId(), item.id!)
        .pipe(
          tap(() => {
            this.notificationService.success('history-query.items.disabled', { name: item.name });
          })
        )
        .subscribe(() => {
          if (this.saveChangesDirectly()) {
            this.inMemoryItems.emit(null);
          }
        });
    }
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
      }
    }
  }

  getFieldValue(element: any, field: string): string {
    return element[field];
  }
}
