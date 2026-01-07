import { Component, effect, inject, input, output } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../backend/shared/model/transformer.model';
import { ReactiveFormsModule } from '@angular/forms';
import { Modal, ModalService } from '../../shared/modal.service';
import { EditNorthTransformerModalComponent } from './edit-north-transformer-modal/edit-north-transformer-modal.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { firstValueFrom, of, switchMap } from 'rxjs';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorLightDTO } from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';

@Component({
  selector: 'oib-north-transformers',
  imports: [
    TranslateDirective,
    BoxComponent,
    ReactiveFormsModule,
    TranslatePipe,
    BoxTitleDirective,
    OibHelpComponent,
    OIBusSouthTypeEnumPipe
  ],
  templateUrl: './north-transformers.component.html',
  styleUrl: './north-transformers.component.scss'
})
export class NorthTransformersComponent {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private northConnectorService = inject(NorthConnectorService);
  private southConnectorService = inject(SouthConnectorService);

  readonly northConnector = input<NorthConnectorDTO | null>(null);

  readonly inMemoryTransformersWithOptions = output<Array<TransformerDTOWithOptions> | null>();
  readonly saveChangesDirectly = input<boolean>(false);

  readonly northManifest = input.required<NorthConnectorManifest>();
  readonly certificates = input.required<Array<CertificateDTO>>();
  readonly scanModes = input.required<Array<ScanModeDTO>>();
  readonly transformers = input.required<Array<TransformerDTO>>();

  transformersWithOptions: Array<TransformerDTOWithOptions> = []; // Array used to store subscription on north connector creation
  southConnectors: Array<SouthConnectorLightDTO> = [];

  constructor() {
    // Initialize local transformers when editing, and keep them in sync with input
    effect(() => {
      const connector = this.northConnector();
      if (connector) {
        this.transformersWithOptions = [...connector.transformers];
      }
    });
    this.southConnectorService.list().subscribe(southConnectors => {
      this.southConnectors = southConnectors;
    });
  }

  addTransformer(e: Event) {
    e.preventDefault();
    const modalRef = this.modalService.open(EditNorthTransformerModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditNorthTransformerModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditNorthTransformerModalComponent = modalRef.componentInstance;

    component.prepareForCreation(
      this.southConnectors,
      this.scanModes(),
      this.certificates(),
      this.transformersWithOptions.map(t => ({ inputType: t.inputType, south: t.south?.id || null })),
      this.transformers(),
      this.northManifest().types
    );
    this.refreshAfterAddModalClosed(modalRef);
  }

  private refreshAfterAddModalClosed(modalRef: Modal<EditNorthTransformerModalComponent>) {
    modalRef.result
      .pipe(
        switchMap((transformer: TransformerDTOWithOptions) => {
          const northConnector = this.northConnector();
          if (northConnector && this.saveChangesDirectly()) {
            return this.northConnectorService.addOrEditTransformer(northConnector.id, transformer).pipe(switchMap(() => of(transformer)));
          }
          this.transformersWithOptions = [...this.transformersWithOptions, transformer];
          return of(transformer);
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('north.transformers.added');
        }
        this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions);
      });
  }

  editTransformer(transformer: TransformerDTOWithOptions) {
    const modalRef = this.modalService.open(EditNorthTransformerModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditNorthTransformerModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditNorthTransformerModalComponent = modalRef.componentInstance;

    component.prepareForEdition(
      this.southConnectors,
      this.scanModes(),
      this.certificates(),
      transformer,
      this.transformers(),
      this.northManifest().types
    );
    this.refreshAfterEditModalClosed(modalRef, transformer);
  }

  private refreshAfterEditModalClosed(modalRef: Modal<EditNorthTransformerModalComponent>, oldTransformer: TransformerDTOWithOptions) {
    modalRef.result
      .pipe(
        switchMap((transformer: TransformerDTOWithOptions) => {
          const northConnector = this.northConnector();
          if (northConnector && this.saveChangesDirectly()) {
            return this.northConnectorService.addOrEditTransformer(northConnector.id, transformer).pipe(switchMap(() => of(transformer)));
          }
          this.transformersWithOptions = this.transformersWithOptions.filter(element => element.id !== oldTransformer.id);
          this.transformersWithOptions.push(transformer);
          return of(transformer);
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('north.transformers.edited');
        }
        this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions);
      });
  }

  deleteTransformer(transformer: TransformerDTOWithOptions) {
    this.confirmationService
      .confirm({
        messageKey: `north.transformers.confirm-deletion`
      })
      .pipe(
        switchMap(() => {
          if (this.saveChangesDirectly()) {
            return this.northConnectorService.removeTransformer(this.northConnector()!.id, transformer.id);
          }
          this.transformersWithOptions = this.transformersWithOptions.filter(element => element.id !== transformer.id);
          return of(null);
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('north.transformers.removed');
        }
        this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions);
      });
  }
}
