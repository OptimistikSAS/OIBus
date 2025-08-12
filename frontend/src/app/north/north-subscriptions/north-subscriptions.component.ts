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

@Component({
  selector: 'oib-north-subscriptions',
  imports: [TranslateDirective, BoxComponent, BoxTitleDirective, OibHelpComponent, NgbTooltip, TranslateModule],
  templateUrl: './north-subscriptions.component.html',
  styleUrl: './north-subscriptions.component.scss'
})
export class NorthSubscriptionsComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private northConnectorService = inject(NorthConnectorService);
  private southConnectorService = inject(SouthConnectorService);

  // TODO: Skipped for migration because:
  //  This input is used in a control flow expression (e.g. `@if` or `*ngIf`)
  //  and migrating would break narrowing currently.
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
          if (northConnector && this.saveChangesDirectly()) {
            return this.northConnectorService.createSubscription(northConnector.id, southConnector.id);
          }
          this.subscriptions = [...this.subscriptions, southConnector];
          return of(null);
        })
      )
      .subscribe(() => {
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
          if (northConnector && this.saveChangesDirectly()) {
            return this.northConnectorService.deleteSubscription(northConnector!.id, subscription!.id);
          }
          this.subscriptions = this.subscriptions.filter(element => element.id !== subscription.id);
          return of(null);
        })
      )
      .subscribe(() => {
        this.inMemorySubscriptions.emit(this.subscriptions);
      });
  }
}
