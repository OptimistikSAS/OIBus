import { Component, OnInit } from '@angular/core';
import { DecimalPipe, NgForOf, NgIf, NgSwitch } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, of, switchMap, tap } from 'rxjs';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { OibusItemDTO, OibusItemSearchParam, SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { HistoryQueryItemsComponent } from '../history-query-items/history-query-items.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EnabledEnumPipe } from '../../shared/enabled-enum.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { HistoryMetricsComponent } from './history-metrics/history-metrics.component';

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
    PaginationComponent,
    HistoryQueryItemsComponent,
    BoxComponent,
    BoxTitleDirective,
    EnabledEnumPipe,
    DurationPipe,
    ReactiveFormsModule,
    HistoryMetricsComponent
  ],
  templateUrl: './history-query-detail.component.html',
  styleUrls: ['./history-query-detail.component.scss'],
  providers: [PageLoader]
})
export class HistoryQueryDetailComponent implements OnInit {
  historyQuery: HistoryQueryDTO | null = null;
  northDisplayedSettings: Array<{ key: string; value: string }> = [];
  southDisplayedSettings: Array<{ key: string; value: string }> = [];

  scanModes: Array<ScanModeDTO> = [];
  searchParams: OibusItemSearchParam | null = null;
  northManifest: NorthConnectorManifest | null = null;
  southManifest: SouthConnectorManifest | null = null;
  historyQueryItems: Array<OibusItemDTO> = [];
  enabled = new FormControl(false);
  importing = false;
  exporting = false;

  constructor(
    private historyQueryService: HistoryQueryService,
    private northConnectorService: NorthConnectorService,
    private southConnectorService: SouthConnectorService,
    private scanModeService: ScanModeService,
    private notificationService: NotificationService,
    protected router: Router,
    private route: ActivatedRoute
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
          this.enabled.setValue(historyQuery.enabled, { emitEvent: false });
          this.enabled.valueChanges.subscribe(value => {
            this.toggleHistoryQuery(value!);
          });
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

        this.northManifest = northManifest;
        this.northDisplayedSettings = northManifest.settings
          .filter(setting => setting.readDisplay)
          .map(setting => {
            return {
              key: setting.label,
              value: this.historyQuery!.northSettings[setting.key]
            };
          });

        this.southManifest = southManifest;
        this.southDisplayedSettings = southManifest.settings
          .filter(setting => setting.readDisplay)
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

  searchItem(searchParams: OibusItemSearchParam) {
    this.router.navigate(['.'], { queryParams: { page: 0, name: searchParams.name }, relativeTo: this.route });
  }

  toggleHistoryQuery(value: boolean) {
    if (value) {
      this.historyQueryService
        .startHistoryQuery(this.historyQuery!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('history-query.started', { name: this.historyQuery!.name });
          }),
          switchMap(() => {
            return this.historyQueryService.get(this.historyQuery!.id);
          })
        )
        .subscribe(historyQuery => {
          this.historyQuery = historyQuery;
        });
    } else {
      this.historyQueryService
        .stopHistoryQuery(this.historyQuery!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('history-query.stopped', { name: this.historyQuery!.name });
          }),
          switchMap(() => {
            return this.historyQueryService.get(this.historyQuery!.id);
          })
        )
        .subscribe(historyQuery => {
          this.historyQuery = historyQuery;
        });
    }
  }
}
