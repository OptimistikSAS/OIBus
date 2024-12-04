import { Component, inject, OnChanges, OnInit, SimpleChanges, output, input } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';

import { Modal, ModalService } from '../../shared/modal.service';
import { FormControlValidationDirective } from '../../shared/form-control-validation.directive';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { EditSouthItemModalComponent } from '../edit-south-item-modal/edit-south-item-modal.component';
import { debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { OibFormControl } from '../../../../../backend/shared/model/form.model';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { PipeProviderService } from '../../shared/form/pipe-provider.service';
import { ImportSouthItemsModalComponent } from '../import-south-items-modal/import-south-items-modal.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { ImportItemModalComponent } from '../../shared/import-item-modal/import-item-modal.component';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';

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
    FormControlValidationDirective,
    FormsModule,
    ReactiveFormsModule,
    BoxComponent,
    BoxTitleDirective,
    PaginationComponent,
    OibHelpComponent,
    TranslatePipe
  ],
  templateUrl: './south-items.component.html',
  styleUrl: './south-items.component.scss'
})
export class SouthItemsComponent implements OnInit, OnChanges {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private southConnectorService = inject(SouthConnectorService);
  private pipeProviderService = inject(PipeProviderService);
  readonly southConnector = input<SouthConnectorDTO<SouthSettings, SouthItemSettings> | null>(null);
  readonly southId = input.required<string>();
  readonly southConnectorCommand = input.required<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>>();

  readonly southManifest = input.required<SouthConnectorManifest>();
  readonly scanModes = input.required<Array<ScanModeDTO>>();

  readonly inMemoryItems = output<Array<SouthConnectorItemCommandDTO<SouthItemSettings>> | null>();

  allItems: Array<SouthConnectorItemCommandDTO<SouthItemSettings>> = []; // Array used to store item commands on south connector creation
  filteredItems: Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>> = [];

  displayedItems: Page<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>> = emptyPage();
  displaySettings: Array<OibFormControl> = [];

  searchControl = inject(NonNullableFormBuilder).control(null as string | null);

  columnSortStates: { [key in keyof TableData]: ColumnSortState } = {
    name: ColumnSortState.INDETERMINATE,
    scanMode: ColumnSortState.INDETERMINATE
  };
  currentColumnSort: keyof TableData | null = 'name';

