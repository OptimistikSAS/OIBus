import { ChangeDetectorRef, Component, DestroyRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { combineLatest, of, Subscription, switchMap, tap } from 'rxjs';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { NorthMetricsComponent } from '../north-metrics/north-metrics.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EnabledEnumPipe } from '../../shared/enabled-enum.pipe';
import { NotificationService } from '../../shared/notification.service';
import { pollMetrics } from '../../shared/metrics-polling';
import { NorthConnectorMetrics, OIBusInfo } from '../../../../../backend/shared/model/engine.model';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { ModalService } from '../../shared/modal.service';
import { BooleanEnumPipe } from '../../shared/boolean-enum.pipe';
import { EngineService } from '../../services/engine.service';
import { LogsComponent } from '../../logs/logs.component';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { isDisplayableAttribute } from '../../shared/form/dynamic-form.builder';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { NorthTransformersComponent } from '../north-transformers/north-transformers.component';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../backend/shared/model/transformer.model';
import { CertificateService } from '../../services/certificate.service';
import { TransformerService } from '../../services/transformer.service';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';

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
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [PageLoader, BooleanEnumPipe]
})
export class NorthDetailComponent {
  private destroyRef = inject(DestroyRef);
  private northConnectorService = inject(NorthConnectorService);
  private scanModeService = inject(ScanModeService);
  private certificateService = inject(CertificateService);
  private transformerService = inject(TransformerService);
  private engineService = inject(EngineService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private route = inject(ActivatedRoute);
  private cd = inject(ChangeDetectorRef);
  private translateService = inject(TranslateService);

  northConnector: NorthConnectorDTO | null = null;
  displayedSettings: Array<{ key: string; value: string }> = [];
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  transformers: Array<TransformerDTO> = [];
  manifest: NorthConnectorManifest | null = null;
  private metricsSubscription: Subscription | null = null;
  connectorMetrics: NorthConnectorMetrics | null = null;
  oibusInfo: OIBusInfo | null = null;
  northId: string | null = null;

  constructor() {
    combineLatest([
      this.scanModeService.list(),
      this.certificateService.list(),
      this.transformerService.list(),
      this.engineService.info$
    ]).subscribe(([scanModes, certificates, transformers, engineInfo]) => {
      this.certificates = certificates;
      this.transformers = transformers;
      this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
      this.oibusInfo = engineInfo;
    });
    const routeSub = this.route.paramMap
      .pipe(
        switchMap(params => {
          this.northId = params.get('northId');

          if (this.northId) {
            return this.northConnectorService.findById(this.northId);
          }
          return of(null);
        }),
        switchMap(northConnector => {
          if (!northConnector) {
            return of(null);
          }
          this.northConnector = northConnector;
          return this.northConnectorService.getNorthManifest(this.northConnector!.type);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          return;
        }
        this.startMetricsPolling(this.northConnector!.id);
        const northSettings: Record<string, string | boolean> = JSON.parse(JSON.stringify(this.northConnector!.settings));
        this.displayedSettings = manifest.settings.attributes
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
        this.manifest = manifest;
      });
    this.destroyRef.onDestroy(() => {
      routeSub.unsubscribe();
      this.metricsSubscription?.unsubscribe();
    });
  }

  updateInMemoryTransformers(_transformers: Array<TransformerDTOWithOptions> | null) {
    this.northConnectorService.findById(this.northConnector!.id).subscribe(northConnector => {
      this.northConnector = northConnector;
    });
  }

  getScanMode(scanModeId: string) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }

  testConnection() {
    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runTest('north', this.northConnector!.id, this.northConnector!.settings, this.northConnector!.type);
  }

  toggleConnector(value: boolean) {
    if (value) {
      this.northConnectorService
        .start(this.northConnector!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('north.started', { name: this.northConnector!.name });
          }),
          switchMap(() => {
            return this.northConnectorService.findById(this.northConnector!.id);
          })
        )
        .subscribe(northConnector => {
          this.northConnector = northConnector;
        });
    } else {
      this.northConnectorService
        .stop(this.northConnector!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('north.stopped', { name: this.northConnector!.name });
          }),
          switchMap(() => {
            return this.northConnectorService.findById(this.northConnector!.id);
          })
        )
        .subscribe(northConnector => {
          this.northConnector = northConnector;
        });
    }
  }

  startMetricsPolling(northId: string): void {
    this.metricsSubscription?.unsubscribe();
    this.metricsSubscription = pollMetrics(() => this.northConnectorService.getMetrics(northId)).subscribe(metrics => {
      this.connectorMetrics = metrics;
      this.cd.detectChanges();
    });
  }

  onClipboardCopy(result: boolean) {
    if (result) {
      this.notificationService.success('north.cache-path-copy.success');
    } else {
      this.notificationService.error('north.cache-path-copy.error');
    }
  }
}
