import { Component, Input, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { combineLatest, switchMap } from 'rxjs';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { SubscriptionDTO } from '../../../../../shared/model/subscription.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { CreateNorthSubscriptionModalComponent } from '../create-north-subscription-modal/create-north-subscription-modal.component';

@Component({
  selector: 'oib-north-subscriptions',
  standalone: true,
  imports: [NgIf, NgForOf, TranslateModule],
  templateUrl: './north-subscriptions.component.html',
  styleUrls: ['./north-subscriptions.component.scss']
})
export class NorthSubscriptionsComponent implements OnInit {
  @Input() northConnector: NorthConnectorDTO | null = null;

  northSubscriptions: Array<SubscriptionDTO> = [];
  southConnectors: Array<SouthConnectorDTO> = [];

  constructor(
    private confirmationService: ConfirmationService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private northConnectorService: NorthConnectorService,
    private southConnectorService: SouthConnectorService
  ) {}

  ngOnInit() {
    combineLatest([
      this.northConnectorService.getNorthConnectorSubscriptions(this.northConnector!.id),
      this.southConnectorService.getSouthConnectors()
    ]).subscribe(([subscriptions, southConnectors]) => {
      this.northSubscriptions = subscriptions;
      this.southConnectors = southConnectors;
    });
  }

  /**
   * Open a modal to create a scan mode
   */
  openCreationScanModeModal() {
    const modalRef = this.modalService.open(CreateNorthSubscriptionModalComponent);
    const component: CreateNorthSubscriptionModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.northConnector!.id, this.southConnectors);
    this.refreshAfterEditScanModeModalClosed(modalRef);
  }

  /**
   * Refresh the scan mode list when the scan mode is edited
   */
  private refreshAfterEditScanModeModalClosed(modalRef: Modal<any>) {
    modalRef.result.subscribe((southConnector: SouthConnectorDTO) => {
      this.northConnectorService.getNorthConnectorSubscriptions(this.northConnector!.id).subscribe(subscriptions => {
        this.northSubscriptions = subscriptions;
      });
      this.notificationService.success(`north.subscriptions.created`, {
        south: southConnector.name
      });
    });
  }

  /**
   * Delete a scan mode by its ID
   */
  deleteScanMode(southConnectorId: string) {
    const southConnector = this.southConnectors.find(south => south.id === southConnectorId);
    if (!southConnector) return;
    this.confirmationService
      .confirm({
        messageKey: 'north.subscriptions.confirm-deletion',
        interpolateParams: { name: southConnector.name }
      })
      .pipe(
        switchMap(() => {
          return this.northConnectorService.deleteNorthConnectorSubscription(this.northConnector!.id, southConnector.id);
        })
      )
      .subscribe(() => {
        this.northConnectorService.getNorthConnectorSubscriptions(this.northConnector!.id).subscribe(subscriptions => {
          this.northSubscriptions = subscriptions;
        });
        this.notificationService.success('north.subscriptions.deleted', {
          name: southConnector.name
        });
      });
  }

  getSouthName(northSubscription: SubscriptionDTO): string {
    const southConnector = this.southConnectors.find(south => south.id === northSubscription);
    return southConnector?.name || '';
  }
}
