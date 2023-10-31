import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { combineLatest, Observable, of, switchMap, tap } from 'rxjs';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { ExternalSubscriptionDTO, OIBusSubscription, SubscriptionDTO } from '../../../../../shared/model/subscription.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ExternalSourceService } from '../../services/external-source.service';
import { ExternalSourceDTO } from '../../../../../shared/model/external-sources.model';
import { CreateNorthSubscriptionModalComponent } from '../create-north-subscription-modal/create-north-subscription-modal.component';
import { Modal, ModalService } from '../../shared/modal.service';

@Component({
  selector: 'oib-north-subscriptions',
  standalone: true,
  imports: [NgIf, NgForOf, TranslateModule, BoxComponent, BoxTitleDirective],
  templateUrl: './north-subscriptions.component.html',
  styleUrls: ['./north-subscriptions.component.scss']
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
    this.fetchSubscriptionsAndResetPage(false);
  }

  fetchSubscriptionsAndResetPage(fromMemory: boolean) {
    if (this.northConnector && !fromMemory) {
      combineLatest([
        this.northConnectorService.getSubscriptions(this.northConnector.id),
        this.northConnectorService.getExternalSubscriptions(this.northConnector.id),
        this.southConnectorService.list(),
        this.externalSourceService.list()
      ]).subscribe(([subscriptions, externalSubscriptions, southConnectors, externalSources]) => {
        this.southConnectors = southConnectors;
        this.externalSources = externalSources;
        this.createSubscriptionList(subscriptions, externalSubscriptions);
        this.inMemorySubscriptions.emit({ subscriptions: this.subscriptions, subscriptionsToDelete: this.subscriptionsToDelete });
      });
    } else {
      combineLatest([this.southConnectorService.list(), this.externalSourceService.list()]).subscribe(
        ([southConnectors, externalSources]) => {
          this.southConnectors = southConnectors;
          this.externalSources = externalSources;
        }
      );
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
      this.southConnectors.filter(south => !this.subscriptions.some(subscription => subscription.subscription?.id === south.id)),
      this.externalSources.filter(
        externalSource => !this.subscriptions.some(subscription => subscription.externalSubscription?.id === externalSource.id)
      )
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
            let obs: Observable<void>;
            if (subscription.type === 'south') {
              obs = this.northConnectorService.createSubscription(this.northConnector!.id, subscription.subscription!.id).pipe(
                tap(() =>
                  this.notificationService.success(`north.subscriptions.south.created`, {
                    name: subscription.subscription!.name
                  })
                )
              );
            } else {
              obs = this.northConnectorService
                .createExternalSubscription(this.northConnector!.id, subscription.externalSubscription!.id)
                .pipe(
                  tap(() =>
                    this.notificationService.success(`north.subscriptions.external-source.created`, {
                      name: subscription.externalSubscription!.reference
                    })
                  )
                );
            }
            return obs.pipe(
              switchMap(() =>
                combineLatest([
                  this.northConnectorService.getSubscriptions(this.northConnector!.id),
                  this.northConnectorService.getExternalSubscriptions(this.northConnector!.id)
                ])
              ),
              switchMap(([subscriptions, externalSubscriptions]) => {
                this.createSubscriptionList(subscriptions, externalSubscriptions);
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
          name: subscription.type === 'south' ? subscription.subscription!.name : subscription.externalSubscription!.reference
        }
      })
      .pipe(
        switchMap(() => {
          if (!this.inMemory) {
            if (subscription.type === 'south') {
              return this.northConnectorService.deleteSubscription(this.northConnector!.id, subscription.subscription!.id);
            }
            return this.northConnectorService.deleteExternalSubscription(this.northConnector!.id, subscription.externalSubscription!.id);
          } else {
            this.subscriptionsToDelete.push(subscription);
            return of(null);
          }
        })
      )
      .subscribe(() => {
        this.subscriptions = this.subscriptions.filter(
          element =>
            element.type !== subscription.type ||
            (element.type === subscription.type &&
              ((subscription.type === 'south' && element.subscription?.id !== subscription.subscription?.id) ||
                (subscription.type === 'external-source' && element.externalSubscription?.id !== subscription.externalSubscription?.id)))
        );
        if (!this.inMemory) {
          this.notificationService.success(`north.subscriptions.${subscription.type}.deleted`, {
            name: subscription.type === 'south' ? subscription.subscription!.name : subscription.externalSubscription!.reference
          });
        } else {
          this.fetchSubscriptionsAndResetPage(true);
        }
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