  ngOnInit() {
    this.resetPage();
    this.displaySettings = this.southManifest().items.settings.filter(setting => setting.displayInViewMode);

    // subscribe to changes to search control
    this.searchControl.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      this.resetPage();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    // reset column sorting
    this.columnSortStates = { name: ColumnSortState.INDETERMINATE, scanMode: ColumnSortState.INDETERMINATE };
    this.currentColumnSort = 'name';

    if (changes['southConnector']) {
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

  filter(): Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>> {
    const searchText = this.searchControl.value || '';
    const southConnector = this.southConnector();
    if (southConnector) {
      return southConnector.items.filter(item => item.name.toLowerCase().includes(searchText.toLowerCase()));
    } else {
      return this.allItems.filter(item => item.name.toLowerCase().includes(searchText.toLowerCase()));
    }
  }

  editItem(southItem: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForEdition(
      this.southManifest().items,
      this.allItems,
      this.scanModes(),
      southItem,
      this.southId(),
      this.southConnectorCommand(),
      this.southManifest()
    );
    this.refreshAfterEditionModalClosed(modalRef, southItem);
  }

  addItem() {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCreation(
      this.southManifest().items,
      this.allItems,
      this.scanModes(),
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
        switchMap((command: SouthConnectorItemCommandDTO<SouthItemSettings>) => {
          const southConnector = this.southConnector();
          if (southConnector) {
            return this.southConnectorService.createItem(southConnector!.id, command);
          } else {
            this.allItems.push({
              id: command.id ?? null,
              name: command.name,
              enabled: command.enabled,
              scanModeId: command.scanModeId!,
              scanModeName: null,
              settings: { ...command.settings }
            });
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.southConnector()) {
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
  private refreshAfterEditionModalClosed(
    modalRef: Modal<any>,
    oldItem: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>
  ) {
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemCommandDTO<SouthItemSettings>) => {
          const southConnector = this.southConnector();
          if (southConnector) {
            return this.southConnectorService.updateItem(southConnector!.id, command.id!, command);
          } else {
            this.allItems = this.allItems.filter(item => item.name !== oldItem.name);
            this.allItems.push({ ...oldItem, ...command });
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.southConnector()) {
          this.notificationService.success(`south.items.updated`);
          this.inMemoryItems.emit(null);
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  deleteItem(item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>) {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-deletion'
      })
      .pipe(
        switchMap(() => {
          const southConnector = this.southConnector();
          if (southConnector) {
            return this.southConnectorService.deleteItem(southConnector!.id, item.id!);
          } else {
            this.allItems = this.allItems.filter(element => element.name !== item.name);
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.southConnector()) {
          this.notificationService.success('south.items.deleted');
          this.inMemoryItems.emit(null);
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  duplicateItem(item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCopy(
      this.southManifest().items,
      this.scanModes(),
      item,
      this.southId(),
      this.southConnectorCommand(),
      this.southManifest()
    );
    this.refreshAfterCreationModalClosed(modalRef);
  }

  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent);
    modalRef.componentInstance.prepare(this.southConnector()?.name);
    modalRef.result.subscribe(response => {
      const southConnector = this.southConnector();
      if (response && southConnector) {
        this.southConnectorService.exportItems(southConnector!.id, response.fileName, response.delimiter).subscribe();
      } else if (response && !southConnector) {
        this.southConnectorService.itemsToCsv(this.allItems, response.fileName, response.delimiter).subscribe();
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
          const southConnector = this.southConnector();
          if (southConnector) {
            return this.southConnectorService.deleteAllItems(southConnector!.id);
          } else {
            this.allItems = [];
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.southConnector()) {
          this.notificationService.success('south.items.all-deleted');
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
    const southConnector = this.southConnector();
    this.southConnectorService
      .checkImportItems(this.southManifest().id, this.southId(), southConnector ? southConnector.items : this.allItems, file, delimiter)
      .subscribe(
        (result: {
          items: Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>>;
          errors: Array<{
            item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>;
            error: string;
          }>;
        }) => {
          const modalRef = this.modalService.open(ImportSouthItemsModalComponent, { size: 'xl' });
          const component: ImportSouthItemsModalComponent = modalRef.componentInstance;
          const southConnectorValue = this.southConnector();
          component.prepare(
            this.southManifest().items,
            southConnectorValue ? southConnectorValue.items : this.allItems,
            result.items,
            result.errors,
            this.scanModes()
          );
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
        switchMap((newItems: Array<SouthConnectorItemCommandDTO<SouthItemSettings>>) => {
          const southConnector = this.southConnector();
          if (southConnector) {
            return this.southConnectorService.importItems(southConnector!.id, newItems);
          } else {
            for (const item of newItems) {
              this.allItems.push(item);
            }
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.southConnector()) {
          this.notificationService.success(`south.items.import.imported`);
          this.inMemoryItems.emit(null);
        } else {
          this.inMemoryItems.emit(this.allItems);
          this.resetPage();
        }
      });
  }

  getScanMode(scanModeId: string | null): ScanModeDTO | undefined {
    return this.scanModes().find(scanMode => scanMode.id === scanModeId);
  }

  toggleItem(item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>, value: boolean) {
    if (value) {
      this.southConnectorService
        .enableItem(this.southConnector()!.id, item.id!)
        .pipe(
          tap(() => {
            this.notificationService.success('south.items.enabled', { name: item.name });
          })
        )
        .subscribe(() => {
          if (this.southConnector()) {
            this.inMemoryItems.emit(null);
          }
        });
    } else {
      this.southConnectorService
        .disableItem(this.southConnector()!.id, item.id!)
        .pipe(
          tap(() => {
            this.notificationService.success('south.items.disabled', { name: item.name });
          })
        )
        .subscribe(() => {
          if (this.southConnector()) {
            this.inMemoryItems.emit(null);
          }
        });
    }
  }

  getFieldValue(element: any, field: string, pipeIdentifier: string | undefined): string {
    const value = element[field];
    if (value && pipeIdentifier && this.pipeProviderService.validIdentifier(pipeIdentifier)) {
      return this.pipeProviderService.getPipeForString(pipeIdentifier).transform(value);
    }
    return value;
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
              ? this.getScanMode(a.scanModeId)!.name.localeCompare(this.getScanMode(b.scanModeId)!.name)
              : this.getScanMode(b.scanModeId)!.name.localeCompare(this.getScanMode(a.scanModeId)!.name)
          );
          break;
      }
    }
  }
}
