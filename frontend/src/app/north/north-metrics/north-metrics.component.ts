import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { NorthConnectorLightDTO } from '@oibus/shared/api/north-connector.model';
import { NorthConnectorManifest } from '@oibus/shared/connector/north-manifest.model';
import { NorthConnectorMetrics } from '@oibus/shared/domain/engine.model';

import { NorthConnectorService } from '../../services/north-connector.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { NotificationService } from '../../shared/notification.service';

@Component({
  selector: 'oib-north-metrics',
  templateUrl: './north-metrics.component.html',
  styleUrl: './north-metrics.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, FileSizePipe, NgbTooltip, TranslatePipe]
})
export class NorthMetricsComponent implements OnInit {
  private zone = inject(NgZone);
  private router = inject(Router);
  private northConnectorService = inject(NorthConnectorService);
  private notificationService = inject(NotificationService);

  readonly northConnector = input.required<NorthConnectorLightDTO>();
  readonly manifest = input<NorthConnectorManifest | null>(null);
  readonly manifestOrNorthConnectorTypeManifest = linkedSignal(() => this.manifest());
  readonly displayButton = input(false);
  readonly connectorMetrics = input.required<NorthConnectorMetrics>();

  ngOnInit(): void {
    if (!this.manifest()) {
      this.northConnectorService.getNorthManifest(this.northConnector().type).subscribe(manifest => {
        this.manifestOrNorthConnectorTypeManifest.set(manifest);
      });
    }
  }

  resetMetrics() {
    this.zone.run(() => {
      this.northConnectorService.resetMetrics(this.northConnector().id).subscribe(() => {
        this.notificationService.success('north.monitoring.metrics-reset');
      });
    });
  }

  navigateToDisplay() {
    this.zone.run(() => {
      this.router.navigate(['/north', this.northConnector().id]);
    });
  }
}
