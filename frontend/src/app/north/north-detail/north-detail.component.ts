import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { combineLatest, of, switchMap, tap } from 'rxjs';
import { PageLoader } from '../../shared/page-loader.service';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorManifest
} from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { NorthSubscriptionsComponent } from '../north-subscriptions/north-subscriptions.component';
import { NorthMetricsComponent } from '../north-metrics/north-metrics.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EnabledEnumPipe } from '../../shared/enabled-enum.pipe';
import { NotificationService } from '../../shared/notification.service';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { WindowService } from '../../shared/window.service';
import { NorthConnectorMetrics, OIBusInfo } from '../../../../../backend/shared/model/engine.model';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { ModalService } from '../../shared/modal.service';
import { BooleanEnumPipe } from '../../shared/boolean-enum.pipe';
import { EngineService } from '../../services/engine.service';
import { LogsComponent } from '../../logs/logs.component';
import { SouthConnectorLightDTO } from '../../../../../backend/shared/model/south-connector.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { isDisplayableAttribute } from '../../shared/form/dynamic-form.builder';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-north-detail',
  imports: [
    TranslateDirective,
    RouterLink,
    BackNavigationDirective,
    NorthSubscriptionsComponent,
    NorthMetricsComponent,
    BoxComponent,
    BoxTitleDirective,
    EnabledEnumPipe,
    ClipboardModule,
    LogsComponent,
    OIBusNorthTypeEnumPipe,
    TranslatePipe,
    NgbTooltip
  ],
  templateUrl: './north-detail.component.html',
  styleUrl: './north-detail.component.scss',
  providers: [PageLoader, BooleanEnumPipe]
})
export class NorthDetailComponent implements OnInit, OnDestroy {
  private windowService = inject(WindowService);
  private northConnectorService = inject(NorthConnectorService);
  private scanModeService = inject(ScanModeService);
  private engineService = inject(EngineService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private route = inject(ActivatedRoute);
  private cd = inject(ChangeDetectorRef);
  private translateService = inject(TranslateService);

  northConnector: NorthConnectorDTO<NorthSettings> | null = null;
  displayedSettings: Array<{ key: string; value: string }> = [];
  scanModes: Array<ScanModeDTO> = [];
  manifest: NorthConnectorManifest | null = null;
  connectorStream: EventSource | null = null;
  connectorMetrics: NorthConnectorMetrics | null = null;
  oibusInfo: OIBusInfo | null = null;
  northId: string | null = null;

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.engineService.getInfo()]).subscribe(([scanModes, engineInfo]) => {
      this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
      this.oibusInfo = engineInfo;
    });
    this.route.paramMap
      .pipe(
        switchMap(params => {
          this.northId = params.get('northId');

          if (this.northId) {
            return this.northConnectorService.get(this.northId);
          }
          return of(null);
        }),
        switchMap(northConnector => {
          if (!northConnector) {
            return of(null);
          }
          this.northConnector = northConnector;
          return this.northConnectorService.getNorthConnectorTypeManifest(this.northConnector!.type);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          return;
        }
        this.connectToEventSource();
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
  }

  updateInMemorySubscriptions(_subscriptions: Array<SouthConnectorLightDTO> | null) {
    this.northConnectorService.get(this.northConnector!.id).subscribe(northConnector => {
      this.northConnector = northConnector;
    });
  }

  getScanMode(scanModeId: string) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }

  testConnection() {
    const command: NorthConnectorCommandDTO<NorthSettings> = {
      name: this.northConnector!.name,
      type: this.northConnector!.type,
      description: this.northConnector!.description,
      enabled: this.northConnector!.enabled,
      settings: this.northConnector!.settings,
      caching: {
        trigger: {
          scanModeId: this.northConnector!.caching!.trigger!.scanModeId!,
          scanModeName: null,
          numberOfElements: this.northConnector!.caching!.trigger!.numberOfElements!,
          numberOfFiles: this.northConnector!.caching!.trigger!.numberOfFiles!
        },
        throttling: {
          runMinDelay: this.northConnector!.caching!.throttling!.runMinDelay!,
          maxSize: this.northConnector!.caching!.throttling!.maxSize!,
          maxNumberOfElements: this.northConnector!.caching!.throttling!.maxNumberOfElements!
        },
        error: {
          retryInterval: this.northConnector!.caching!.error!.retryInterval!,
          retryCount: this.northConnector!.caching!.error!.retryCount!,
          retentionDuration: this.northConnector!.caching!.error!.retentionDuration!
        },
        archive: {
          enabled: this.northConnector!.caching!.archive!.enabled!,
          retentionDuration: this.northConnector!.caching!.archive!.retentionDuration!
        }
      },
      subscriptions: [],
      transformers: []
    };

    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runTest('north', this.northConnector, command);
  }

  toggleConnector(value: boolean) {
    if (value) {
      this.northConnectorService
        .startNorth(this.northConnector!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('north.started', { name: this.northConnector!.name });
          }),
          switchMap(() => {
            return this.northConnectorService.get(this.northConnector!.id);
          })
        )
        .subscribe(northConnector => {
          this.northConnector = northConnector;
        });
    } else {
      this.northConnectorService
        .stopNorth(this.northConnector!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('north.stopped', { name: this.northConnector!.name });
          }),
          switchMap(() => {
            return this.northConnectorService.get(this.northConnector!.id);
          })
        )
        .subscribe(northConnector => {
          this.northConnector = northConnector;
        });
    }
  }

  connectToEventSource(): void {
    const token = this.windowService.getStorageItem('oibus-token');
    this.connectorStream = new EventSource(`/sse/north/${this.northConnector!.id}?token=${token}`, { withCredentials: true });
    this.connectorStream.onmessage = (event: MessageEvent) => {
      if (event && event.data) {
        this.connectorMetrics = JSON.parse(event.data);
        this.cd.detectChanges();
      }
    };
  }

  ngOnDestroy() {
    this.connectorStream?.close();
  }

  onClipboardCopy(result: boolean) {
    if (result) {
      this.notificationService.success('north.cache-path-copy.success');
    } else {
      this.notificationService.error('north.cache-path-copy.error');
    }
  }
}
