import { Component, OnInit, inject, output, input } from '@angular/core';

import { of, switchMap, tap } from 'rxjs';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateDirective } from '@ngx-translate/core';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
import { SouthConnectorLightDTO } from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { CreateNorthSubscriptionModalComponent } from '../create-north-subscription-modal/create-north-subscription-modal.component';
import { Modal, ModalService } from '../../shared/modal.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';

@Component({
  selector: 'oib-north-subscriptions',
  imports: [TranslateDirective, BoxComponent, BoxTitleDirective, OibHelpComponent],
  templateUrl: './north-subscriptions.component.html',
  styleUrl: './north-subscriptions.component.scss'
})
export class NorthSubscriptionsComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private notificationService = inject(NotificationService);
  private northConnectorService = inject(NorthConnectorService);
  private southConnectorService = inject(SouthConnectorService);

  // TODO: Skipped for migration because:
  //  This input is used in a control flow expression (e.g. `@if` or `*ngIf`)
  //  and migrating would break narrowing currently.
  readonly northConnector = input<NorthConnectorDTO<NorthSettings> | null>(null);

  readonly inMemorySubscriptions = output<Array<SouthConnectorLightDTO> | null>();

  subscriptions: Array<SouthConnectorLightDTO> = []; // Array used to store subscription on north connector creation
  southConnectors: Array<SouthConnectorLightDTO> = [];

  ngOnInit() {
    this.southConnectorService.list().subscribe(southConnectors => {
      this.southConnectors = southConnectors;
    });
  }

  addSubscription(e: Event) {
    e.preventDefault();
    const modalRef = this.modalService.open(CreateNorthSubscriptionModalComponent, { backdrop: 'static' });
    const component: CreateNorthSubscriptionModalComponent = modalRef.componentInstance;

    if (this.northConnector()) {
      component.prepareForCreation(
        this.southConnectors.filter(south => !this.northConnector()!.subscriptions.some(subscription => subscription.id === south.id))
      );
    } else {
      component.prepareForCreation(
        this.southConnectors.filter(south => !this.subscriptions.some(subscription => subscription.id === south.id))
      );
    }

    this.refreshAfterAddSubscriptionModalClosed(modalRef);
  }

  /**
   * Refresh the subscription list when the scan mode is edited
   */
  private refreshAfterAddSubscriptionModalClosed(modalRef: Modal<CreateNorthSubscriptionModalComponent>) {
    modalRef.result
      .pipe(
        switchMap((southConnector: SouthConnectorLightDTO) => {
          const northConnector = this.northConnector();
          if (northConnector) {
            return this.northConnectorService.createSubscription(northConnector.id, southConnector.id).pipe(
              tap(() =>
                this.notificationService.success(`north.subscriptions.created`, {
                  name: southConnector.name
                })
              )
            );
          } else {
            this.subscriptions.push(southConnector);
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.northConnector()) {
          this.inMemorySubscriptions.emit(null);
        } else {
          this.inMemorySubscriptions.emit(this.subscriptions);
        }
      });
  }

  deleteSubscription(subscription: SouthConnectorLightDTO) {
    this.confirmationService
      .confirm({
        messageKey: `north.subscriptions.confirm-deletion`,
        interpolateParams: {
          name: subscription.name
        }
      })
      .pipe(
        switchMap(() => {
          const northConnector = this.northConnector();
          if (northConnector) {
            return this.northConnectorService.deleteSubscription(northConnector!.id, subscription!.id);
          } else {
            this.subscriptions = this.subscriptions.filter(element => element.id !== subscription.id);
            return of(null);
          }
        })
      )
      .subscribe(() => {
        if (this.northConnector()) {
          this.notificationService.success(`north.subscriptions.deleted`, {
            name: subscription.name
          });
          this.inMemorySubscriptions.emit(null);
        } else {
          this.inMemorySubscriptions.emit(this.subscriptions);
        }
      });
  }
}
