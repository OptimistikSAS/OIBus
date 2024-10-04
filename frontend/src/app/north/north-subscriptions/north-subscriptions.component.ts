import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';

import { combineLatest, of, switchMap, tap } from 'rxjs';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { SubscriptionDTO } from '../../../../../shared/model/subscription.model';
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
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private notificationService = inject(NotificationService);
  private northConnectorService = inject(NorthConnectorService);
  private southConnectorService = inject(SouthConnectorService);

  @Input() northConnector: NorthConnectorDTO | null = null;
  @Input() inMemory = false;

  @Output() readonly inMemorySubscriptions = new EventEmitter<{
    subscriptions: Array<SubscriptionDTO>;
    subscriptionsToDelete: Array<SubscriptionDTO>;
  }>();

  subscriptions: Array<SubscriptionDTO> = [];
  subscriptionsToDelete: Array<SubscriptionDTO> = [];

  southConnectors: Array<SouthConnectorDTO> = [];

  ngOnInit() {
    this.fetchSubscriptionsAndResetPage(false);
  }

  fetchSubscriptionsAndResetPage(fromMemory: boolean) {
    if (this.northConnector && !fromMemory) {
      combineLatest([this.northConnectorService.getSubscriptions(this.northConnector.id), this.southConnectorService.list()]).subscribe(
        ([subscriptions, southConnectors]) => {
          this.southConnectors = southConnectors;
          this.subscriptions = subscriptions;
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
      this.southConnectors.filter(south => !this.subscriptions.some(subscription => subscription.southId === south.id))
    );
    this.refreshAfterAddSubscriptionModalClosed(modalRef);
  }

  /**
   * Refresh the scan mode list when the scan mode is edited
   */
  private refreshAfterAddSubscriptionModalClosed(modalRef: Modal<CreateNorthSubscriptionModalComponent>) {
    modalRef.result
      .pipe(
        switchMap((southConnector: SouthConnectorDTO) => {
          if (!this.inMemory) {
            return this.northConnectorService
              .createSubscription(this.northConnector!.id, southConnector.id)
              .pipe(
                tap(() =>
                  this.notificationService.success(`north.subscriptions.created`, {
                    name: southConnector.name
                  })
                )
              )
              .pipe(
                switchMap(() => this.northConnectorService.getSubscriptions(this.northConnector!.id)),
                switchMap(subscriptions => {
                  this.subscriptions = subscriptions;
                  return of(null);
                })
              );
          } else {
            this.subscriptions.push({ southId: southConnector.id, southType: southConnector.type, southName: southConnector.name });
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
  deleteSubscription(subscription: SubscriptionDTO) {
    this.confirmationService
      .confirm({
        messageKey: `north.subscriptions.confirm-deletion`,
        interpolateParams: {
          name: subscription.southName
        }
      })
      .pipe(
        switchMap(() => {
          if (!this.inMemory) {
            return this.northConnectorService.deleteSubscription(this.northConnector!.id, subscription!.southId);
          } else {
            this.subscriptionsToDelete.push(subscription);
            return of(null);
          }
        })
      )
      .subscribe(() => {
        this.subscriptions = this.subscriptions.filter(element => element.southId !== subscription.southId);

        if (!this.inMemory) {
          this.notificationService.success(`north.subscriptions.deleted`, {
            name: subscription.southName
          });
        } else {
          this.fetchSubscriptionsAndResetPage(true);
        }
      });
  }
}
