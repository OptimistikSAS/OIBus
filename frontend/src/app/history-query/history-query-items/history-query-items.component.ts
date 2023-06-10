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
import { OibusItemDTO, OibusItemManifest } from '../../../../../shared/model/south-connector.model';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
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
  @Input() southConnectorItemSchema!: OibusItemManifest;
  @Input() scanModes!: Array<ScanModeDTO>;

  allItems: Array<OibusItemDTO> = [];
  private filteredItems: Array<OibusItemDTO> = [];
  displayedItems: Page<OibusItemDTO> = emptyPage();
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
    this.displaySettings = this.southConnectorItemSchema.settings.filter(setting => setting.readDisplay);

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

  private createPage(pageNumber: number): Page<OibusItemDTO> {
    return createPageFromArray(this.filteredItems, PAGE_SIZE, pageNumber);
  }

  filter(items: Array<OibusItemDTO>): Array<OibusItemDTO> {
    const searchText = this.searchControl.value;
    if (!searchText) {
      return items;
    }
    return items.filter(item => item.name.toLowerCase().includes(searchText));
  }

  /**
   * Open a modal to edit a South item
   */
  editItem(southItem: OibusItemDTO) {
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
      this.notificationService.success(`south.items.${mode}`);
    });
  }

  /**
   * Deletes a parser by its ID and refreshes the list
   */
  deleteItem(item: OibusItemDTO) {
    if (this.historyQuery) {
      this.confirmationService
        .confirm({
          messageKey: 'south.items.confirm-deletion'
        })
        .pipe(switchMap(() => this.historyQueryService.deleteItem(this.historyQuery!.id, item.id)))
        .subscribe(() => {
          this.fetchItemsAndResetPage();
          this.notificationService.success('south.items.deleted');
        });
    }
  }

  duplicateItem(item: OibusItemDTO) {
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
          messageKey: 'south.items.confirm-delete-all'
        })
        .pipe(switchMap(() => this.historyQueryService.deleteAllItems(this.historyQuery!.id)))
        .subscribe(() => {
          this.fetchItemsAndResetPage();
          this.notificationService.success('south.items.all-deleted');
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
        this.notificationService.success('south.items.imported');
      });
    }
  }

  getScanMode(scanModeId: string | undefined): ScanModeDTO | undefined {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId);
  }
}
