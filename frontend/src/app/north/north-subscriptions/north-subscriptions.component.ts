import { Component, Input, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { combineLatest, switchMap, tap } from 'rxjs';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { ExternalSubscriptionDTO, SubscriptionDTO } from '../../../../../shared/model/subscription.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { CreateNorthSubscriptionModalComponent } from '../create-north-subscription-modal/create-north-subscription-modal.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ExternalSourceService } from '../../services/external-source.service';
import { ExternalSourceDTO } from '../../../../../shared/model/external-sources.model';

interface Subscription {
  type: 'south' | 'external-source';
  externalSubscription?: ExternalSourceDTO;
  subscription?: SouthConnectorDTO;
}

@Component({
  selector: 'oib-north-subscriptions',
  standalone: true,
  imports: [NgIf, NgForOf, TranslateModule, BoxComponent, BoxTitleDirective],
  templateUrl: './north-subscriptions.component.html',
  styleUrls: ['./north-subscriptions.component.scss']
})
export class NorthSubscriptionsComponent implements OnInit {
  @Input() northConnector: NorthConnectorDTO | null = null;

  subscriptions: Array<Subscription> = [];
  southConnectors: Array<SouthConnectorDTO> = [];
  externalSources: Array<ExternalSourceDTO> = [];

  constructor(
    private confirmationService: ConfirmationService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private northConnectorService: NorthConnectorService,
    private externalSourceService: ExternalSourceService,
    private southConnectorService: SouthConnectorService
  ) {}

  ngOnInit() {
    combineLatest([
      this.northConnectorService.getNorthConnectorSubscriptions(this.northConnector!.id),
      this.northConnectorService.getNorthConnectorExternalSubscriptions(this.northConnector!.id),
      this.southConnectorService.list(),
      this.externalSourceService.list()
    ]).subscribe(([subscriptions, externalSubscriptions, southConnectors, externalSources]) => {
      this.southConnectors = southConnectors;
      this.externalSources = externalSources;
      this.createSubscriptionList(subscriptions, externalSubscriptions);
    });
  }

  /**
   * Open a modal to create a scan mode
   */
  addSubscription() {
    const modalRef = this.modalService.open(CreateNorthSubscriptionModalComponent);
    const component: CreateNorthSubscriptionModalComponent = modalRef.componentInstance;

    component.prepareForCreation(
      this.northConnector!.id,
      this.southConnectors.filter(south => !this.subscriptions.some(subscription => subscription.subscription?.id === south.id)),
      this.externalSources.filter(
        externalSource => !this.subscriptions.some(subscription => subscription.externalSubscription?.id === externalSource.id)
      )
    );
    this.refreshAfterEditScanModeModalClosed(modalRef);
  }

  /**
   * Refresh the scan mode list when the scan mode is edited
   */
  private refreshAfterEditScanModeModalClosed(modalRef: Modal<CreateNorthSubscriptionModalComponent>) {
    modalRef.result
      .pipe(
        switchMap(() =>
          combineLatest([
            this.northConnectorService.getNorthConnectorSubscriptions(this.northConnector!.id),
            this.northConnectorService.getNorthConnectorExternalSubscriptions(this.northConnector!.id)
          ])
        )
      )
      .subscribe(([subscriptions, externalSubscriptions]) => {
        this.createSubscriptionList(subscriptions, externalSubscriptions);
      });
  }

  /**
   * Remove a subscription from the connector
   */
  deleteSubscription(subscription: Subscription) {
    this.confirmationService
      .confirm({
        messageKey: `north.subscriptions.${subscription.type}.confirm-deletion`,
        interpolateParams: {
          name: subscription.type === 'south' ? subscription.subscription!.name : subscription.externalSubscription!.reference
        }
      })
      .pipe(
        switchMap(() => {
          if (subscription.type === 'south') {
            return this.northConnectorService.deleteNorthConnectorSubscription(this.northConnector!.id, subscription.subscription!.id);
          }
          return this.northConnectorService.deleteNorthConnectorExternalSubscription(
            this.northConnector!.id,
            subscription.externalSubscription!.id
          );
        }),
        tap(() =>
          this.notificationService.success(`north.subscriptions.${subscription.type}.deleted`, {
            name: subscription.type === 'south' ? subscription.subscription!.name : subscription.externalSubscription!.reference
          })
        ),
        switchMap(() =>
          combineLatest([
            this.northConnectorService.getNorthConnectorSubscriptions(this.northConnector!.id),
            this.northConnectorService.getNorthConnectorExternalSubscriptions(this.northConnector!.id)
          ])
        )
      )
      .subscribe(([subscriptions, externalSubscriptions]) => {
        this.createSubscriptionList(subscriptions, externalSubscriptions);
      });
  }

  private createSubscriptionList(subscriptions: Array<SubscriptionDTO>, externalSubscriptions: Array<ExternalSubscriptionDTO>) {
    this.subscriptions = [];
    subscriptions.forEach(subscription => {
      const southConnector = this.southConnectors.find(south => south.id === subscription);
      if (southConnector) {
        this.subscriptions.push({ type: 'south', subscription: southConnector });
      }
    });
    externalSubscriptions.forEach(subscription => {
      const foundExternalSource = this.externalSources.find(externalSource => externalSource.id === subscription);
      if (foundExternalSource) {
        this.subscriptions.push({ type: 'external-source', externalSubscription: foundExternalSource });
      }
    });
  }
}
