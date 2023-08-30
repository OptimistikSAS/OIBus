import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { NgForOf, NgIf, NgSwitch } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemManifest,
  SouthConnectorManifest
} from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, switchMap, tap } from 'rxjs';
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
import { SouthConnectorMetrics } from '../../../../../shared/model/engine.model';
import { WindowService } from '../../shared/window.service';
import { ModalService } from '../../shared/modal.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';

@Component({
  selector: 'oib-south-detail',
  standalone: true,
  imports: [
    NgIf,
    TranslateModule,
    RouterLink,
    NgSwitch,
    NgForOf,
    PaginationComponent,
    BackNavigationDirective,
    SouthMetricsComponent,
    NorthMetricsComponent,
    BoxComponent,
    BoxTitleDirective,
    EnabledEnumPipe,
    SouthItemsComponent
  ],
  templateUrl: './south-detail.component.html',
  styleUrls: ['./south-detail.component.scss'],
  providers: [PageLoader]
})
export class SouthDetailComponent implements OnInit, OnDestroy {
  southConnector: SouthConnectorDTO | null = null;
  displayedSettings: Array<{ key: string; value: string }> = [];
  southItemSchema: SouthConnectorItemManifest | null = null;
  scanModes: Array<ScanModeDTO> = [];
  manifest: SouthConnectorManifest | null = null;
  connectorMetrics: SouthConnectorMetrics | null = null;
  connectorStream: EventSource | null = null;

  constructor(
    private windowService: WindowService,
    private southConnectorService: SouthConnectorService,
    private scanModeService: ScanModeService,
    private notificationService: NotificationService,
    private modalService: ModalService,
    protected router: Router,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.scanModeService.list().subscribe(scanModes => {
      this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
    });

    this.route.paramMap
      .pipe(
        switchMap(params => {
          const paramSouthId = params.get('southId');

          if (paramSouthId) {
            return this.southConnectorService.get(paramSouthId);
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
        this.southItemSchema = manifest.items;
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
      history: {
        maxInstantPerItem: this.southConnector!.history!.maxInstantPerItem,
        maxReadInterval: this.southConnector!.history!.maxReadInterval,
        readDelay: this.southConnector!.history!.readDelay
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
}
