import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, of, switchMap } from 'rxjs';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorCommandDTO, NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { HistoryQueryDTO, HistoryQueryStatus } from '../../../../../shared/model/history-query.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthConnectorManifest
} from '../../../../../shared/model/south-connector.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { HistoryQueryItemsComponent } from '../history-query-items/history-query-items.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EnabledEnumPipe } from '../../shared/enabled-enum.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { ReactiveFormsModule } from '@angular/forms';
import { HistoryMetricsComponent } from './history-metrics/history-metrics.component';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { SouthMetricsComponent } from '../../south/south-metrics/south-metrics.component';
import { HistoryMetrics, OIBusInfo } from '../../../../../shared/model/engine.model';
import { WindowService } from '../../shared/window.service';
import { NotificationService } from '../../shared/notification.service';
import { ObservableState } from '../../shared/save-button/save-button.component';
import { EngineService } from '../../services/engine.service';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { ModalService } from '../../shared/modal.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { LogsComponent } from '../../logs/logs.component';

@Component({
  selector: 'oib-history-query-detail',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    DecimalPipe,
    BackNavigationDirective,
    PaginationComponent,
    HistoryQueryItemsComponent,
    BoxComponent,
    BoxTitleDirective,
    EnabledEnumPipe,
    DurationPipe,
    ReactiveFormsModule,
    HistoryMetricsComponent,
    SouthMetricsComponent,
    AsyncPipe,
    ClipboardModule,
    LogsComponent
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
  private modalService = inject(ModalService);
  private engineService = inject(EngineService);
  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private windowService = inject(WindowService);
  private cd = inject(ChangeDetectorRef);

  historyQuery: HistoryQueryDTO | null = null;
  northDisplayedSettings: Array<{ key: string; value: string }> = [];
  southDisplayedSettings: Array<{ key: string; value: string }> = [];

  scanModes: Array<ScanModeDTO> = [];
  searchParams: SouthConnectorItemSearchParam | null = null;
  northManifest: NorthConnectorManifest | null = null;
  southManifest: SouthConnectorManifest | null = null;
  historyQueryItems: Array<SouthConnectorItemDTO> = [];
  importing = false;
  exporting = false;

  historyMetrics: HistoryMetrics | null = null;
  historyStream: EventSource | null = null;
  state = new ObservableState();
  oibusInfo: OIBusInfo | null = null;
  historyQueryId: string | null = null;

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.engineService.getInfo()]).subscribe(([scanModes, engineInfo]) => {
      this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
      this.oibusInfo = engineInfo;
    });
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
            this.historyQueryService.listItems(historyQuery.id),
            this.northConnectorService.getNorthConnectorTypeManifest(historyQuery.northType),
            this.southConnectorService.getSouthConnectorTypeManifest(historyQuery.southType)
          ]);
        })
      )
      .subscribe(([historyItems, northManifest, southManifest]) => {
        if (!northManifest || !southManifest || !historyItems) {
          return;
        }

        this.connectToEventSource();

        this.northManifest = northManifest;
        this.northDisplayedSettings = northManifest.settings
          .filter(setting => setting.displayInViewMode)
          .map(setting => {
            return {
              key: setting.label,
              value: this.historyQuery!.northSettings[setting.key]
            };
          });

        this.southManifest = southManifest;
        this.southDisplayedSettings = southManifest.settings
          .filter(setting => setting.displayInViewMode)
          .map(setting => {
            return {
              key: setting.label,
              value: this.historyQuery!.southSettings[setting.key]
            };
          });
        this.historyQueryItems = historyItems;
      });
  }

  getScanMode(scanModeId: string) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }

  searchItem(searchParams: SouthConnectorItemSearchParam) {
    this.router.navigate(['.'], { queryParams: { page: 0, name: searchParams.name }, relativeTo: this.route });
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
    let command: SouthConnectorCommandDTO | NorthConnectorCommandDTO;
    if (type === 'south') {
      command = {
        type: this.southManifest!.id,
        settings: this.historyQuery!.southSettings
      } as SouthConnectorCommandDTO;
    } else {
      command = {
        type: this.northManifest!.id,
        settings: this.historyQuery!.northSettings
      } as NorthConnectorCommandDTO;
    }

    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runHistoryQueryTest(type, command, this.historyQuery!.id);
  }
}
