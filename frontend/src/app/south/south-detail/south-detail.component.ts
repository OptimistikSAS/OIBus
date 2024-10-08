import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';

import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorCommandDTO, SouthConnectorDTO, SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, of, switchMap, tap } from 'rxjs';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PageLoader } from '../../shared/page-loader.service';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthMetricsComponent } from '../south-metrics/south-metrics.component';
import { NorthMetricsComponent } from '../../north/north-metrics/north-metrics.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EnabledEnumPipe } from '../../shared/enabled-enum.pipe';
import { SouthItemsComponent } from '../south-items/south-items.component';
import { NotificationService } from '../../shared/notification.service';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { OIBusInfo, SouthConnectorMetrics } from '../../../../../shared/model/engine.model';
import { WindowService } from '../../shared/window.service';
import { ModalService } from '../../shared/modal.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { EngineService } from '../../services/engine.service';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { LogsComponent } from '../../logs/logs.component';

@Component({
  selector: 'oib-south-detail',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    PaginationComponent,
    BackNavigationDirective,
    SouthMetricsComponent,
    NorthMetricsComponent,
    BoxComponent,
    BoxTitleDirective,
    EnabledEnumPipe,
    SouthItemsComponent,
    ClipboardModule,
    LogsComponent
  ],
  templateUrl: './south-detail.component.html',
  styleUrl: './south-detail.component.scss',
  providers: [PageLoader]
})
export class SouthDetailComponent implements OnInit, OnDestroy {
  private windowService = inject(WindowService);
  private southConnectorService = inject(SouthConnectorService);
  private scanModeService = inject(ScanModeService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private engineService = inject(EngineService);
  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private cd = inject(ChangeDetectorRef);

  southConnector: SouthConnectorDTO | null = null;
  displayedSettings: Array<{ key: string; value: string }> = [];
  scanModes: Array<ScanModeDTO> = [];
  manifest: SouthConnectorManifest | null = null;
  connectorMetrics: SouthConnectorMetrics | null = null;
  connectorStream: EventSource | null = null;
  oibusInfo: OIBusInfo | null = null;
  southId: string | null = null;

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.engineService.getInfo()]).subscribe(([scanModes, engineInfo]) => {
      this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
      this.oibusInfo = engineInfo;
    });

    this.route.paramMap
      .pipe(
        switchMap(params => {
          this.southId = params.get('southId');

          if (this.southId) {
            return this.southConnectorService.get(this.southId);
          }
          return of(null);
        }),
        switchMap(southConnector => {
          if (!southConnector) {
            return of(null);
          }
          this.southConnector = southConnector;
          return this.southConnectorService.getSouthConnectorTypeManifest(this.southConnector!.type);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          return;
        }
        this.manifest = manifest;
        this.connectToEventSource();

        this.displayedSettings = manifest.settings
          .filter(setting => setting.displayInViewMode)
          .map(setting => {
            return {
              key: setting.label,
              value: this.southConnector!.settings[setting.key]
            };
          });
      });
  }

  getScanMode(scanModeId: string | undefined) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }

  testConnection() {
    const command: SouthConnectorCommandDTO = {
      name: this.southConnector!.name,
      type: this.southConnector!.type,
      description: this.southConnector!.description,
      enabled: this.southConnector!.enabled,
      sharedConnection: this.southConnector!.sharedConnection,
      history: {
        maxInstantPerItem: this.southConnector!.history!.maxInstantPerItem,
        maxReadInterval: this.southConnector!.history!.maxReadInterval,
        readDelay: this.southConnector!.history!.readDelay,
        overlap: this.southConnector!.history!.overlap
      },
      settings: this.southConnector!.settings
    };

    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runTest('south', this.southConnector, command);
  }

  toggleConnector(value: boolean) {
    if (value) {
      this.southConnectorService
        .startSouth(this.southConnector!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('south.started', { name: this.southConnector!.name });
          }),
          switchMap(() => {
            return this.southConnectorService.get(this.southConnector!.id);
          })
        )
        .subscribe(southConnector => {
          this.southConnector = southConnector;
        });
    } else {
      this.southConnectorService
        .stopSouth(this.southConnector!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('south.stopped', { name: this.southConnector!.name });
          }),
          switchMap(() => {
            return this.southConnectorService.get(this.southConnector!.id);
          })
        )
        .subscribe(southConnector => {
          this.southConnector = southConnector;
        });
    }
  }

  connectToEventSource(): void {
    const token = this.windowService.getStorageItem('oibus-token');
    this.connectorStream = new EventSource(`/sse/south/${this.southConnector!.id}?token=${token}`, { withCredentials: true });
    this.connectorStream.addEventListener('message', (event: MessageEvent) => {
      if (event && event.data) {
        this.connectorMetrics = JSON.parse(event.data);
        this.cd.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.connectorStream?.close();
  }

  onClipboardCopy(result: boolean) {
    if (result) {
      this.notificationService.success('south.cache-path-copy.success');
    } else {
      this.notificationService.error('south.cache-path-copy.error');
    }
  }
}
