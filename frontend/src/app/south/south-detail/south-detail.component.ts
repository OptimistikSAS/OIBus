import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';

import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemDTO,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, of, switchMap, tap } from 'rxjs';
import { PageLoader } from '../../shared/page-loader.service';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthMetricsComponent } from './south-metrics/south-metrics.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EnabledEnumPipe } from '../../shared/enabled-enum.pipe';
import { SouthItemsComponent } from '../south-items/south-items.component';
import { NotificationService } from '../../shared/notification.service';
import { OIBusInfo, SouthConnectorMetrics } from '../../../../../backend/shared/model/engine.model';
import { WindowService } from '../../shared/window.service';
import { ModalService } from '../../shared/modal.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { EngineService } from '../../services/engine.service';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { LogsComponent } from '../../logs/logs.component';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { isDisplayableAttribute } from '../../shared/form/dynamic-form.builder';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { CertificateService } from '../../services/certificate.service';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-south-detail',
  imports: [
    TranslateDirective,
    RouterLink,
    SouthMetricsComponent,
    BoxComponent,
    BoxTitleDirective,
    EnabledEnumPipe,
    SouthItemsComponent,
    ClipboardModule,
    LogsComponent,
    OIBusSouthTypeEnumPipe,
    TranslatePipe,
    NgbTooltip
  ],
  templateUrl: './south-detail.component.html',
  styleUrl: './south-detail.component.scss',
  providers: [PageLoader]
})
export class SouthDetailComponent implements OnInit, OnDestroy {
  private windowService = inject(WindowService);
  private southConnectorService = inject(SouthConnectorService);
  private scanModeService = inject(ScanModeService);
  private certificateService = inject(CertificateService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private engineService = inject(EngineService);
  private translateService = inject(TranslateService);

  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private cd = inject(ChangeDetectorRef);

  southConnector: SouthConnectorDTO | null = null;
  displayedSettings: Array<{ key: string; value: string }> = [];
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  manifest: SouthConnectorManifest | null = null;
  connectorMetrics: SouthConnectorMetrics | null = null;
  connectorStream: EventSource | null = null;
  oibusInfo: OIBusInfo | null = null;
  southId: string | null = null;

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.certificateService.list(), this.engineService.getInfo()]).subscribe(
      ([scanModes, certificates, engineInfo]) => {
        this.scanModes = scanModes;
        this.certificates = certificates;
        this.oibusInfo = engineInfo;
      }
    );

    this.route.paramMap
      .pipe(
        switchMap(params => {
          this.southId = params.get('southId');

          if (this.southId) {
            return this.southConnectorService.findById(this.southId);
          }
          return of(null);
        }),
        switchMap(southConnector => {
          if (!southConnector) {
            return of(null);
          }
          this.southConnector = southConnector;
          return this.southConnectorService.getSouthManifest(this.southConnector!.type);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          return;
        }
        this.manifest = manifest;
        this.connectToEventSource();

        const southSettings: Record<string, string> = JSON.parse(JSON.stringify(this.southConnector!.settings));
        this.displayedSettings = manifest.settings.attributes
          .filter(setting => isDisplayableAttribute(setting))
          .filter(setting => {
            const condition = manifest.settings.enablingConditions.find(
              enablingCondition => enablingCondition.targetPathFromRoot === setting.key
            );
            return (
              !condition ||
              (condition &&
                southSettings[condition.referralPathFromRoot] &&
                condition.values.includes(southSettings[condition.referralPathFromRoot]))
            );
          })
          .map(setting => {
            return {
              key: setting.type === 'string-select' ? setting.translationKey + '.title' : setting.translationKey,
              value:
                setting.type === 'string-select'
                  ? this.translateService.instant(setting.translationKey + '.' + southSettings[setting.key])
                  : southSettings[setting.key]
            };
          });
      });
  }

  updateInMemoryItems(_items: Array<SouthConnectorItemDTO> | null) {
    this.southConnectorService.findById(this.southConnector!.id).subscribe(southConnector => {
      this.southConnector = southConnector;
    });
  }

  getScanMode(scanModeId: string | undefined) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }

  testConnection() {
    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runTest('south', this.southConnector!.id, this.southConnector!.settings, this.southConnector!.type);
  }

  toggleConnector(value: boolean) {
    if (value) {
      this.southConnectorService
        .start(this.southConnector!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('south.started', { name: this.southConnector!.name });
          }),
          switchMap(() => {
            return this.southConnectorService.findById(this.southConnector!.id);
          })
        )
        .subscribe(southConnector => {
          this.southConnector = southConnector;
        });
    } else {
      this.southConnectorService
        .stop(this.southConnector!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('south.stopped', { name: this.southConnector!.name });
          }),
          switchMap(() => {
            return this.southConnectorService.findById(this.southConnector!.id);
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

  get southConnectorCommand() {
    const command: SouthConnectorCommandDTO = {
      ...this.southConnector!,
      items: this.southConnector!.items.map(item => ({
        id: item.id,
        enabled: item.enabled,
        name: item.name,
        settings: item.settings,
        scanModeId: item.scanMode.id,
        scanModeName: null
      })) as any
    };

    return command;
  }
}
