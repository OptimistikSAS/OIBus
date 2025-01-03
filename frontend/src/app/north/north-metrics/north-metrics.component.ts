import { Component, NgZone, OnInit, inject, input, linkedSignal } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { NorthConnectorMetrics } from '../../../../../backend/shared/model/engine.model';
import { JsonPipe } from '@angular/common';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { NorthConnectorLightDTO, NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NotificationService } from '../../shared/notification.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { Router } from '@angular/router';

@Component({
  selector: 'oib-north-metrics',
  templateUrl: './north-metrics.component.html',
  styleUrl: './north-metrics.component.scss',
  imports: [TranslateDirective, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe, FileSizePipe]
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
      this.northConnectorService.getNorthConnectorTypeManifest(this.northConnector().type).subscribe(manifest => {
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
