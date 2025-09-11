import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, of, switchMap } from 'rxjs';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { HistoryQueryDTO, HistoryQueryItemCommandDTO, HistoryQueryStatus } from '../../../../../backend/shared/model/history-query.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemSearchParam,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryItemsComponent } from '../history-query-items/history-query-items.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ReactiveFormsModule } from '@angular/forms';
import { HistoryMetricsComponent } from './history-metrics/history-metrics.component';
import { HistoryQueryMetrics, OIBusInfo } from '../../../../../backend/shared/model/engine.model';
import { WindowService } from '../../shared/window.service';
import { NotificationService } from '../../shared/notification.service';
import { ObservableState } from '../../shared/save-button/save-button.component';
import { EngineService } from '../../services/engine.service';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { ModalService } from '../../shared/modal.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { LogsComponent } from '../../logs/logs.component';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { CertificateService } from '../../services/certificate.service';
import { isDisplayableAttribute } from '../../shared/form/dynamic-form.builder';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-history-query-detail',
  imports: [
    TranslateDirective,
    RouterLink,
    HistoryQueryItemsComponent,
    BoxComponent,
    BoxTitleDirective,
    ReactiveFormsModule,
    HistoryMetricsComponent,
    AsyncPipe,
    ClipboardModule,
    LogsComponent,
    OIBusNorthTypeEnumPipe,
    OIBusSouthTypeEnumPipe,
    TranslatePipe,
    NgbTooltip
  ],
  templateUrl: './history-query-detail.component.html',
  styleUrl: './history-query-detail.component.scss',
  providers: [PageLoader]
})
export class HistoryQueryDetailComponent implements OnInit, OnDestroy {
  private historyQueryService = inject(HistoryQueryService);
  private northConnectorService = inject(NorthConnectorService);
  private southConnectorService = inject(SouthConnectorService);
  private notificationService = inject(NotificationService);
  private scanModeService = inject(ScanModeService);
  private certificateService = inject(CertificateService);
  private modalService = inject(ModalService);
  private engineService = inject(EngineService);
  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private windowService = inject(WindowService);
  private cd = inject(ChangeDetectorRef);
  private translateService = inject(TranslateService);

  historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null = null;
  northDisplayedSettings: Array<{ key: string; value: string }> = [];
  southDisplayedSettings: Array<{ key: string; value: string }> = [];

  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  searchParams: SouthConnectorItemSearchParam | null = null;
  northManifest: NorthConnectorManifest | null = null;
  southManifest: SouthConnectorManifest | null = null;

  historyMetrics: HistoryQueryMetrics | null = null;
  historyStream: EventSource | null = null;
  state = new ObservableState();
  oibusInfo: OIBusInfo | null = null;
  historyQueryId: string | null = null;

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.certificateService.list(), this.engineService.getInfo()]).subscribe(
      ([scanModes, certificates, engineInfo]) => {
        this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
        this.certificates = certificates;
        this.oibusInfo = engineInfo;
      }
    );
    this.route.paramMap
      .pipe(
        switchMap(params => {
          this.historyQueryId = params.get('historyQueryId') || '';

          if (this.historyQueryId) {
            return this.historyQueryService.get(this.historyQueryId);
          }
          return of(null);
        }),
        switchMap(historyQuery => {
          if (!historyQuery) {
            return combineLatest([of(null), of(null), of(null)]);
          }
          this.historyQuery = historyQuery;
          return combineLatest([
            this.northConnectorService.getNorthConnectorTypeManifest(historyQuery.northType),
            this.southConnectorService.getSouthConnectorTypeManifest(historyQuery.southType)
          ]);
        })
      )
      .subscribe(([northManifest, southManifest]) => {
        if (!northManifest || !southManifest) {
          return;
        }
        this.northManifest = northManifest;
        this.southManifest = southManifest;
        this.connectToEventSource();

        const northSettings: Record<string, string> = JSON.parse(JSON.stringify(this.historyQuery!.northSettings));
        this.northDisplayedSettings = northManifest.settings.attributes
          .filter(setting => isDisplayableAttribute(setting))
          .filter(setting => {
            const condition = northManifest.settings.enablingConditions.find(
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

        const southSettings: Record<string, string> = JSON.parse(JSON.stringify(this.historyQuery!.southSettings));
        this.southDisplayedSettings = southManifest.settings.attributes
          .filter(setting => isDisplayableAttribute(setting))
          .filter(setting => {
            const condition = southManifest.settings.enablingConditions.find(
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

  updateInMemoryItems(_items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>> | null) {
    this.historyQueryService.get(this.historyQuery!.id).subscribe(historyQuery => {
      this.historyQuery!.items = historyQuery.items;
      this.historyQuery = JSON.parse(JSON.stringify(this.historyQuery)); // Used to force a refresh in history query item list
    });
  }

  connectToEventSource(): void {
    if (this.historyStream) {
      this.historyStream.close();
    }

    const token = this.windowService.getStorageItem('oibus-token');
    this.historyStream = new EventSource(`/sse/history-queries/${this.historyQuery!.id}?token=${token}`, { withCredentials: true });
    this.historyStream.addEventListener('message', (event: MessageEvent) => {
      if (event && event.data) {
        this.historyMetrics = JSON.parse(event.data);
        this.cd.detectChanges();

        if (this.historyQuery && this.historyQueryFinishedByMetrics) {
          this.historyQuery.status = 'FINISHED';
        }
      }
    });
  }

  ngOnDestroy() {
    this.historyStream?.close();
  }

  toggleHistoryQuery(newStatus: HistoryQueryStatus) {
    if (newStatus === 'RUNNING') {
      this.historyQueryService
        .startHistoryQuery(this.historyQuery!.id)
        .pipe(
          this.state.pendingUntilFinalization(),
          switchMap(() => {
            return this.historyQueryService.get(this.historyQuery!.id);
          })
        )
        .subscribe(updatedHistoryQuery => {
          this.historyQuery = updatedHistoryQuery;
          this.notificationService.success('history-query.started', { name: this.historyQuery!.name });
          this.connectToEventSource();
        });
    } else {
      this.historyQueryService
        .pauseHistoryQuery(this.historyQuery!.id)
        .pipe(
          this.state.pendingUntilFinalization(),
          switchMap(() => {
            return this.historyQueryService.get(this.historyQuery!.id);
          })
        )
        .subscribe(updatedHistoryQuery => {
          this.historyQuery = updatedHistoryQuery;
          this.notificationService.success('history-query.paused', { name: this.historyQuery!.name });
          this.historyStream?.close();
        });
    }
  }

  onClipboardCopy(result: boolean) {
    if (result) {
      this.notificationService.success('history-query.cache-path-copy.success');
    } else {
      this.notificationService.error('history-query.cache-path-copy.error');
    }
  }

  test(type: 'south' | 'north') {
    const modalRef = this.modalService.open(TestConnectionResultModalComponent, { backdrop: 'static' });
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runHistoryQueryTest(
      type,
      this.historyQuery!.id,
      type === 'south' ? this.historyQuery!.southSettings : this.historyQuery!.northSettings,
      type === 'south' ? this.historyQuery!.southType : this.historyQuery!.northType
    );
  }

  get historyQueryFinishedByMetrics() {
    if (!this.historyMetrics || this.historyMetrics.historyMetrics.intervalProgress !== 1) {
      return false;
    }
    return this.historyMetrics.north.currentCacheSize === 0;
  }

  get southConnectorCommand() {
    return {
      type: this.southManifest!.id,
      settings: this.historyQuery!.southSettings
    } as SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
  }
}
