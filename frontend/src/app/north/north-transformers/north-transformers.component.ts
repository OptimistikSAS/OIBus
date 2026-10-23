import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, of, switchMap } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorLightDTO } from '@oibus/shared/api/south-connector.model';
import { TransformerDTO, TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';
import { NorthConnectorManifest } from '@oibus/shared/connector/north-manifest.model';

import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DocsUrlService } from '../../shared/docs-url.service';
import { Modal, ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { getAssociatedInputType, isTransformerApplicable } from '../../shared/utils/utils';
import { formatTransformerSource } from '../north-summary';
import { EditNorthTransformerModalComponent } from './edit-north-transformer-modal/edit-north-transformer-modal.component';
import { SouthCoverage, southCoverage } from './transformer-routing';
import { TransformerRoutingModalComponent } from './transformer-routing-modal/transformer-routing-modal.component';

@Component({
  selector: 'oib-north-transformers',
  imports: [
    NgTemplateOutlet,
    TranslateDirective,
    BoxComponent,
    ReactiveFormsModule,
    TranslatePipe,
    BoxTitleDirective,
    OibHelpComponent,
    NgbTooltip,
    OIBusSouthTypeEnumPipe
  ],
  templateUrl: './north-transformers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './north-transformers.component.scss'
})
export class NorthTransformersComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notificationService = inject(NotificationService);
  private readonly modalService = inject(ModalService);
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly translateService = inject(TranslateService);
  private readonly docsUrlService = inject(DocsUrlService);

  readonly helpUrl = this.docsUrlService.resolve('guide/north-connectors/common-settings#transformers');

  readonly northConnector = input<NorthConnectorDTO | null>(null);

  readonly inMemoryTransformersWithOptions = output<Array<TransformerDTOWithOptions> | null>();
  readonly saveChangesDirectly = input<boolean>(false);
  /** A box with its own title, or a section of the page, under a section title (on the edit pages) */
  readonly layout = input<'box' | 'section'>('box');

  readonly northManifest = input.required<NorthConnectorManifest>();
  readonly certificates = input.required<Array<CertificateDTO>>();
  readonly scanModes = input.required<Array<ScanModeDTO>>();
  readonly transformers = input.required<Array<TransformerDTO>>();

  // Local transformers: initialized from the edited connector and kept in sync with it, then updated in memory
  readonly transformersWithOptions = linkedSignal<NorthConnectorDTO | null, Array<TransformerDTOWithOptions>>({
    source: this.northConnector,
    computation: (connector, previous) => (connector ? [...connector.transformers] : (previous?.value ?? []))
  });
  private readonly southConnectors = toSignal(this.southConnectorService.list(), { initialValue: [] });

  /**
   * The souths whose data (all of it, or that of some items) reaches no transformer, and is therefore dropped by the North.
   * Only the souths whose data some transformer could send to the North are listed.
   */
  readonly uncoveredSouths = computed<Array<{ south: SouthConnectorLightDTO; coverage: Exclude<SouthCoverage, 'all'> }>>(() => {
    const northTypes = this.northManifest().types;
    const result: Array<{ south: SouthConnectorLightDTO; coverage: Exclude<SouthCoverage, 'all'> }> = [];
    for (const south of this.southConnectors()) {
      const coverage = southCoverage(this.transformersWithOptions(), south.id);
      const dataType = getAssociatedInputType(south.type);
      if (coverage !== 'all' && this.transformers().some(transformer => isTransformerApplicable(transformer, dataType, northTypes))) {
        result.push({ south, coverage });
      }
    }
    return result;
  });
  readonly showUncoveredSouths = signal(false);

  addTransformer(south: SouthConnectorLightDTO | null = null) {
    const modalRef = this.modalService.open(EditNorthTransformerModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditNorthTransformerModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditNorthTransformerModalComponent = modalRef.componentInstance;
    component.directSave.set(this.saveChangesDirectly());

    component.prepareForCreation(
      this.southConnectors(),
      this.scanModes(),
      this.certificates(),
      this.transformers(),
      this.northManifest().types,
      south
    );
    this.refreshAfterAddModalClosed(modalRef);
  }

  /** Shows the transformer each item of a south is routed to, offering to send the dropped items */
  showRouting(south: SouthConnectorLightDTO | null = null) {
    const modalRef = this.modalService.open(TransformerRoutingModalComponent, { size: 'xl' });
    const component: TransformerRoutingModalComponent = modalRef.componentInstance;
    component.prepare(this.southConnectors(), this.transformersWithOptions(), south);
    modalRef.result.subscribe((southToSend: SouthConnectorLightDTO) => this.addTransformer(southToSend));
  }

  private refreshAfterAddModalClosed(modalRef: Modal<EditNorthTransformerModalComponent>) {
    modalRef.result
      .pipe(
        switchMap((transformer: TransformerDTOWithOptions) => {
          const northConnector = this.northConnector();
          if (northConnector && this.saveChangesDirectly()) {
            // remove temp_ id when creating directly
            const transformerToCreate = { ...transformer, id: '' };
            return this.northConnectorService
              .addOrEditTransformer(northConnector.id, transformerToCreate)
              .pipe(switchMap(() => of(transformerToCreate)));
          }
          this.transformersWithOptions.update(transformersWithOptions => [...transformersWithOptions, transformer]);
          return of(transformer);
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('north.transformers.added');
        }
        this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions());
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
    component.directSave.set(this.saveChangesDirectly());

    component.prepareForEdition(
      this.southConnectors(),
      this.scanModes(),
      this.certificates(),
      this.transformers(),
      this.northManifest().types,
      transformer
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
          this.transformersWithOptions.update(transformersWithOptions => [
            ...transformersWithOptions.filter(element => element.id !== oldTransformer.id),
            transformer
          ]);
          return of(transformer);
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('north.transformers.edited');
        }
        this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions());
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
            this.transformersWithOptions.update(transformersWithOptions =>
              transformersWithOptions.filter(element => element.id !== transformer.id)
            );
            return this.northConnectorService.removeTransformer(this.northConnector()!.id, transformer.id);
          } else {
            this.transformersWithOptions.update(transformersWithOptions =>
              transformersWithOptions.filter(element => {
                return element.id !== transformer.id;
              })
            );
          }
          return of(null);
        })
      )
      .subscribe(() => {
        if (this.saveChangesDirectly()) {
          this.notificationService.success('north.transformers.removed');
        }
        this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions());
      });
  }

  /**
   * Open a modal to view the audit history of a transformer of the north connector
   */
  showAudit(transformer: TransformerDTOWithOptions) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare('north_transformer', transformer.id);
  }

  formatTransformerSource(transformer: TransformerDTOWithOptions) {
    return formatTransformerSource(transformer, this.translateService);
  }

  getSourceTooltip(transformer: TransformerDTOWithOptions): string | null {
    if (transformer.source.type !== 'south') return null;
    const { items, group } = transformer.source;
    if (group || items.length === 0) return null;
    if (items.length === 1) return items[0].name;
    const names = items
      .slice(0, 5)
      .map(i => i.name)
      .join('\n');
    return items.length > 5
      ? `${names}\n${this.translateService.instant('configuration.oibus.manifest.transformers.tooltip-overflow', { count: items.length - 5 })}`
      : names;
  }

  getSourceParts(transformer: TransformerDTOWithOptions): { prefix: string; itemLabel: string } | null {
    if (transformer.source.type !== 'south') return null;
    const { items, group } = transformer.source;
    if (group || items.length === 0) return null;
    const southLabel = `${transformer.source.south!.name} (${this.translateService.instant('enums.oibus-south-type.' + transformer.source.south!.type)})`;
    const itemLabel =
      items.length === 1
        ? items[0].name
        : this.translateService.instant('configuration.oibus.manifest.transformers.several-items-selected', {
            numberOfItems: items.length
          });
    return { prefix: `${southLabel} `, itemLabel };
  }
}
