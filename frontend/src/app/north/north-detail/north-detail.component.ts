import { ClipboardModule } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map, of, switchMap, tap } from 'rxjs';

import { TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';
import { AuditEntityType } from '@oibus/shared/domain/audit.model';

import { LogsComponent } from '../../logs/logs.component';
import { CertificateService } from '../../services/certificate.service';
import { EngineService } from '../../services/engine.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { TransformerService } from '../../services/transformer.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { BooleanEnumPipe } from '../../shared/boolean-enum.pipe';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EnabledEnumPipe } from '../../shared/enabled-enum.pipe';
import { isDisplayableAttribute } from '../../shared/form/dynamic-form.builder';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { PageLoader } from '../../shared/page-loader.service';
import { pollMetrics } from '../../shared/polling';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { NorthMetricsComponent } from '../north-metrics/north-metrics.component';
import { NorthTransformersComponent } from '../north-transformers/north-transformers.component';

@Component({
  selector: 'oib-north-detail',
  imports: [
    TranslateDirective,
    RouterLink,
    NorthMetricsComponent,
    BoxComponent,
    BoxTitleDirective,
    EnabledEnumPipe,
    ClipboardModule,
    LogsComponent,
    OIBusNorthTypeEnumPipe,
    TranslatePipe,
    NgbTooltip,
    NorthTransformersComponent
  ],
  templateUrl: './north-detail.component.html',
  styleUrl: './north-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PageLoader, BooleanEnumPipe]
})
export class NorthDetailComponent {
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly scanModeService = inject(ScanModeService);
  private readonly certificateService = inject(CertificateService);
  private readonly transformerService = inject(TransformerService);
  private readonly engineService = inject(EngineService);
  private readonly notificationService = inject(NotificationService);
  private readonly modalService = inject(ModalService);
  private readonly route = inject(ActivatedRoute);
  private readonly translateService = inject(TranslateService);

  readonly scanModes = toSignal(
    this.scanModeService.list().pipe(map(scanModes => scanModes.filter(scanMode => scanMode.id !== 'subscription'))),
    {
      initialValue: []
    }
  );
  readonly certificates = toSignal(this.certificateService.list(), { initialValue: [] });
  readonly transformers = toSignal(this.transformerService.list(), { initialValue: [] });
  readonly oibusInfo = toSignal(this.engineService.info$, { initialValue: null });

  readonly northId = toSignal(this.route.paramMap.pipe(map(params => params.get('northId'))), { initialValue: null });
  private readonly northConnectorResource = rxResource({
    params: () => this.northId() ?? undefined,
    stream: ({ params: northId }) => this.northConnectorService.findById(northId)
  });
  readonly northConnector = computed(() => (this.northConnectorResource.hasValue() ? this.northConnectorResource.value() : null));
  private readonly manifestResource = rxResource({
    params: () => this.northConnector()?.type,
    stream: ({ params: type }) => this.northConnectorService.getNorthManifest(type)
  });
  readonly manifest = computed(() => (this.manifestResource.hasValue() ? this.manifestResource.value() : null));

  readonly displayedSettings = computed<Array<{ key: string; value: string }>>(() => {
    const manifest = this.manifest();
    const northConnector = this.northConnector();
    if (!manifest || !northConnector) {
      return [];
    }
    const northSettings: Record<string, string | boolean> = JSON.parse(JSON.stringify(northConnector.settings));
    return manifest.settings.attributes
      .filter(setting => isDisplayableAttribute(setting))
      .filter(setting => {
        const condition = manifest.settings.enablingConditions.find(
          enablingCondition => enablingCondition.targetPathFromRoot === setting.key
        );
        return (
          !condition ||
          (condition &&
            northSettings[condition.referralPathFromRoot] &&
            condition.values.includes(northSettings[condition.referralPathFromRoot]))
        );
      })
      .map(setting => {
        return {
          key: setting.type === 'string-select' ? setting.translationKey + '.title' : setting.translationKey,
          value:
            setting.type === 'string-select'
              ? this.translateService.instant(setting.translationKey + '.' + northSettings[setting.key])
              : northSettings[setting.key]
        };
      });
  });

  // the metrics are polled once the connector and its manifest are loaded
  private readonly metricsNorthId = computed(() => (this.manifest() ? (this.northConnector()?.id ?? null) : null));
  readonly connectorMetrics = toSignal(
    toObservable(this.metricsNorthId).pipe(
      switchMap(northId => (northId ? pollMetrics(() => this.northConnectorService.getMetrics(northId)) : of(null)))
    ),
    { initialValue: null }
  );

  updateInMemoryTransformers(_transformers: Array<TransformerDTOWithOptions> | null) {
    this.northConnectorService.findById(this.northConnector()!.id).subscribe(northConnector => {
      this.northConnectorResource.set(northConnector);
    });
  }

  getScanMode(scanModeId: string) {
    return this.scanModes().find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }

  testConnection() {
    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    const northConnector = this.northConnector()!;
    component.runTest('north', northConnector.id, northConnector.settings, northConnector.type);
  }

  toggleConnector(value: boolean) {
    if (value) {
      this.northConnectorService
        .start(this.northConnector()!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('north.started', { name: this.northConnector()!.name });
          }),
          switchMap(() => {
            return this.northConnectorService.findById(this.northConnector()!.id);
          })
        )
        .subscribe(northConnector => {
          this.northConnectorResource.set(northConnector);
        });
    } else {
      this.northConnectorService
        .stop(this.northConnector()!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('north.stopped', { name: this.northConnector()!.name });
          }),
          switchMap(() => {
            return this.northConnectorService.findById(this.northConnector()!.id);
          })
        )
        .subscribe(northConnector => {
          this.northConnectorResource.set(northConnector);
        });
    }
  }

  onClipboardCopy(result: boolean) {
    if (result) {
      this.notificationService.success('north.cache-path-copy.success');
    } else {
      this.notificationService.error('north.cache-path-copy.error');
    }
  }

  /**
   * Open a modal to view the audit history of the connector
   */
  showAudit(entityType: Extract<AuditEntityType, 'north_connector'>, entityId: string) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare(entityType, entityId);
  }
}
