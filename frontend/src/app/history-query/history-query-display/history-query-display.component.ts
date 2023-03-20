import { Component, OnInit } from '@angular/core';
import { DecimalPipe, NgForOf, NgIf, NgSwitch } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, switchMap } from 'rxjs';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { getRowSettings } from '../../shared/utils';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { OibusItemDTO, SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { emptyPage } from '../../shared/test-utils';
import { Page } from '../../../../../shared/model//types';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SearchItemComponent } from '../../south/search-item/search-item.component';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { EditHistoryQueryItemModalComponent } from '../edit-history-query-item-modal/edit-history-query-item-modal.component';

@Component({
  selector: 'oib-history-query-display',
  standalone: true,
  imports: [NgIf, TranslateModule, RouterLink, NgSwitch, NgForOf, DecimalPipe, PaginationComponent, SearchItemComponent],
  templateUrl: './history-query-display.component.html',
  styleUrls: ['./history-query-display.component.scss'],
  providers: [PageLoader]
})
export class HistoryQueryDisplayComponent implements OnInit {
  historyQuery: HistoryQueryDTO | null = null;
  northSettingsSchema: Array<Array<OibFormControl>> = [];
  southSettingsSchema: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  northManifest: NorthConnectorManifest | null = null;
  southManifest: SouthConnectorManifest | null = null;
  historyQueryItems: Page<OibusItemDTO> = emptyPage();

  constructor(
    private historyQueryService: HistoryQueryService,
    private northConnectorService: NorthConnectorService,
    private southConnectorService: SouthConnectorService,
    private scanModeService: ScanModeService,
    private confirmationService: ConfirmationService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    protected router: Router,
    private route: ActivatedRoute,
    private pageLoader: PageLoader
  ) {}

  ngOnInit() {
    this.scanModeService.getScanModes().subscribe(scanModes => {
      this.scanModes = scanModes;
    });
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const paramHistoryQueryId = params.get('historyQueryId') || '';
          return this.historyQueryService.getHistoryQuery(paramHistoryQueryId);
        }),
        switchMap(historyQuery => {
          this.historyQuery = historyQuery;
          return combineLatest([
            this.historyQueryService.searchHistoryQueryItems(historyQuery.id, { page: 0, name: null }),
            this.northConnectorService.getNorthConnectorTypeManifest(historyQuery.northType),
            this.southConnectorService.getSouthConnectorTypeManifest(historyQuery.southType)
          ]);
        })
      )
      .subscribe(([historyItems, northManifest, southManifest]) => {
        if (!northManifest || !southManifest || !historyItems) {
          return;
        }
        const northRowList = getRowSettings(northManifest.settings, this.historyQuery!.northSettings);
        const southRowList = getRowSettings(southManifest.settings, this.historyQuery!.southSettings);

        this.northSettingsSchema = northRowList;
        this.southSettingsSchema = southRowList;
        this.northManifest = northManifest;
        this.southManifest = southManifest;
        this.historyQueryItems = historyItems;
      });
  }

  shouldDisplayInput(formSettings: OibFormControl, settingsValues: any) {
    return (
      formSettings.readDisplay &&
      (!formSettings.conditionalDisplay ||
        Object.entries(formSettings.conditionalDisplay).every(([key, values]) => {
          return values && values.includes(settingsValues[key]);
        }))
    );
  }

  getScanMode(scanModeId: string) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }

  /**
   * Open a modal to edit a South item
   */
  openEditSouthItemModal(southItem: OibusItemDTO) {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent);
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    component.prepareForEdition(this.historyQuery!, this.southManifest!.items, southItem);
    this.refreshAfterEditSouthItemModalClosed(modalRef, 'updated');
  }

  /**
   * Open a modal to create a South item
   */
  openCreationSouthItemModal() {
    const modalRef = this.modalService.open(EditHistoryQueryItemModalComponent);
    const component: EditHistoryQueryItemModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.historyQuery!, this.southManifest!.items);
    this.refreshAfterEditSouthItemModalClosed(modalRef, 'created');
  }

  /**
   * Refresh the South item list when the South item is edited
   */
  private refreshAfterEditSouthItemModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result.subscribe(() => {
      this.historyQueryService.searchHistoryQueryItems(this.historyQuery!.id, { page: 0, name: null }).subscribe(southItems => {
        this.historyQueryItems = southItems;
      });
      this.notificationService.success(`south.items.${mode}`);
    });
  }

  /**
   * Deletes a parser by its ID and refreshes the list
   */
  deleteItem(southItem: any) {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-deletion'
      })
      .pipe(switchMap(() => this.historyQueryService.deleteSouthItem(this.historyQuery!.id, southItem.id)))
      .subscribe(() => {
        this.notificationService.success('south.items.deleted');
        this.pageLoader.loadPage(this.historyQueryItems!);
      });
  }
}
