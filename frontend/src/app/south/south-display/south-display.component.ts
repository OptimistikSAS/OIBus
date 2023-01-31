import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf, NgSwitch } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  SouthConnectorDTO,
  SouthItemDTO,
  SouthItemManifest,
  SouthItemSearchParam
} from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { OibFormControl, OibScanModeFormControl } from '../../../../../shared/model/form.model';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { Page } from '../../../../../shared/model/types';
import { NotificationService } from '../../shared/notification.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { Modal, ModalService } from '../../shared/modal.service';
import { PageLoader } from '../../shared/page-loader.service';
import { EditSouthItemModalComponent } from '../edit-south-item-modal/edit-south-item-modal.component';
import { SearchItemComponent } from '../search-item/search-item.component';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { toPage } from '../../shared/test-utils';
import { getRowSettings } from '../../shared/utils';

@Component({
  selector: 'oib-south-display',
  standalone: true,
  imports: [NgIf, TranslateModule, RouterLink, NgSwitch, NgForOf, PaginationComponent, SearchItemComponent],
  templateUrl: './south-display.component.html',
  styleUrls: ['./south-display.component.scss'],
  providers: [PageLoader]
})
export class SouthDisplayComponent implements OnInit {
  southConnector: SouthConnectorDTO | null = null;
  southSettingsSchema: Array<Array<OibFormControl>> = [];
  southItemSchema: SouthItemManifest | null = null;
  southItems: Page<SouthItemDTO> | null = null;
  scanModes: Array<ScanModeDTO> = [];
  scanModeOptions: OibScanModeFormControl | null = null;
  searchParams: SouthItemSearchParam | null = null;

  constructor(
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
          const paramSouthId = params.get('southId');

          if (paramSouthId) {
            return this.southConnectorService.getSouthConnector(paramSouthId);
          }
          return of(null);
        }),
        switchMap(southConnector => {
          if (!southConnector) {
            return of(null);
          }
          this.southConnector = southConnector;
          return this.southConnectorService.getSouthConnectorTypeManifest(this.southConnector!.type);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          return;
        }
        const rowList = getRowSettings(manifest.settings, this.southConnector?.settings);
        this.southSettingsSchema = rowList;
        this.southItemSchema = manifest.items;
      });
    this.pageLoader.pageLoads$
      .pipe(
        switchMap(() => {
          const queryParamMap = this.route.snapshot.queryParamMap;
          const paramMap = this.route.snapshot.paramMap;

          if (!paramMap.get('southId')) {
            return of(toPage([]));
          }
          const page = queryParamMap.get('page') ? parseInt(queryParamMap.get('page')!, 10) : 0;
          const name = queryParamMap.get('name') ? queryParamMap.get('name')! : null;
          this.searchParams = {
            page,
            name
          };
          return this.southConnectorService.searchSouthItems(paramMap.get('southId')!, { page, name });
        })
      )
      .subscribe(southItems => {
        this.southItems = southItems;
      });
  }

  shouldDisplayInput(settings: OibFormControl) {
    return (
      settings.readDisplay &&
      (!settings.conditionalDisplay ||
        Object.entries(settings.conditionalDisplay).every(([key, values]) => {
          return this.southConnector && values.includes(this.southConnector.settings[key]);
        }))
    );
  }

  getScanMode(scanModeId: string) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }

  searchItem(searchParams: SouthItemSearchParam) {
    this.router.navigate(['.'], { queryParams: { page: 0, name: searchParams.name }, relativeTo: this.route });
  }

  /**
   * Open a modal to edit a South item
   */
  openEditSouthItemModal(southItem: SouthItemDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent);
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForEdition(this.southConnector!, this.southItemSchema!, this.scanModes, southItem);
    this.refreshAfterEditSouthItemModalClosed(modalRef, 'updated');
  }

  /**
   * Open a modal to create a South item
   */
  openCreationSouthItemModal() {
    const modalRef = this.modalService.open(EditSouthItemModalComponent);
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.southConnector!, this.southItemSchema!, this.scanModes);
    this.refreshAfterEditSouthItemModalClosed(modalRef, 'created');
  }

  /**
   * Refresh the South item list when the South item is edited
   */
  private refreshAfterEditSouthItemModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result.subscribe(() => {
      this.southConnectorService.searchSouthItems(this.southConnector!.id, { page: 0, name: null }).subscribe(southItems => {
        this.southItems = southItems;
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
      .pipe(switchMap(() => this.southConnectorService.deleteSouthItem(this.southConnector!.id, southItem.id)))
      .subscribe(() => {
        this.notificationService.success('south.items.deleted');
        this.pageLoader.loadPage(this.southItems!);
      });
  }
}
