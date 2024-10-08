import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';

import { RouterLink } from '@angular/router';
import { Modal, ModalService } from '../../shared/modal.service';
import { FormControlValidationDirective } from '../../shared/form-control-validation.directive';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorManifest
} from '../../../../../shared/model/south-connector.model';
import { debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { createPageFromArray, Page } from '../../../../../shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { EditSouthItemModalComponent } from '../../south/edit-south-item-modal/edit-south-item-modal.component';
import { ImportSouthItemsModalComponent } from '../../south/import-south-items-modal/import-south-items-modal.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { ImportItemModalComponent } from '../../shared/import-item-modal/import-item-modal.component';

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
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    PaginationComponent,
    FormControlValidationDirective,
    FormsModule,
    LoadingSpinnerComponent,
    ReactiveFormsModule,
    BoxComponent,
    BoxTitleDirective,
    DatetimePipe,
    DurationPipe,
    OibHelpComponent
  ],
  templateUrl: './history-query-items.component.html',
  styleUrl: './history-query-items.component.scss'
})
export class HistoryQueryItemsComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private historyQueryService = inject(HistoryQueryService);

  @Input() historyQuery: HistoryQueryDTO | null = null;
  @Input({ required: true }) southManifest!: SouthConnectorManifest;
  @Input() initItems: Array<SouthConnectorItemDTO> = [];
  @Output() readonly inMemoryItems = new EventEmitter<{
    items: Array<SouthConnectorItemDTO>;
    itemIdsToDelete: Array<string>;
  }>();
  @Input() inMemory = false;

  allItems: Array<SouthConnectorItemDTO> = [];
  itemIdsToDelete: Array<string> = [];
  filteredItems: Array<SouthConnectorItemDTO> = [];
  displayedItems: Page<SouthConnectorItemDTO> = emptyPage();
  displaySettings: Array<OibFormControl> = [];

  searchControl = inject(NonNullableFormBuilder).control(null as string | null);

  columnSortStates: { [key in keyof TableData]: ColumnSortState } = {
    name: ColumnSortState.INDETERMINATE
  };
  currentColumnSort: keyof TableData | null = 'name';

  ngOnInit() {
    this.southManifest.items.scanMode.subscriptionOnly = true;
    if (!this.historyQuery) {
      this.allItems = this.initItems;
    }
    this.fetchItemsAndResetPage(false);
    this.displaySettings = this.southManifest.items.settings.filter(setting => setting.displayInViewMode);

    // subscribe to changes to search control
    this.searchControl.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      this.filteredItems = this.filter(this.allItems);
      this.changePage(0);
    });
  }

  fetchItemsAndResetPage(fromMemory: boolean) {
    // reset column sorting
    this.columnSortStates = { name: ColumnSortState.INDETERMINATE };
    this.currentColumnSort = 'name';

    if (this.historyQuery && !fromMemory) {
      this.historyQueryService.listItems(this.historyQuery.id).subscribe(items => {
        this.allItems = items;
        this.filteredItems = this.filter(items);
        this.changePage(0);
        this.inMemoryItems.emit({ items: this.allItems, itemIdsToDelete: this.itemIdsToDelete });
      });
    } else {
      this.filteredItems = this.filter(this.allItems);
      this.changePage(0);
      this.inMemoryItems.emit({ items: this.allItems, itemIdsToDelete: this.itemIdsToDelete });
    }
  }

  changePage(pageNumber: number) {
    this.sortTable();
    this.displayedItems = this.createPage(pageNumber);
  }

  private createPage(pageNumber: number): Page<SouthConnectorItemDTO> {
    return createPageFromArray(this.filteredItems, PAGE_SIZE, pageNumber);
  }

  filter(items: Array<SouthConnectorItemDTO>): Array<SouthConnectorItemDTO> {
    const searchText = this.searchControl.value;
    if (!searchText) {
      return items;
    }
    return items.filter(item => item.name.toLowerCase().includes(searchText.toLowerCase()));
  }

  /**
   * Open a modal to edit a South item
   */
  editItem(southItem: SouthConnectorItemDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForEdition(this.southManifest.items, this.allItems, [], southItem);
    this.refreshAfterEditionModalClosed(modalRef, southItem);
  }

  /**
   * Open a modal to create a South item
   */
  addItem() {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.southManifest.items, this.allItems, []);
    this.refreshAfterCreationModalClosed(modalRef);
  }

  /**
   * Refresh the South item list when a South item is created
   */
  private refreshAfterCreationModalClosed(modalRef: Modal<any>) {
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemCommandDTO) => {
          if (!this.inMemory) {
            return this.historyQueryService.createItem(this.historyQuery!.id, command);
          } else {
            this.allItems.push({
              id: command.id ?? '',
              name: command.name,
              enabled: command.enabled,
              connectorId: this.historyQuery?.id ?? '',
              scanModeId: command.scanModeId!,
              settings: { ...command.settings }
            });
            return of(null);
          }
        })
      )
      .subscribe(() => {
        this.fetchItemsAndResetPage(this.inMemory);
        if (!this.inMemory) {
          this.notificationService.success(`history-query.items.created`);
        }
      });
  }

  /**
   * Refresh the South item list when a South item is created
   */
  private refreshAfterEditionModalClosed(modalRef: Modal<any>, oldItem: SouthConnectorItemDTO) {
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemCommandDTO) => {
          if (!this.inMemory) {
            return this.historyQueryService.updateItem(this.historyQuery!.id, command.id || '', command);
          } else {
            this.allItems = this.allItems.filter(item => {
              if (oldItem.id) {
                return item.id !== oldItem.id;
              } else {
                return item.name !== oldItem.name;
              }
            });
            this.allItems.push({ ...oldItem, ...command });
            return of(null);
          }
        })
      )
      .subscribe(() => {
        this.fetchItemsAndResetPage(this.inMemory);
        if (!this.inMemory) {
          this.notificationService.success(`history-query.items.updated`);
        }
      });
  }

  /**
   * Deletes a parser by its ID and refreshes the list
   */
  deleteItem(item: SouthConnectorItemDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'history-query.items.confirm-deletion'
      })
      .pipe(
        switchMap(() => {
          if (!this.inMemory) {
            return this.historyQueryService.deleteItem(this.historyQuery!.id, item.id);
          } else {
            if (item.id) {
              this.itemIdsToDelete.push(item.id);
              this.allItems = this.allItems.filter(element => element.id !== item.id);
            } else {
              this.allItems = this.allItems.filter(element => element.name !== item.name);
            }
            return of(null);
          }
        })
      )
      .subscribe(() => {
        this.fetchItemsAndResetPage(this.inMemory);
        if (!this.inMemory) {
          this.notificationService.success('history-query.items.deleted');
        }
      });
  }

  duplicateItem(item: SouthConnectorItemDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCopy(this.southManifest.items, [], item);
    this.refreshAfterCreationModalClosed(modalRef);
  }

  /**
   * Export items into a csv file
   */
  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent);
    modalRef.componentInstance.prepare(this.historyQuery?.name);
    modalRef.result.subscribe(response => {
      if (response.delimiter && this.historyQuery) {
        this.historyQueryService.exportItems(this.historyQuery.id, response.fileName, response.delimiter).subscribe();
      }
    });
  }

  /**
   * Delete all items
   */
  deleteAllItems() {
    this.confirmationService
      .confirm({
        messageKey: 'history-query.items.confirm-delete-all'
      })
      .pipe(
        switchMap(() => {
          if (!this.inMemory) {
            return this.historyQueryService.deleteAllItems(this.historyQuery!.id);
          } else {
            this.itemIdsToDelete = [...this.itemIdsToDelete, ...this.allItems.filter(item => item.id).map(item => item.id)];
            this.allItems = [];
            return of(null);
          }
        })
      )
      .subscribe(() => {
        this.fetchItemsAndResetPage(this.inMemory);
        if (!this.inMemory) {
          this.notificationService.success('history-query.items.all-deleted');
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
    this.historyQueryService
      .checkImportItems(this.southManifest.id, this.historyQuery?.id || 'create', file, delimiter)
      .subscribe((result: { items: Array<SouthConnectorItemDTO>; errors: Array<{ item: SouthConnectorItemDTO; message: string }> }) => {
        const modalRef = this.modalService.open(ImportSouthItemsModalComponent, { size: 'xl' });
        const component: ImportSouthItemsModalComponent = modalRef.componentInstance;
        component.prepare(this.southManifest.items, this.allItems, result.items, result.errors, []);
        this.refreshAfterImportModalClosed(modalRef);
      });
  }

  /**
   * Refresh the History South item list when a South items are created
   */
  private refreshAfterImportModalClosed(modalRef: Modal<any>) {
    modalRef.result
      .pipe(
        switchMap((newItems: Array<SouthConnectorItemDTO>) => {
          if (!this.inMemory) {
            return this.historyQueryService.importItems(this.historyQuery!.id, newItems);
          } else {
            for (const item of newItems) {
              this.allItems = this.allItems.filter(existingItem => {
                if (item.id) {
                  return existingItem.id !== item.id;
                } else {
                  return existingItem.name !== item.name;
                }
              });
              this.allItems.push(item);
            }
            return of(null);
          }
        })
      )
      .subscribe(() => {
        this.fetchItemsAndResetPage(this.inMemory);
        if (!this.inMemory) {
          this.notificationService.success(`south.items.import.imported`);
        }
      });
  }

  toggleItem(item: SouthConnectorItemDTO, value: boolean) {
    if (value) {
      this.historyQueryService
        .enableItem(this.historyQuery!.id, item.id)
        .pipe(
          tap(() => {
            this.notificationService.success('history-query.items.enabled', { name: item.name });
          }),
          switchMap(() => {
            return this.historyQueryService.listItems(this.historyQuery!.id);
          })
        )
        .subscribe(items => {
          this.allItems = items;
          this.filteredItems = this.filter(items);
          this.changePage(this.displayedItems.number);
        });
    } else {
      this.historyQueryService
        .disableItem(this.historyQuery!.id, item.id)
        .pipe(
          tap(() => {
            this.notificationService.success('history-query.items.disabled', { name: item.name });
          }),
          switchMap(() => {
            return this.historyQueryService.listItems(this.historyQuery!.id);
          })
        )
        .subscribe(items => {
          this.allItems = items;
          this.filteredItems = this.filter(items);
          this.changePage(this.displayedItems.number);
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
}
