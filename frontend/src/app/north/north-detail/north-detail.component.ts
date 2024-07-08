import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { combineLatest, of, switchMap, tap } from 'rxjs';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorCommandDTO, NorthConnectorDTO, NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { NorthSubscriptionsComponent } from '../north-subscriptions/north-subscriptions.component';
import { NorthMetricsComponent } from '../north-metrics/north-metrics.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DurationPipe } from '../../shared/duration.pipe';
import { EnabledEnumPipe } from '../../shared/enabled-enum.pipe';
import { NotificationService } from '../../shared/notification.service';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { WindowService } from '../../shared/window.service';
import { NorthConnectorMetrics, OIBusInfo } from '../../../../../shared/model/engine.model';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { ModalService } from '../../shared/modal.service';
import { BooleanEnumPipe } from '../../shared/boolean-enum.pipe';
import { PipeProviderService } from '../../shared/form/pipe-provider.service';
import { EngineService } from '../../services/engine.service';

@Component({
  selector: 'oib-north-detail',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    DecimalPipe,
    BackNavigationDirective,
    NorthSubscriptionsComponent,
    NorthMetricsComponent,
    BoxComponent,
    BoxTitleDirective,
    DurationPipe,
    EnabledEnumPipe,
    ClipboardModule
  ],
  templateUrl: './north-detail.component.html',
  styleUrl: './north-detail.component.scss',
  providers: [PageLoader, BooleanEnumPipe]
})
export class NorthDetailComponent implements OnInit, OnDestroy {
  northConnector: NorthConnectorDTO | null = null;
  displayedSettings: Array<{ key: string; value: string }> = [];
  scanModes: Array<ScanModeDTO> = [];
  manifest: NorthConnectorManifest | null = null;
  connectorStream: EventSource | null = null;
  connectorMetrics: NorthConnectorMetrics | null = null;
  oibusInfo: OIBusInfo | null = null;

  constructor(
    private windowService: WindowService,
    private northConnectorService: NorthConnectorService,
    private scanModeService: ScanModeService,
    private engineService: EngineService,
    private notificationService: NotificationService,
    private modalService: ModalService,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
    private pipeProviderService: PipeProviderService,
    private booleanPipe: BooleanEnumPipe
  ) {}

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.engineService.getInfo()]).subscribe(([scanModes, engineInfo]) => {
      this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
      this.oibusInfo = engineInfo;
    });
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const paramNorthId = params.get('northId');

          if (paramNorthId) {
            return this.northConnectorService.get(paramNorthId);
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
        this.displayedSettings = manifest.settings
          .filter(setting => setting.displayInViewMode)
          .map(setting => {
            switch (setting.type) {
              case 'OibText':
              case 'OibTextArea':
              case 'OibCodeBlock':
              case 'OibNumber':
              case 'OibTimezone':
              case 'OibScanMode':
                return {
                  key: setting.label,
                  value: this.northConnector!.settings[setting.key]
                };
              case 'OibSelect':
                return {
                  key: setting.label,
                  value: this.transform(this.northConnector!.settings[setting.key], setting.pipe)
                };
              case 'OibCheckbox':
                return {
                  key: setting.label,
                  value: this.booleanPipe.transform(this.northConnector!.settings[setting.key])
                };
              case 'OibCertificate':
              case 'OibSecret':
              case 'OibArray':
              case 'OibFormGroup':
                return {
                  key: setting.label,
                  value: ''
                };
            }
          });
        this.manifest = manifest;
      });
  }

  getScanMode(scanModeId: string) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }

  transform(value: string, pipeIdentifier: string | undefined): string {
    if (!pipeIdentifier || !this.pipeProviderService.validIdentifier(pipeIdentifier)) {
      return value;
    }
    return this.pipeProviderService.getPipeForString(pipeIdentifier).transform(value);
  }

  testConnection() {
    const command: NorthConnectorCommandDTO = {
      name: this.northConnector!.name,
      type: this.northConnector!.type,
      description: this.northConnector!.description,
      enabled: this.northConnector!.enabled,
      settings: this.northConnector!.settings,
      caching: this.northConnector!.caching,
      archive: this.northConnector!.archive
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
