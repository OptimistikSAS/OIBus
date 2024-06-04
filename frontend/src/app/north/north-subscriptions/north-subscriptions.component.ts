import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import { combineLatest, of, switchMap, tap } from 'rxjs';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { OIBusSubscription, SubscriptionDTO } from '../../../../../shared/model/subscription.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { CreateNorthSubscriptionModalComponent } from '../create-north-subscription-modal/create-north-subscription-modal.component';
import { Modal, ModalService } from '../../shared/modal.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';

@Component({
  selector: 'oib-north-subscriptions',
  standalone: true,
  imports: [TranslateModule, BoxComponent, BoxTitleDirective, OibHelpComponent],
  templateUrl: './north-subscriptions.component.html',
  styleUrl: './north-subscriptions.component.scss'
})
export class NorthSubscriptionsComponent implements OnInit {
  @Input() northConnector: NorthConnectorDTO | null = null;
  @Input() inMemory = false;

  @Output() readonly inMemorySubscriptions = new EventEmitter<{
    subscriptions: Array<OIBusSubscription>;
    subscriptionsToDelete: Array<OIBusSubscription>;
  }>();

  subscriptions: Array<OIBusSubscription> = [];
  subscriptionsToDelete: Array<OIBusSubscription> = [];

  southConnectors: Array<SouthConnectorDTO> = [];

  constructor(
    private confirmationService: ConfirmationService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private northConnectorService: NorthConnectorService,
    private southConnectorService: SouthConnectorService
  ) {}

  ngOnInit() {
    this.fetchSubscriptionsAndResetPage(false);
  }

  fetchSubscriptionsAndResetPage(fromMemory: boolean) {
    if (this.northConnector && !fromMemory) {
      combineLatest([this.northConnectorService.getSubscriptions(this.northConnector.id), this.southConnectorService.list()]).subscribe(
        ([subscriptions, southConnectors]) => {
          this.southConnectors = southConnectors;
          this.createSubscriptionList(subscriptions);
          this.inMemorySubscriptions.emit({ subscriptions: this.subscriptions, subscriptionsToDelete: this.subscriptionsToDelete });
        }
      );
    } else {
      this.southConnectorService.list().subscribe(southConnectors => {
        this.southConnectors = southConnectors;
      });
      this.inMemorySubscriptions.emit({ subscriptions: this.subscriptions, subscriptionsToDelete: this.subscriptionsToDelete });
    }
  }

  /**
   * Open a modal to create a scan mode
   */
  addSubscription(e: Event) {
    e.preventDefault();
    const modalRef = this.modalService.open(CreateNorthSubscriptionModalComponent);
    const component: CreateNorthSubscriptionModalComponent = modalRef.componentInstance;

    component.prepareForCreation(
      this.southConnectors.filter(south => !this.subscriptions.some(subscription => subscription.subscription?.id === south.id))
    );
    this.refreshAfterAddSubscriptionModalClosed(modalRef);
  }

  /**
   * Refresh the scan mode list when the scan mode is edited
   */
  private refreshAfterAddSubscriptionModalClosed(modalRef: Modal<CreateNorthSubscriptionModalComponent>) {
    modalRef.result
      .pipe(
        switchMap((subscription: OIBusSubscription) => {
          if (!this.inMemory) {
            return this.northConnectorService
              .createSubscription(this.northConnector!.id, subscription.subscription!.id)
              .pipe(
                tap(() =>
                  this.notificationService.success(`north.subscriptions.south.created`, {
                    name: subscription.subscription!.name
                  })
                )
              )
              .pipe(
                switchMap(() => this.northConnectorService.getSubscriptions(this.northConnector!.id)),
                switchMap(subscriptions => {
                  this.createSubscriptionList(subscriptions);
                  return of(null);
                })
              );
          } else {
            this.subscriptions.push(subscription);
            return of(null);
          }
        })
      )
      .subscribe(() => {
        this.fetchSubscriptionsAndResetPage(this.inMemory);
      });
  }

  /**
   * Remove a subscription from the connector
   */
  deleteSubscription(subscription: OIBusSubscription) {
    this.confirmationService
      .confirm({
        messageKey: `north.subscriptions.${subscription.type}.confirm-deletion`,
        interpolateParams: {
          name: subscription.subscription.name
        }
      })
      .pipe(
        switchMap(() => {
          if (!this.inMemory) {
            return this.northConnectorService.deleteSubscription(this.northConnector!.id, subscription.subscription!.id);
          } else {
            this.subscriptionsToDelete.push(subscription);
            return of(null);
          }
        })
      )
      .subscribe(() => {
        this.subscriptions = this.subscriptions.filter(element => element.subscription.id !== subscription.subscription.id);

        if (!this.inMemory) {
          this.notificationService.success(`north.subscriptions.${subscription.type}.deleted`, {
            name: subscription.subscription.name
          });
        } else {
          this.fetchSubscriptionsAndResetPage(true);
        }
      });
  }

  private createSubscriptionList(subscriptions: Array<SubscriptionDTO>) {
    this.subscriptions = [];
    subscriptions.forEach(subscription => {
      const southConnector = this.southConnectors.find(south => south.id === subscription);
      if (southConnector) {
        this.subscriptions.push({ type: 'south', subscription: southConnector });
      }
    });
  }
}
