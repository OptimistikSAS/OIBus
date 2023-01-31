import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { switchMap } from 'rxjs';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { ExternalSourceDTO } from '../../../../../shared/model/external-sources.model';
import { ExternalSourceService } from '../../services/external-source.service';
import { EditExternalSourceModalComponent } from '../edit-external-source-modal/edit-external-source-modal.component';

@Component({
  selector: 'oib-external-source-list',
  standalone: true,
  imports: [NgIf, NgForOf, TranslateModule],
  templateUrl: './external-source-list.component.html',
  styleUrls: ['./external-source-list.component.scss']
})
export class ExternalSourceListComponent implements OnInit {
  externalSources: Array<ExternalSourceDTO> = [];

  constructor(
    private confirmationService: ConfirmationService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private externalSourceService: ExternalSourceService
  ) {}

  ngOnInit() {
    this.externalSourceService.getExternalSources().subscribe(externalSources => {
      this.externalSources = externalSources;
    });
  }

  /**
   * Open a modal to edit an external source
   */
  openEditExternalSourceModal(externalSource: ExternalSourceDTO) {
    const modalRef = this.modalService.open(EditExternalSourceModalComponent);
    const component: EditExternalSourceModalComponent = modalRef.componentInstance;
    component.prepareForEdition(externalSource);
    this.refreshAfterEditExternalSourceModalClosed(modalRef, 'updated');
  }

  /**
   * Open a modal to create an external source
   */
  openCreationExternalSourceModal() {
    const modalRef = this.modalService.open(EditExternalSourceModalComponent);
    const component: EditExternalSourceModalComponent = modalRef.componentInstance;
    component.prepareForCreation();
    this.refreshAfterEditExternalSourceModalClosed(modalRef, 'created');
  }

  /**
   * Refresh the IP filter list when the external source is edited
   */
  private refreshAfterEditExternalSourceModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result.subscribe((ipFilter: ExternalSourceDTO) => {
      this.externalSourceService.getExternalSources().subscribe(externalSources => {
        this.externalSources = externalSources;
      });
      this.notificationService.success(`engine.external-source.${mode}`, {
        reference: ipFilter.reference
      });
    });
  }

  /**
   * Delete an IP Filter by its ID
   */
  deleteExternalSource(externalSource: ExternalSourceDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'engine.external-source.confirm-deletion',
        interpolateParams: { reference: externalSource.reference }
      })
      .pipe(
        switchMap(() => {
          return this.externalSourceService.deleteExternalSource(externalSource.id);
        })
      )
      .subscribe(() => {
        this.externalSourceService.getExternalSources().subscribe(externalSources => {
          this.externalSources = externalSources;
        });
        this.notificationService.success('engine.external-source.deleted', {
          address: externalSource.reference
        });
      });
  }
}
