import { Component, OnInit } from '@angular/core';
import { DecimalPipe, NgForOf, NgIf, NgSwitch } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { PageLoader } from '../../shared/page-loader.service';
import { NorthConnectorDTO, NorthConnectorCommandDTO, NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { NorthSubscriptionsComponent } from '../north-subscriptions/north-subscriptions.component';
import { NorthMetricsComponent } from '../north-metrics/north-metrics.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DurationPipe } from '../../shared/duration.pipe';
import { EnabledEnumPipe } from '../../shared/enabled-enum.pipe';
import { NotificationService } from '../../shared/notification.service';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';

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
    BackNavigationDirective,
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
  displayedSettings: Array<{ key: string; value: string }> = [];
  scanModes: Array<ScanModeDTO> = [];
  manifest: NorthConnectorManifest | null = null;

  constructor(
    private northConnectorService: NorthConnectorService,
    private scanModeService: ScanModeService,
    private notificationService: NotificationService,
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
        this.displayedSettings = manifest.settings
          .filter(setting => setting.displayInViewMode)
          .map(setting => {
            return {
              key: setting.label,
              value: this.northConnector!.settings[setting.key]
            };
          });
        this.manifest = manifest;
      });
  }

  getScanMode(scanModeId: string) {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId)?.name || scanModeId;
  }

  testConnection() {
    const command: NorthConnectorCommandDTO = {
      name: this.northConnector!.name,
      type: this.northConnector!.type,
      description: this.northConnector!.description,
      enabled: this.northConnector!.enabled,
      settings: this.northConnector!.settings,
      caching: this.northConnector!.caching,
      archive: this.northConnector!.archive
    };

    this.northConnectorService
      .testConnection(this.northConnector!.id, command)
      .pipe(
        catchError(httpError => {
          this.notificationService.error('north.test-connection.failure', { error: httpError.error.message });
          throw httpError;
        })
      )
      .subscribe(() => {
        this.notificationService.success('north.test-connection.success');
      });
  }

  toggleConnector(value: boolean) {
    if (value) {
      this.northConnectorService
        .startNorth(this.northConnector!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('north.started', { name: this.northConnector!.name });
          }),
          switchMap(() => {
            return this.northConnectorService.getNorthConnector(this.northConnector!.id);
          })
        )
        .subscribe(northConnector => {
          this.northConnector = northConnector;
        });
    } else {
      this.northConnectorService
        .stopNorth(this.northConnector!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('north.stopped', { name: this.northConnector!.name });
          }),
          switchMap(() => {
            return this.northConnectorService.getNorthConnector(this.northConnector!.id);
          })
        )
        .subscribe(northConnector => {
          this.northConnector = northConnector;
        });
    }
  }
}
