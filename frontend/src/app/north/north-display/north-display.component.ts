import { Component, OnInit } from '@angular/core';
import { DecimalPipe, NgForOf, NgIf, NgSwitch } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { getRowSettings } from '../../shared/utils';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';

@Component({
  selector: 'oib-north-display',
  standalone: true,
  imports: [NgIf, TranslateModule, RouterLink, NgSwitch, NgForOf, DecimalPipe],
  templateUrl: './north-display.component.html',
  styleUrls: ['./north-display.component.scss'],
  providers: [PageLoader]
})
export class NorthDisplayComponent implements OnInit {
  northConnector: NorthConnectorDTO | null = null;
  northSettingsSchema: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  manifest: NorthConnectorManifest | null = null;

  constructor(
    private northConnectorService: NorthConnectorService,
    private scanModeService: ScanModeService,
    protected router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.scanModeService.getScanModes().subscribe(scanModes => {
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
        this.northSettingsSchema = getRowSettings(manifest.settings, this.northConnector?.settings);
        this.manifest = manifest;
      });
  }

  shouldDisplayInput(settings: OibFormControl) {
    return (
      settings.readDisplay &&
      (!settings.conditionalDisplay ||
        Object.entries(settings.conditionalDisplay).every(([key, values]) => {
          return this.northConnector && values.includes(this.northConnector.settings[key]);
        }))
    );
  }

  getScanMode(scanModeId: string) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }
}
