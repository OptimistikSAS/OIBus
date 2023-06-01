import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf, NgSwitch } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { OibusItemManifest, SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PageLoader } from '../../shared/page-loader.service';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { getRowSettings } from '../../shared/utils';
import { SouthMetricsComponent } from '../south-metrics/south-metrics.component';
import { NorthMetricsComponent } from '../../north/north-detail/north-metrics/north-metrics.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EnabledEnumPipe } from '../../shared/enabled-enum.pipe';
import { SouthItemsComponent } from '../south-items/south-items.component';

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
export class SouthDetailComponent implements OnInit {
  southConnector: SouthConnectorDTO | null = null;
  settings: Array<OibFormControl> = [];
  southItemSchema: OibusItemManifest | null = null;
  scanModes: Array<ScanModeDTO> = [];

  constructor(
    private southConnectorService: SouthConnectorService,
    private scanModeService: ScanModeService,
    protected router: Router,
    private route: ActivatedRoute
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
        this.southItemSchema = manifest.items;
        this.settings = getRowSettings(manifest.settings, this.southConnector?.settings)
          .flat()
          .filter(setting => this.shouldDisplayInput(setting));
      });
  }

  shouldDisplayInput(settings: OibFormControl) {
    return (
      settings.readDisplay &&
      (!settings.conditionalDisplay ||
        Object.entries(settings.conditionalDisplay).every(([key, values]) => {
          return this.southConnector && values.includes(this.southConnector.settings[key]);
        }))
    );
  }

  getScanMode(scanModeId: string | undefined) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }
}
