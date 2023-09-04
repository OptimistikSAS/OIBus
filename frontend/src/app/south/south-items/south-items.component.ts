import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { NgForOf, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Modal, ModalService } from '../../shared/modal.service';
import { FormControlValidationDirective } from '../../shared/form-control-validation.directive';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import {
  SouthConnectorItemDTO,
  SouthConnectorItemManifest,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO
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

const PAGE_SIZE = 20;

@Component({
  selector: 'oib-south-items',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    NgIf,
    NgForOf,
    FormControlValidationDirective,
    FormsModule,
    LoadingSpinnerComponent,
    ReactiveFormsModule,
    BoxComponent,
    BoxTitleDirective,
    DatetimePipe,
    DurationPipe
  ],
  templateUrl: './south-items.component.html',
  styleUrls: ['./south-items.component.scss']
})
export class SouthItemsComponent implements OnInit {
  @Input() southConnector: SouthConnectorDTO | null = null;
  @Input({ required: true }) southConnectorItemSchema!: SouthConnectorItemManifest;
  @Input({ required: true }) scanModes!: Array<ScanModeDTO>;
  @Input() inMemory = false;

  @Output() readonly inMemoryItems = new EventEmitter<Array<SouthConnectorItemDTO>>();

  allItems: Array<SouthConnectorItemDTO> = [];
  private filteredItems: Array<SouthConnectorItemDTO> = [];
  displayedItems: Page<SouthConnectorItemDTO> = emptyPage();
  displaySettings: Array<OibFormControl> = [];

  searchControl = this.fb.control(null as string | null);

  constructor(
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService,
    private modalService: ModalService,
    private southConnectorService: SouthConnectorService,
    private pipeProviderService: PipeProviderService,
    private fb: NonNullableFormBuilder
  ) {}

  ngOnInit() {
    this.fetchItemsAndResetPage(false);
    this.displaySettings = this.southConnectorItemSchema.settings.filter(setting => setting.displayInViewMode);

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
      });
    } else {
      this.filteredItems = this.filter(this.allItems);
      this.changePage(0);
      this.inMemoryItems.emit(this.allItems);
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
    return items.filter(item => item.name.toLowerCase().includes(searchText));
  }

  /**
   * Open a modal to edit a South item
   */
  editItem(southItem: SouthConnectorItemDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForEdition(this.southConnectorItemSchema, this.allItems, this.scanModes, southItem);
    this.refreshAfterEditionModalClosed(modalRef);
  }

  /**
   * Open a modal to create a South item
   */
  addItem() {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.southConnectorItemSchema, this.allItems, this.scanModes);
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
            this.allItems.push({ id: command.id ?? '', connectorId: this.southConnector?.id ?? '', ...command });
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
  private refreshAfterEditionModalClosed(modalRef: Modal<any>) {
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemCommandDTO) => {
          if (this.southConnector) {
            return this.southConnectorService.updateItem(this.southConnector.id, command.id || '', command);
          } else {
            this.allItems.push({ id: '', connectorId: '', ...command });
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
            this.allItems = this.allItems.filter(element => element.name !== item.name);
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
    component.prepareForCopy(this.southConnectorItemSchema, this.scanModes, item);
    this.refreshAfterCreationModalClosed(modalRef);
  }

  /**
   * Export items into a csv file
   */
  exportItems() {
    if (this.southConnector) {
      this.southConnectorService.exportItems(this.southConnector.id, this.southConnector.name).subscribe();
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
    this.importItems(file!);
  }

  onImportClick(e: Event) {
    const fileInput = e.target as HTMLInputElement;
    const file = fileInput!.files![0];
    fileInput.value = '';
    this.importItems(file!);
  }

  importItems(file: File) {
    if (this.southConnector) {
      this.southConnectorService.uploadItems(this.southConnector.id, file).subscribe(() => {
        this.notificationService.success('south.items.imported');
      });
    }
  }

  getScanMode(scanModeId: string | null): ScanModeDTO | undefined {
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
