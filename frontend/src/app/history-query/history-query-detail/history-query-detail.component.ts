import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { AsyncPipe, DecimalPipe, NgForOf, NgIf, NgSwitch } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, of, switchMap } from 'rxjs';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { HistoryQueryDTO, HistoryQueryStatus } from '../../../../../shared/model/history-query.model';
import {
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
import { HistoryMetrics } from '../../../../../shared/model/engine.model';
import { WindowService } from '../../shared/window.service';
import { NotificationService } from '../../shared/notification.service';
import { ObservableState } from '../../shared/save-button/save-button.component';

@Component({
  selector: 'oib-history-query-detail',
  standalone: true,
  imports: [
    NgIf,
    TranslateModule,
    RouterLink,
    NgSwitch,
    NgForOf,
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
    AsyncPipe
  ],
  templateUrl: './history-query-detail.component.html',
  styleUrls: ['./history-query-detail.component.scss'],
  providers: [PageLoader]
})
export class HistoryQueryDetailComponent implements OnInit, OnDestroy {
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

  constructor(
    private historyQueryService: HistoryQueryService,
    private northConnectorService: NorthConnectorService,
    private southConnectorService: SouthConnectorService,
    private notificationService: NotificationService,
    private scanModeService: ScanModeService,
    protected router: Router,
    private route: ActivatedRoute,
    private windowService: WindowService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.scanModeService.list().subscribe(scanModes => {
      this.scanModes = scanModes;
    });
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const paramHistoryQueryId = params.get('historyQueryId') || '';
          if (paramHistoryQueryId) {
            return this.historyQueryService.get(paramHistoryQueryId);
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
        });
    }
  }
}
