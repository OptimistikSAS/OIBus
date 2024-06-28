import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';

import { RouterLink } from '@angular/router';
import { Modal, ModalService } from '../../shared/modal.service';
import { FormControlValidationDirective } from '../../shared/form-control-validation.directive';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import {
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorManifest
} from '../../../../../shared/model/south-connector.model';
import { EditSouthItemModalComponent } from '../edit-south-item-modal/edit-south-item-modal.component';
import { debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { createPageFromArray, Page } from '../../../../../shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { PipeProviderService } from '../../shared/form/pipe-provider.service';
import { ImportSouthItemsModalComponent } from '../import-south-items-modal/import-south-items-modal.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';

const PAGE_SIZE = 20;

@Component({
  selector: 'oib-south-items',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    FormControlValidationDirective,
    FormsModule,
    LoadingSpinnerComponent,
    ReactiveFormsModule,
    BoxComponent,
    BoxTitleDirective,
    DatetimePipe,
    DurationPipe,
    PaginationComponent,
    OibHelpComponent
  ],
  templateUrl: './south-items.component.html',
  styleUrl: './south-items.component.scss'
})
export class SouthItemsComponent implements OnInit {
  @Input() southConnector: SouthConnectorDTO | null = null;
  @Input({ required: true }) southManifest!: SouthConnectorManifest;
  @Input({ required: true }) scanModes!: Array<ScanModeDTO>;
  @Input() inMemory = false;
  @Input() maxInstantPerItem: boolean | null = null;

  @Output() readonly inMemoryItems = new EventEmitter<{
    items: Array<SouthConnectorItemDTO>;
    itemIdsToDelete: Array<string>;
  }>();

  allItems: Array<SouthConnectorItemDTO> = [];
  itemIdsToDelete: Array<string> = [];
  filteredItems: Array<SouthConnectorItemDTO> = [];
  displayedItems: Page<SouthConnectorItemDTO> = emptyPage();
  displaySettings: Array<OibFormControl> = [];

  searchControl = inject(NonNullableFormBuilder).control(null as string | null);

  constructor(
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService,
    private modalService: ModalService,
    private southConnectorService: SouthConnectorService,
    private pipeProviderService: PipeProviderService
  ) {}

  ngOnInit() {
    this.fetchItemsAndResetPage(false);
    this.displaySettings = this.southManifest.items.settings.filter(setting => setting.displayInViewMode);

    // subscribe to changes to search control
    this.searchControl.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      this.filteredItems = this.filter(this.allItems);
      this.changePage(0);
    });
  }

  fetchItemsAndResetPage(fromMemory: boolean) {
    if (this.southConnector && !fromMemory) {
      this.southConnectorService.listItems(this.southConnector.id).subscribe(items => {
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
    component.prepareForEdition(this.southManifest.items, this.allItems, this.scanModes, southItem, this.maxInstantPerItem);
    this.refreshAfterEditionModalClosed(modalRef, southItem);
  }

  /**
   * Open a modal to create a South item
   */
  addItem() {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.southManifest.items, this.allItems, this.scanModes);
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
            return this.southConnectorService.createItem(this.southConnector!.id, command);
          } else {
            this.allItems.push({
              id: command.id ?? '',
              name: command.name,
              enabled: command.enabled,
              connectorId: this.southConnector?.id ?? '',
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
          this.notificationService.success(`south.items.created`);
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
            return this.southConnectorService.updateItem(this.southConnector!.id, command.id || '', command);
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
          this.notificationService.success(`south.items.updated`);
        }
      });
  }

  /**
   * Deletes a parser by its ID and refreshes the list
   */
  deleteItem(item: SouthConnectorItemDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-deletion'
      })
      .pipe(
        switchMap(() => {
          if (!this.inMemory) {
            return this.southConnectorService.deleteItem(this.southConnector!.id, item.id);
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
          this.notificationService.success('south.items.deleted');
        }
      });
  }

  duplicateItem(item: SouthConnectorItemDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCopy(this.southManifest.items, this.scanModes, item);
    this.refreshAfterCreationModalClosed(modalRef);
  }

  /**
   * Export items into a csv file
   */
  exportItems() {
    if (!this.inMemory) {
      this.southConnectorService.exportItems(this.southConnector!.id, this.southConnector!.name).subscribe();
    } else {
      this.southConnectorService.itemsToCsv(this.allItems, this.southConnector?.name ?? 'south-items').subscribe();
    }
  }

  /**
   * Delete all items
   */
  deleteAllItems() {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-delete-all'
      })
      .pipe(
        switchMap(() => {
          if (!this.inMemory) {
            return this.southConnectorService.deleteAllItems(this.southConnector!.id);
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
          this.notificationService.success('south.items.all-deleted');
        }
      });
  }

  onImportDragOver(e: Event) {
    e.preventDefault();
  }

  onImportDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer!.files![0];
    this.checkImportItems(file!);
  }

  onImportClick(e: Event) {
    const fileInput = e.target as HTMLInputElement;
    const file = fileInput!.files![0];
    fileInput.value = '';
    this.checkImportItems(file!);
  }

  checkImportItems(file: File) {
    this.southConnectorService
      .checkImportItems(this.southManifest.id, this.southConnector?.id || 'create', file, this.itemIdsToDelete)
      .subscribe((result: { items: Array<SouthConnectorItemDTO>; errors: Array<{ item: SouthConnectorItemDTO; message: string }> }) => {
        const modalRef = this.modalService.open(ImportSouthItemsModalComponent, { size: 'xl' });
        const component: ImportSouthItemsModalComponent = modalRef.componentInstance;
        component.prepare(this.southManifest.items, this.allItems, result.items, result.errors, this.scanModes);
        this.refreshAfterImportModalClosed(modalRef);
      });
  }

  /**
   * Refresh the South item list when South items are created
   */
  private refreshAfterImportModalClosed(modalRef: Modal<any>) {
    modalRef.result
      .pipe(
        switchMap((newItems: Array<SouthConnectorItemDTO>) => {
          if (!this.inMemory) {
            return this.southConnectorService.importItems(this.southConnector!.id, newItems);
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

  getScanMode(scanModeId: string | null | undefined): ScanModeDTO | undefined {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId);
  }

  toggleItem(item: SouthConnectorItemDTO, value: boolean) {
    if (value) {
      this.southConnectorService
        .enableItem(this.southConnector!.id, item.id)
        .pipe(
          tap(() => {
            this.notificationService.success('south.items.enabled', { name: item.name });
          }),
          switchMap(() => {
            return this.southConnectorService.listItems(this.southConnector!.id);
          })
        )
        .subscribe(items => {
          this.allItems = items;
          this.filteredItems = this.filter(items);
          this.changePage(this.displayedItems.number);
        });
    } else {
      this.southConnectorService
        .disableItem(this.southConnector!.id, item.id)
        .pipe(
          tap(() => {
            this.notificationService.success('south.items.disabled', { name: item.name });
          }),
          switchMap(() => {
            return this.southConnectorService.listItems(this.southConnector!.id);
          })
        )
        .subscribe(items => {
          this.allItems = items;
          this.filteredItems = this.filter(items);
          this.changePage(this.displayedItems.number);
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
}
