import { Component, OnInit } from '@angular/core';
import { DecimalPipe, NgForOf, NgIf, NgSwitch } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, of, switchMap } from 'rxjs';
import { OibFormControl } from '../../model/form.model';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorManifest } from '../../model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { getRowSettings } from '../../shared/utils';
import { ScanModeDTO } from '../../model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { HistoryQueryDTO } from '../../model/history-query.model';
import { SouthConnectorManifest } from '../../model/south-connector.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { SouthConnectorService } from '../../services/south-connector.service';

@Component({
  selector: 'oib-history-query-display',
  standalone: true,
  imports: [NgIf, TranslateModule, RouterLink, NgSwitch, NgForOf, DecimalPipe],
  templateUrl: './history-query-display.component.html',
  styleUrls: ['./history-query-display.component.scss'],
  providers: [PageLoader]
})
export class HistoryQueryDisplayComponent implements OnInit {
  historyQuery: HistoryQueryDTO | null = null;
  northSettingsSchema: Array<Array<OibFormControl>> = [];
  southSettingsSchema: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  northManifest: NorthConnectorManifest | null = null;
  southManifest: SouthConnectorManifest | null = null;

  constructor(
    private historyQueryService: HistoryQueryService,
    private northConnectorService: NorthConnectorService,
    private southConnectorService: SouthConnectorService,
    private scanModeService: ScanModeService,
    protected router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.scanModeService.getScanModes().subscribe(scanModes => {
      this.scanModes = scanModes;
    });
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const paramHistoryQueryId = params.get('historyQueryId');

          if (paramHistoryQueryId) {
            return this.historyQueryService.getHistoryQuery(paramHistoryQueryId);
          }
          return of(null);
        }),
        switchMap(historyQuery => {
          if (!historyQuery) {
            return combineLatest([of(null), of(null)]);
          }
          this.historyQuery = historyQuery;
          return combineLatest([
            this.northConnectorService.getNorthConnectorTypeManifest(this.historyQuery!.northType),
            this.southConnectorService.getSouthConnectorTypeManifest(this.historyQuery!.southType)
          ]);
        })
      )
      .subscribe(([northManifest, southManifest]) => {
        if (!northManifest || !southManifest) {
          return;
        }
        const northRowList = getRowSettings(northManifest.settings, this.historyQuery?.northSettings);
        const southRowList = getRowSettings(southManifest.settings, this.historyQuery?.southSettings);

        this.northSettingsSchema = northRowList;
        this.southSettingsSchema = southRowList;
        this.northManifest = northManifest;
        this.southManifest = southManifest;
      });
  }

  shouldDisplayInput(formSettings: OibFormControl, settingsValues: any) {
    return (
      formSettings.readDisplay &&
      (!formSettings.conditionalDisplay ||
        Object.entries(formSettings.conditionalDisplay).every(([key, values]) => {
          return values && values.includes(settingsValues[key]);
        }))
    );
  }

  getScanMode(scanModeId: string) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }
}
