import { Component, effect, inject, input, output } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../backend/shared/model/transformer.model';
import { ReactiveFormsModule } from '@angular/forms';
import { Modal, ModalService } from '../../shared/modal.service';
import { EditHistoryQueryTransformerModalComponent } from './edit-history-query-transformer-modal/edit-history-query-transformer-modal.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { OIBUS_DATA_TYPES } from '../../../../../backend/shared/model/engine.model';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { firstValueFrom, of, switchMap } from 'rxjs';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { HistoryQueryService } from '../../services/history-query.service';

@Component({
  selector: 'oib-history-query-transformers',
  imports: [TranslateDirective, BoxComponent, ReactiveFormsModule, TranslatePipe, BoxTitleDirective, OibHelpComponent],
  templateUrl: './history-query-transformers.component.html',
  styleUrl: './history-query-transformers.component.scss'
})
export class HistoryQueryTransformersComponent {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private historyQueryService = inject(HistoryQueryService);

  readonly historyQuery = input<HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null>(null);

  readonly inMemoryTransformersWithOptions = output<Array<TransformerDTOWithOptions> | null>();
  readonly saveChangesDirectly = input<boolean>(false);

  readonly northManifest = input.required<NorthConnectorManifest>();
  readonly certificates = input.required<Array<CertificateDTO>>();
  readonly scanModes = input.required<Array<ScanModeDTO>>();
  readonly transformers = input.required<Array<TransformerDTO>>();

  transformersWithOptions: Array<TransformerDTOWithOptions> = []; // Array used to store subscription on north connector creation

  constructor() {
    // Initialize local transformers when editing, and keep them in sync with input
    effect(() => {
      const historyQuery = this.historyQuery();
      if (historyQuery) {
        this.transformersWithOptions = [...historyQuery.northTransformers];
      }
    });
  }

  addTransformer(e: Event) {
    e.preventDefault();
    const modalRef = this.modalService.open(EditHistoryQueryTransformerModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditHistoryQueryTransformerModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditHistoryQueryTransformerModalComponent = modalRef.componentInstance;

    component.prepareForCreation(
      this.scanModes(),
      this.certificates(),
      OIBUS_DATA_TYPES.filter(dataType => !this.transformersWithOptions.map(element => element.inputType).includes(dataType)),
      this.transformers(),
      this.northManifest().types
    );
    this.refreshAfterAddModalClosed(modalRef);
  }

  private refreshAfterAddModalClosed(modalRef: Modal<EditHistoryQueryTransformerModalComponent>) {
    modalRef.result
      .pipe(
        switchMap((transformer: TransformerDTOWithOptions) => {
          const northConnector = this.historyQuery();
          if (northConnector && this.saveChangesDirectly()) {
            return this.historyQueryService.addOrEditTransformer(northConnector.id, transformer).pipe(switchMap(() => of(transformer)));
          }
          this.transformersWithOptions = [...this.transformersWithOptions, transformer];
          return of(transformer);
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('history-query.transformers.added');
        }
        this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions);
      });
  }

  editTransformer(transformer: TransformerDTOWithOptions) {
    const modalRef = this.modalService.open(EditHistoryQueryTransformerModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditHistoryQueryTransformerModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditHistoryQueryTransformerModalComponent = modalRef.componentInstance;

    component.prepareForEdition(this.scanModes(), this.certificates(), transformer, this.transformers(), this.northManifest().types);
    this.refreshAfterEditModalClosed(modalRef, transformer);
  }

  private refreshAfterEditModalClosed(
    modalRef: Modal<EditHistoryQueryTransformerModalComponent>,
    oldTransformer: TransformerDTOWithOptions
  ) {
    modalRef.result
      .pipe(
        switchMap((transformer: TransformerDTOWithOptions) => {
          const northConnector = this.historyQuery();
          if (northConnector && this.saveChangesDirectly()) {
            return this.historyQueryService.addOrEditTransformer(northConnector.id, transformer).pipe(switchMap(() => of(transformer)));
          }
          this.transformersWithOptions = this.transformersWithOptions.filter(
            element => element.transformer.id !== oldTransformer.transformer.id
          );
          this.transformersWithOptions.push(transformer);
          return of(transformer);
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('history-query.transformers.edited');
        }
        this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions);
      });
  }

  deleteTransformer(transformer: TransformerDTOWithOptions) {
    this.confirmationService
      .confirm({
        messageKey: `history-query.transformers.confirm-deletion`
      })
      .pipe(
        switchMap(() => {
          const northConnector = this.historyQuery();
          if (this.saveChangesDirectly()) {
            return this.historyQueryService.removeTransformer(northConnector!.id, transformer.transformer.id);
          }
          this.transformersWithOptions = this.transformersWithOptions.filter(
            element => element.transformer.id !== transformer.transformer.id
          );
          return of(null);
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('history-query.transformers.removed');
        }
        this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions);
      });
  }
}
