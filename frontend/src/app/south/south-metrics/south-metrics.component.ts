import { Component, NgZone, OnInit, inject, input, linkedSignal } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { SouthConnectorLightDTO, SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorMetrics } from '../../../../../backend/shared/model/engine.model';
import { JsonPipe } from '@angular/common';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { NotificationService } from '../../shared/notification.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { Router } from '@angular/router';

@Component({
  selector: 'oib-south-metrics',
  templateUrl: './south-metrics.component.html',
  styleUrl: './south-metrics.component.scss',
  imports: [TranslateDirective, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe]
})
export class SouthMetricsComponent implements OnInit {
  private zone = inject(NgZone);
  private router = inject(Router);
  private southService = inject(SouthConnectorService);
  private notificationService = inject(NotificationService);

  readonly southConnector = input.required<SouthConnectorLightDTO>();
  readonly manifest = input<SouthConnectorManifest | null>(null);
  readonly manifestOrSouthConnectorTypeManifest = linkedSignal(() => this.manifest());
  readonly displayButton = input(false);
  readonly connectorMetrics = input.required<SouthConnectorMetrics>();

  ngOnInit(): void {
    if (!this.manifest()) {
      this.southService.getSouthConnectorTypeManifest(this.southConnector().type).subscribe(manifest => {
        this.manifestOrSouthConnectorTypeManifest.set(manifest);
      });
    }
  }

  resetMetrics() {
    this.zone.run(() => {
      this.southService.resetMetrics(this.southConnector().id).subscribe(() => {
        this.notificationService.success('south.monitoring.metrics-reset');
      });
    });
  }

  navigateToDisplay() {
    this.zone.run(() => {
      this.router.navigate(['/south', this.southConnector().id]);
    });
  }
}
