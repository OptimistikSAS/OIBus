import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';

import { RouterLink } from '@angular/router';
import { Modal, ModalService } from '../../shared/modal.service';
import { FormControlValidationDirective } from '../../shared/form-control-validation.directive';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
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
import { HistoryQueryItemTestModalComponent } from '../history-query-item-test-modal/history-query-item-test-modal.component';
import { PipeProviderService } from '../../shared/form/pipe-provider.service';
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
export class HistoryQueryItemsComponent implements OnInit, OnChanges {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private historyQueryService = inject(HistoryQueryService);
  private pipeProviderService = inject(PipeProviderService);

  @Input() historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null = null;
  @Input() creationItems: Array<HistoryQueryItemCommandDTO<SouthItemSettings>> = [];
  @Input({ required: true }) southManifest!: SouthConnectorManifest;
  @Output() readonly inMemoryItems = new EventEmitter<Array<HistoryQueryItemCommandDTO<SouthItemSettings>> | null>();

  allItems: Array<HistoryQueryItemCommandDTO<SouthItemSettings>> = [];
  filteredItems: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>> = [];

  displayedItems: Page<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>> = emptyPage();
  displaySettings: Array<OibFormControl> = [];

  searchControl = inject(NonNullableFormBuilder).control(null as string | null);

  columnSortStates: { [key in keyof TableData]: ColumnSortState } = {
    name: ColumnSortState.INDETERMINATE
  };
  currentColumnSort: keyof TableData | null = 'name';

  ngOnInit() {
    this.allItems = this.creationItems;
    this.resetPage();
    this.displaySettings = this.southManifest.items.settings.filter(setting => setting.displayInViewMode);

    // subscribe to changes to search control
    this.searchControl.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      this.resetPage();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    // reset column sorting
    this.columnSortStates = { name: ColumnSortState.INDETERMINATE };
    this.currentColumnSort = 'name';

    if (changes['historyQuery']) {
      this.resetPage();
    }
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
    if (this.historyQuery) {
      return this.historyQuery.items.filter(item => item.name.toLowerCase().includes(searchText.toLowerCase()));
    } else {
      return this.allItems.filter(item => item.name.toLowerCase().includes(searchText.toLowerCase()));
    }
  }

  editItem(historyQueryItem: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>) {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, { size: 'xl' });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    component.prepareForEdition(this.southManifest.items, this.allItems, historyQueryItem);
    this.refreshAfterEditionModalClosed(modalRef, historyQueryItem);
  }

  addItem() {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, { size: 'xl' });
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.southManifest.items, this.allItems);
    this.refreshAfterCreationModalClosed(modalRef);
  }

  /**
   * Refresh the History Query item list when a History Query item is created
   */
  private refreshAfterCreationModalClosed(modalRef: Modal<any>) {
    modalRef.result
      .pipe(
        switchMap((command: HistoryQueryItemDTO<SouthItemSettings>) => {
          if (this.historyQuery) {
            return this.historyQueryService.createItem(this.historyQuery!.id, command);
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
        if (this.historyQuery) {
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
          if (this.historyQuery) {
            return this.historyQueryService.updateItem(this.historyQuery.id, command.id!, command);
          } else {
            this.allItems = this.allItems.filter(item => item.name !== oldItem.name);
            this.allItems.push({ ...oldItem, ...command });
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.historyQuery) {
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
          if (this.historyQuery) {
            return this.historyQueryService.deleteItem(this.historyQuery!.id, item.id!);
          } else {
            this.allItems = this.allItems.filter(element => element.name !== item.name);
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.historyQuery) {
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
    component.prepareForCopy(this.southManifest.items, item);
    this.refreshAfterCreationModalClosed(modalRef);
  }

  testItem(item: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>) {
    this.historyQueryService.testItem(this.historyQuery!.id, this.historyQuery, item).subscribe(result => {
      const modalRef = this.modalService.open(HistoryQueryItemTestModalComponent, { size: 'xl' });
      modalRef.componentInstance.prepare(result, item);
    });
  }

  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent);
    modalRef.componentInstance.prepare(this.historyQuery?.name);
    modalRef.result.subscribe(response => {
      if (response.delimiter && this.historyQuery) {
        this.historyQueryService.exportItems(this.historyQuery.id, response.fileName, response.delimiter).subscribe();
      } else if (response && !this.historyQuery) {
        this.historyQueryService.itemsToCsv(this.allItems, response.fileName, response.delimiter).subscribe();
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
          if (this.historyQuery) {
            return this.historyQueryService.deleteAllItems(this.historyQuery!.id);
          } else {
            this.allItems = [];
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.historyQuery) {
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
    this.historyQueryService
      .checkImportItems(
        this.southManifest.id,
        this.historyQuery?.id || 'create',
        this.historyQuery ? this.historyQuery.items : this.allItems,
        file,
        delimiter
      )
      .subscribe(
        (result: {
          items: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>;
          errors: Array<{ item: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>; error: string }>;
        }) => {
          const modalRef = this.modalService.open(ImportHistoryQueryItemsModalComponent, { size: 'xl' });
          const component: ImportHistoryQueryItemsModalComponent = modalRef.componentInstance;
          component.prepare(
            this.southManifest.items,
            this.historyQuery ? this.historyQuery.items : this.allItems,
            result.items,
            result.errors
          );
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
          if (this.historyQuery) {
            return this.historyQueryService.importItems(this.historyQuery!.id, newItems);
          } else {
            for (const item of newItems) {
              this.allItems.push(item);
            }
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.historyQuery) {
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
        .enableItem(this.historyQuery!.id, item.id!)
        .pipe(
          tap(() => {
            this.notificationService.success('history-query.items.enabled', { name: item.name });
          })
        )
        .subscribe(() => {
          if (this.historyQuery) {
            this.inMemoryItems.emit(null);
          }
        });
    } else {
      this.historyQueryService
        .disableItem(this.historyQuery!.id, item.id!)
        .pipe(
          tap(() => {
            this.notificationService.success('history-query.items.disabled', { name: item.name });
          })
        )
        .subscribe(() => {
          if (this.historyQuery) {
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

  getFieldValue(element: any, field: string, pipeIdentifier: string | undefined): string {
    const value = element[field];
    if (value && pipeIdentifier && this.pipeProviderService.validIdentifier(pipeIdentifier)) {
      return this.pipeProviderService.getPipeForString(pipeIdentifier).transform(value);
    }
    return value;
  }
}
