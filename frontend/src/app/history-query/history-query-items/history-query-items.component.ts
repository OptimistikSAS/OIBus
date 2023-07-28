import { Component, Input, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { NgForOf, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Modal, ModalService } from '../../shared/modal.service';
import { FormControlValidationDirective } from '../../shared/form-control-validation.directive';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { SouthConnectorItemDTO, SouthConnectorItemManifest } from '../../../../../shared/model/south-connector.model';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { createPageFromArray, Page } from '../../../../../shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { EditHistoryQueryItemModalComponent } from '../edit-history-query-item-modal/edit-history-query-item-modal.component';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { HistoryQueryService } from '../../services/history-query.service';

const PAGE_SIZE = 20;

@Component({
  selector: 'oib-history-query-items',
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
  templateUrl: './history-query-items.component.html',
  styleUrls: ['./history-query-items.component.scss']
})
export class HistoryQueryItemsComponent implements OnInit {
  @Input() historyQuery: HistoryQueryDTO | null = null;
  @Input() southConnectorItemSchema!: SouthConnectorItemManifest;

  allItems: Array<SouthConnectorItemDTO> = [];
  private filteredItems: Array<SouthConnectorItemDTO> = [];
  displayedItems: Page<SouthConnectorItemDTO> = emptyPage();
  displaySettings: Array<OibFormControl> = [];

  searchControl = this.fb.control(null as string | null);

  constructor(
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService,
    private modalService: ModalService,
    private historyQueryService: HistoryQueryService,
    private fb: NonNullableFormBuilder
  ) {}

  ngOnInit() {
    this.fetchItemsAndResetPage();
    this.displaySettings = this.southConnectorItemSchema.settings.filter(setting => setting.displayInViewMode);

    // subscribe to changes to search control
    this.searchControl.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      this.filteredItems = this.filter(this.allItems);
      this.changePage(0);
    });
  }

  fetchItemsAndResetPage() {
    if (this.historyQuery) {
      this.historyQueryService.listItems(this.historyQuery.id).subscribe(items => {
        this.allItems = items;
        this.filteredItems = this.filter(items);
        this.changePage(0);
      });
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
    if (this.historyQuery) {
      const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, { size: 'xl' });
      const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
      component.prepareForEdition(this.historyQuery, this.southConnectorItemSchema, southItem);
      this.refreshAfterModalClosed(modalRef, 'updated');
    }
  }

  /**
   * Open a modal to create a South item
   */
  addItem() {
    if (this.historyQuery) {
      const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, { size: 'xl' });
      const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
      component.prepareForCreation(this.historyQuery, this.southConnectorItemSchema);
      this.refreshAfterModalClosed(modalRef, 'created');
    }
  }

  /**
   * Refresh the South item list when the South item is edited
   */
  private refreshAfterModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result.subscribe(() => {
      this.fetchItemsAndResetPage();
      this.notificationService.success(`history-query.items.${mode}`);
    });
  }

  /**
   * Deletes a parser by its ID and refreshes the list
   */
  deleteItem(item: SouthConnectorItemDTO) {
    if (this.historyQuery) {
      this.confirmationService
        .confirm({
          messageKey: 'south.items.confirm-deletion'
        })
        .pipe(switchMap(() => this.historyQueryService.deleteItem(this.historyQuery!.id, item.id)))
        .subscribe(() => {
          this.fetchItemsAndResetPage();
          this.notificationService.success('history-query.items.deleted');
        });
    }
  }

  duplicateItem(item: SouthConnectorItemDTO) {
    if (this.historyQuery) {
      const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent, { size: 'xl' });
      const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
      component.prepareForCopy(this.historyQuery, this.southConnectorItemSchema, item);
      this.refreshAfterModalClosed(modalRef, 'created');
    }
  }

  /**
   * Export items into a csv file
   */
  exportItems() {
    if (this.historyQuery) {
      this.historyQueryService.exportItems(this.historyQuery.id, this.historyQuery.name).subscribe();
    }
  }

  /**
   * Delete all items
   */
  deleteAllItems() {
    if (this.historyQuery) {
      this.confirmationService
        .confirm({
          messageKey: 'history-query.items.confirm-delete-all'
        })
        .pipe(switchMap(() => this.historyQueryService.deleteAllItems(this.historyQuery!.id)))
        .subscribe(() => {
          this.fetchItemsAndResetPage();
          this.notificationService.success('history-query.items.all-deleted');
        });
    }
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
    if (this.historyQuery) {
      this.historyQueryService.uploadItems(this.historyQuery.id, file).subscribe(() => {
        this.notificationService.success('history-query.items.imported');
      });
    }
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
}
