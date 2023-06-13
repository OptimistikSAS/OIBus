import { Component, OnInit } from '@angular/core';
import { DecimalPipe, NgForOf, NgIf, NgSwitch } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { checkInputValue, getRowSettings } from '../../shared/utils';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { NorthSubscriptionsComponent } from '../north-subscriptions/north-subscriptions.component';
import { NorthMetricsComponent } from './north-metrics/north-metrics.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DurationPipe } from '../../shared/duration.pipe';
import { EnabledEnumPipe } from '../../shared/enabled-enum.pipe';

@Component({
  selector: 'oib-north-detail',
  standalone: true,
  imports: [
    NgIf,
    TranslateModule,
    RouterLink,
    NgSwitch,
    NgForOf,
    DecimalPipe,
    NorthSubscriptionsComponent,
    NorthMetricsComponent,
    BoxComponent,
    BoxTitleDirective,
    DurationPipe,
    EnabledEnumPipe
  ],
  templateUrl: './north-detail.component.html',
  styleUrls: ['./north-detail.component.scss'],
  providers: [PageLoader]
})
export class NorthDetailComponent implements OnInit {
  northConnector: NorthConnectorDTO | null = null;
  settings: Array<OibFormControl> = [];
  scanModes: Array<ScanModeDTO> = [];
  manifest: NorthConnectorManifest | null = null;

  constructor(
    private northConnectorService: NorthConnectorService,
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
          const paramNorthId = params.get('northId');

          if (paramNorthId) {
            return this.northConnectorService.getNorthConnector(paramNorthId);
          }
          return of(null);
        }),
        switchMap(northConnector => {
          if (!northConnector) {
            return of(null);
          }
          this.northConnector = northConnector;
          return this.northConnectorService.getNorthConnectorTypeManifest(this.northConnector!.type);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          return;
        }
        this.settings = getRowSettings(manifest.settings, this.northConnector?.settings)
          .flat()
          .filter(setting => this.shouldDisplayInput(setting));
        this.manifest = manifest;
      });
  }

  shouldDisplayInput(settings: OibFormControl) {
    return (
      settings.readDisplay &&
      settings.type !== 'OibSecret' &&
      (!settings.conditionalDisplay ||
        Object.entries(settings.conditionalDisplay).every(([key, values]) => {
          return this.northConnector && checkInputValue(values, this.northConnector.settings[key]);
        }))
    );
  }

  getScanMode(scanModeId: string) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }
}
