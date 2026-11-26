import { ClipboardModule } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map, Observable, of, switchMap, tap } from 'rxjs';

import { TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';
import { AuditEntityType } from '@oibus/shared/domain/audit.model';
import { PresentedServerIdentity, ServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { LogsComponent } from '../../logs/logs.component';
import { CertificateService } from '../../services/certificate.service';
import { EngineService } from '../../services/engine.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { TransformerService } from '../../services/transformer.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { AuditInfoComponent } from '../../shared/audit-info/audit-info.component';
import { BooleanEnumPipe } from '../../shared/boolean-enum.pipe';
import { OIBusSettingsSummaryComponent } from '../../shared/form/oibus-settings-summary/oibus-settings-summary.component';
import { SettingSummary, summarizeSettings } from '../../shared/form/oibus-settings-summary/settings-summary';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { PageLoader } from '../../shared/page-loader.service';
import { pollMetrics } from '../../shared/polling';
import { SectionAnchorDirective } from '../../shared/section-anchor/section-anchor.directive';
import { SectionLinkComponent } from '../../shared/section-anchor/section-link.component';
import { toDisplayedServerTrust } from '../../shared/server-trust/server-trust';
import { askServerTrust, reviewServerIdentity } from '../../shared/server-trust/server-trust-modal/server-trust-modal.component';
import { ServerTrustPanelComponent } from '../../shared/server-trust/server-trust-panel/server-trust-panel.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { NorthMetricsComponent } from '../north-metrics/north-metrics.component';
import { summarizeCaching } from '../north-summary';
import { NorthTransformersComponent } from '../north-transformers/north-transformers.component';

@Component({
  selector: 'oib-north-detail',
  imports: [
    SectionAnchorDirective,
    SectionLinkComponent,
    TranslateDirective,
    RouterLink,
    NorthMetricsComponent,
    ClipboardModule,
    LogsComponent,
    OIBusNorthTypeEnumPipe,
    TranslatePipe,
    NgbTooltip,
    NorthTransformersComponent,
    OIBusSettingsSummaryComponent,
    AuditInfoComponent,
    ServerTrustPanelComponent
  ],
  templateUrl: './north-detail.component.html',
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

  /** The settings of the connector, summed up from its manifest: its status shows in the header of the page */
  readonly displayedSettings = computed<Array<SettingSummary>>(() => {
    const manifest = this.manifest();
    const northConnector = this.northConnector();
    if (!manifest || !northConnector) {
      return [];
    }
    return summarizeSettings(manifest.settings, northConnector.settings, {
      translateService: this.translateService,
      scanModes: this.scanModes(),
      certificates: this.certificates(),
      applyEnablingConditions: true
    });
  });

  /** The caching settings of the connector, summed up as in the review step of its edition */
  readonly cachingSummary = computed<Array<SettingSummary>>(() => {
    const northConnector = this.northConnector();
    return northConnector ? summarizeCaching(northConnector.caching, this.translateService, () => false) : [];
  });

  // the metrics are polled once the connector and its manifest are loaded
  private readonly metricsNorthId = computed(() => (this.manifest() ? (this.northConnector()?.id ?? null) : null));
  readonly connectorMetrics = toSignal(
    toObservable(this.metricsNorthId).pipe(
      switchMap(northId => (northId ? pollMetrics(() => this.northConnectorService.getMetrics(northId)) : of(null)))
    ),
    { initialValue: null }
  );

  /** Bumped to read again the trust of the connector in the identity of its server, once a user trusted it */
  private readonly serverTrustRefresh = signal(0);
  private readonly serverTrustNorthId = computed(() =>
    this.manifest()?.serverIdentity ? { northId: this.northConnector()?.id ?? null, refresh: this.serverTrustRefresh() } : null
  );
  /** The trust of the connector in the identity of its server, with the identity it refused, polled as the metrics */
  private readonly polledServerTrust = toSignal(
    toObservable(this.serverTrustNorthId).pipe(
      switchMap(target => (target?.northId ? pollMetrics(() => this.northConnectorService.getServerTrust(target.northId!)) : of(null)))
    ),
    { initialValue: null }
  );
  /** The trust shown on the page (see toDisplayedServerTrust) */
  readonly serverTrust = computed(() => toDisplayedServerTrust(this.polledServerTrust(), this.northConnector()?.enabled ?? false));

  updateInMemoryTransformers(_transformers: Array<TransformerDTOWithOptions> | null) {
    this.northConnectorService.findById(this.northConnector()!.id).subscribe(northConnector => {
      this.northConnectorResource.set(northConnector);
    });
  }

  testConnection() {
    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    const northConnector = this.northConnector()!;
    if (this.manifest()!.serverIdentity) {
      component.allowServerTrust({
        trusted: northConnector.serverTrust.identity,
        trust: identity => this.trustServerIdentity(identity)
      });
    }
    component.runTest('north', northConnector.id, northConnector.settings, northConnector.type);
  }

  /** Reviews the identity the connector refused, and trusts it if the user does */
  reviewServerIdentity(pending: PresentedServerIdentity) {
    askServerTrust(this.modalService, 'review', pending, this.serverTrust()?.identity ?? null)
      .pipe(switchMap(() => this.trustServerIdentity(pending.identity)))
      .subscribe();
  }

  /** Trusts the identity the server presents (the connector restarts with it) */
  private trustServerIdentity(identity: ServerIdentity): Observable<void> {
    const northConnector = this.northConnector()!;
    return this.northConnectorService.trustServerIdentity(northConnector.id, identity.fingerprint).pipe(
      tap(() => {
        this.notificationService.success('server-trust.trusted', { name: northConnector.name });
        this.serverTrustRefresh.update(refresh => refresh + 1);
      }),
      switchMap(() => this.northConnectorService.findById(northConnector.id)),
      tap(updatedNorthConnector => this.northConnectorResource.set(updatedNorthConnector)),
      map(() => undefined)
    );
  }

  /**
   * Before starting a connector checking the identity of its server: proposes to trust it when it must be reviewed. Starting
   * does not depend on reaching the server: the connector then waits until its server is trusted.
   */
  private reviewServerIdentityBeforeStart(): Observable<void> {
    const northConnector = this.northConnector()!;
    if (!this.manifest()!.serverIdentity) {
      return of(undefined);
    }
    return reviewServerIdentity(
      this.modalService,
      'start',
      this.northConnectorService.retrieveServerIdentity(northConnector.id, northConnector.settings, northConnector.type),
      northConnector.serverTrust,
      northConnector.serverTrust.identity
    ).pipe(switchMap(identity => (identity ? this.trustServerIdentity(identity) : of(undefined))));
  }

  toggleConnector(value: boolean) {
    if (value) {
      this.reviewServerIdentityBeforeStart()
        .pipe(
          switchMap(() => this.northConnectorService.start(this.northConnector()!.id)),
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
