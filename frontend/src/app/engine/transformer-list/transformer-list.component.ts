import { Component, inject, OnInit } from '@angular/core';

import { firstValueFrom, switchMap, tap } from 'rxjs';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TransformerService } from '../../services/transformer.service';
import { CustomTransformerDTO } from '../../../../../backend/shared/model/transformer.model';
import { EditTransformerModalComponent } from './edit-transformer-modal/edit-transformer-modal.component';

@Component({
  selector: 'oib-transformer-list',
  imports: [TranslateDirective, BoxComponent, BoxTitleDirective, OibHelpComponent, NgbTooltip, TranslateModule],
  templateUrl: './transformer-list.component.html',
  styleUrl: './transformer-list.component.scss'
})
export class TransformerListComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private notificationService = inject(NotificationService);
  private transformerService = inject(TransformerService);

  transformers: Array<CustomTransformerDTO> = [];

  ngOnInit() {
    this.transformerService.list().subscribe(transformers => {
      this.transformers = transformers.filter(element => element.type === 'custom');
    });
  }

  editTransformer(transformer: CustomTransformerDTO) {
    const modalRef = this.modalService.open(EditTransformerModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditTransformerModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditTransformerModalComponent = modalRef.componentInstance;
    component.prepareForEdition(transformer);
    this.refreshAfterEditTransformerModalClosed(modalRef, 'updated');
  }

  addTransformer() {
    const modalRef = this.modalService.open(EditTransformerModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditTransformerModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditTransformerModalComponent = modalRef.componentInstance;
    component.prepareForCreation();
    this.refreshAfterEditTransformerModalClosed(modalRef, 'created');
  }

  private refreshAfterEditTransformerModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result
      .pipe(
        tap(transformer =>
          this.notificationService.success(`configuration.oibus.manifest.transformers.${mode}`, {
            name: transformer.name
          })
        ),
        switchMap(() => this.transformerService.list())
      )
      .subscribe(transformers => {
        this.transformers = transformers.filter(element => element.type === 'custom');
      });
  }

  deleteTransformer(transformer: CustomTransformerDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'configuration.oibus.manifest.transformers.confirm-deletion',
        interpolateParams: { name: transformer.name }
      })
      .pipe(
        switchMap(() => {
          return this.transformerService.delete(transformer.id);
        })
      )
      .subscribe(() => {
        this.transformerService.list().subscribe(transformers => {
          this.transformers = transformers.filter(element => element.type === 'custom');
        });
        this.notificationService.success('configuration.oibus.manifest.transformers.deleted', {
          name: transformer.name
        });
      });
  }
}
