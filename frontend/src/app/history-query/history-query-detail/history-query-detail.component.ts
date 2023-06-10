import { Component, OnInit } from '@angular/core';
import { DecimalPipe, NgForOf, NgIf, NgSwitch } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, of, switchMap } from 'rxjs';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { checkInputValue, getRowSettings } from '../../shared/utils';
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
    DurationPipe
  ],
  templateUrl: './history-query-detail.component.html',
  styleUrls: ['./history-query-detail.component.scss'],
  providers: [PageLoader]
})
export class HistoryQueryDetailComponent implements OnInit {
  historyQuery: HistoryQueryDTO | null = null;
  northSettingsSchema: Array<Array<OibFormControl>> = [];
  southSettingsSchema: Array<Array<OibFormControl>> = [];

  scanModes: Array<ScanModeDTO> = [];
  searchParams: OibusItemSearchParam | null = null;
  northManifest: NorthConnectorManifest | null = null;
  southManifest: SouthConnectorManifest | null = null;
  historyQueryItems: Array<OibusItemDTO> = [];
  importing = false;
  exporting = false;

  constructor(
    private historyQueryService: HistoryQueryService,
    private northConnectorService: NorthConnectorService,
    private southConnectorService: SouthConnectorService,
    private scanModeService: ScanModeService,
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
        this.northSettingsSchema = getRowSettings(northManifest.settings, this.historyQuery!.northSettings);
        this.southSettingsSchema = getRowSettings(southManifest.settings, this.historyQuery!.southSettings);
        this.southManifest = southManifest;
        this.historyQueryItems = historyItems;
      });
  }

  shouldDisplayInput(formSettings: OibFormControl, settingsValues: any) {
    return (
      formSettings.readDisplay &&
      (!formSettings.conditionalDisplay ||
        Object.entries(formSettings.conditionalDisplay).every(([key, values]) => {
          return values && checkInputValue(values, settingsValues[key]);
        }))
    );
  }

  getScanMode(scanModeId: string) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }

  searchItem(searchParams: OibusItemSearchParam) {
    this.router.navigate(['.'], { queryParams: { page: 0, name: searchParams.name }, relativeTo: this.route });
  }
}
