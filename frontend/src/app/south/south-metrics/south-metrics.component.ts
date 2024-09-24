import { Component, Input, NgZone, OnInit, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorDTO, SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorMetrics } from '../../../../../shared/model/engine.model';
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
  standalone: true,
  imports: [TranslateModule, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe]
})
export class SouthMetricsComponent implements OnInit {
  private zone = inject(NgZone);
  private router = inject(Router);
  private southService = inject(SouthConnectorService);
  private notificationService = inject(NotificationService);

  @Input({ required: true }) southConnector!: SouthConnectorDTO;
  @Input() manifest: SouthConnectorManifest | null = null;
  @Input() displayButton = false;
  @Input({ required: true }) connectorMetrics!: SouthConnectorMetrics;

  ngOnInit(): void {
    if (!this.manifest) {
      this.southService.getSouthConnectorTypeManifest(this.southConnector.type).subscribe(manifest => {
        this.manifest = manifest;
      });
    }
  }

  resetMetrics() {
    this.zone.run(() => {
      this.southService.resetMetrics(this.southConnector.id).subscribe(() => {
        this.notificationService.success('south.monitoring.metrics-reset');
      });
    });
  }

  navigateToDisplay() {
    this.zone.run(() => {
      this.router.navigate(['/south', this.southConnector.id]);
    });
  }
}
