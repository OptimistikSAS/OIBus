import { Component, OnInit, inject, output, input, effect } from '@angular/core';

import { of, switchMap } from 'rxjs';
import { ConfirmationService } from '../../shared/confirmation.service';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
import { SouthConnectorLightDTO } from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { CreateNorthSubscriptionModalComponent } from './create-north-subscription-modal/create-north-subscription-modal.component';
import { Modal, ModalService } from '../../shared/modal.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { NotificationService } from '../../shared/notification.service';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';

@Component({
  selector: 'oib-north-subscriptions',
  imports: [TranslateDirective, BoxComponent, BoxTitleDirective, OibHelpComponent, NgbTooltip, TranslateModule, OIBusSouthTypeEnumPipe],
  templateUrl: './north-subscriptions.component.html',
  styleUrl: './north-subscriptions.component.scss'
})
export class NorthSubscriptionsComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private northConnectorService = inject(NorthConnectorService);
  private southConnectorService = inject(SouthConnectorService);

  readonly northConnector = input<NorthConnectorDTO<NorthSettings> | null>(null);

  readonly inMemorySubscriptions = output<Array<SouthConnectorLightDTO> | null>();
  readonly saveChangesDirectly = input<boolean>(false);

  subscriptions: Array<SouthConnectorLightDTO> = []; // Array used to store subscription on north connector creation
  southConnectors: Array<SouthConnectorLightDTO> = [];

  constructor() {
    // Initialize local subscriptions when editing, and keep them in sync with input
    effect(() => {
      const connector = this.northConnector();
      if (connector) {
        this.subscriptions = [...connector.subscriptions];
      }
    });
  }

  ngOnInit() {
    this.southConnectorService.list().subscribe(southConnectors => {
      this.southConnectors = southConnectors;
    });
  }

  addSubscription(e: Event) {
    e.preventDefault();
    const modalRef = this.modalService.open(CreateNorthSubscriptionModalComponent, { backdrop: 'static' });
    const component: CreateNorthSubscriptionModalComponent = modalRef.componentInstance;

    component.prepareForCreation(
      this.southConnectors.filter(south => !this.subscriptions.some(subscription => subscription.id === south.id))
    );

    this.refreshAfterAddSubscriptionModalClosed(modalRef);
  }

  /**
   * Refresh the subscription list when the subscription is edited
   */
  private refreshAfterAddSubscriptionModalClosed(modalRef: Modal<CreateNorthSubscriptionModalComponent>) {
    modalRef.result
      .pipe(
        switchMap((southConnector: SouthConnectorLightDTO) => {
          const northConnector = this.northConnector();
          if (northConnector && this.saveChangesDirectly()) {
            return this.northConnectorService
              .createSubscription(northConnector.id, southConnector.id)
              .pipe(switchMap(() => of(southConnector)));
          }
          this.subscriptions = [...this.subscriptions, southConnector];
          return of(southConnector);
        })
      )
      .subscribe((southConnector: SouthConnectorLightDTO) => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('north.subscriptions.added', { name: southConnector.name });
        }
        this.inMemorySubscriptions.emit(this.subscriptions);
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
          if (this.saveChangesDirectly()) {
            return this.northConnectorService.deleteSubscription(northConnector!.id, subscription!.id);
          }
          this.subscriptions = this.subscriptions.filter(element => element.id !== subscription.id);
          return of(null);
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('north.subscriptions.deleted', { name: subscription.name });
        }
        this.inMemorySubscriptions.emit(this.subscriptions);
      });
  }
}
