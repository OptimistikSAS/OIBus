import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { switchMap } from 'rxjs';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { ModalService } from '../shared/modal.service';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../services/north-connector.service';
import { CreateNorthConnectorModalComponent } from './create-north-connector-modal/create-north-connector-modal.component';
import { RouterLink } from '@angular/router';
import { NgForOf, NgIf } from '@angular/common';

@Component({
  selector: 'oib-north-list',
  standalone: true,
  imports: [TranslateModule, RouterLink, NgIf, NgForOf],
  templateUrl: './north-list.component.html',
  styleUrls: ['./north-list.component.scss']
})
export class NorthListComponent implements OnInit {
  northList: Array<NorthConnectorDTO> = [];

  constructor(
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService,
    private modalService: ModalService,
    private northConnectorService: NorthConnectorService
  ) {}

  ngOnInit() {
    this.northConnectorService.getNorthConnectors().subscribe(connectors => {
      this.northList = connectors;
    });
  }

  /**
   * Delete a North connector by its ID
   */
  deleteNorth(north: NorthConnectorDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'north.confirm-deletion',
        interpolateParams: { name: north.name }
      })
      .pipe(
        switchMap(() => {
          return this.northConnectorService.deleteNorthConnector(north.id);
        })
      )
      .subscribe(() => {
        this.northConnectorService.getNorthConnectors().subscribe(northList => {
          this.northList = northList;
        });
        this.notificationService.success('north.deleted', {
          name: north.name
        });
      });
  }

  /**
   * Open a modal to create a North connector
   */
  openCreationNorthModal() {
    const modalRef = this.modalService.open(CreateNorthConnectorModalComponent);
    modalRef.result.subscribe();
  }
}
