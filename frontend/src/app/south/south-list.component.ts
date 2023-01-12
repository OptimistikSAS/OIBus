import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorDTO } from '../model/south-connector.model';
import { SouthConnectorService } from '../services/south-connector.service';
import { switchMap } from 'rxjs';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { NgForOf, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ModalService } from '../shared/modal.service';
import { CreateSouthConnectorModalComponent } from './create-south-connector-modal/create-south-connector-modal.component';

@Component({
  selector: 'oib-south-list',
  standalone: true,
  imports: [TranslateModule, RouterLink, NgIf, NgForOf],
  templateUrl: './south-list.component.html',
  styleUrls: ['./south-list.component.scss']
})
export class SouthListComponent implements OnInit {
  southList: Array<SouthConnectorDTO> = [];

  constructor(
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService,
    private modalService: ModalService,
    private southConnectorService: SouthConnectorService
  ) {}

  ngOnInit() {
    this.southConnectorService.getSouthConnectors().subscribe(connectors => {
      this.southList = connectors;
    });
  }

  /**
   * Delete a South connector by its ID
   */
  deleteSouth(south: SouthConnectorDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'south.confirm-deletion',
        interpolateParams: { name: south.name }
      })
      .pipe(
        switchMap(() => {
          return this.southConnectorService.deleteSouthConnector(south.id);
        })
      )
      .subscribe(() => {
        this.southConnectorService.getSouthConnectors().subscribe(southList => {
          this.southList = southList;
        });
        this.notificationService.success('south.deleted', {
          name: south.name
        });
      });
  }

  /**
   * Open a modal to create a South connector
   */
  openCreationSouthModal() {
    const modalRef = this.modalService.open(CreateSouthConnectorModalComponent);
    modalRef.result.subscribe();
  }
}
