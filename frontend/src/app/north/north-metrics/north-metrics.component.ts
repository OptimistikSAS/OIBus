import { Component, Input, NgZone, OnInit, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
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
  imports: [TranslateModule, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe, FileSizePipe],
  standalone: true
})
export class NorthMetricsComponent implements OnInit {
  private zone = inject(NgZone);
  private router = inject(Router);
  private northConnectorService = inject(NorthConnectorService);
  private notificationService = inject(NotificationService);

  @Input({ required: true }) northConnector!: NorthConnectorLightDTO;
  @Input() manifest: NorthConnectorManifest | null = null;
  @Input() displayButton = false;
  @Input({ required: true }) connectorMetrics!: NorthConnectorMetrics;

  ngOnInit(): void {
    if (!this.manifest) {
      this.northConnectorService.getNorthConnectorTypeManifest(this.northConnector.type).subscribe(manifest => {
        this.manifest = manifest;
      });
    }
  }

  resetMetrics() {
    this.zone.run(() => {
      this.northConnectorService.resetMetrics(this.northConnector.id).subscribe(() => {
        this.notificationService.success('north.monitoring.metrics-reset');
      });
    });
  }

  navigateToDisplay() {
    this.zone.run(() => {
      this.router.navigate(['/north', this.northConnector.id]);
    });
  }
}
