import { Component, Input, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NorthConnectorMetrics } from '../../../../../shared/model/engine.model';
import { JsonPipe, NgIf } from '@angular/common';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NotificationService } from '../../shared/notification.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'oib-north-metrics',
  templateUrl: './north-metrics.component.html',
  styleUrls: ['./north-metrics.component.scss'],
  imports: [TranslateModule, NgIf, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe, FileSizePipe, RouterLink],
  standalone: true
})
export class NorthMetricsComponent implements OnInit {
  @Input({ required: true }) northConnector!: NorthConnectorDTO;
  @Input() manifest: NorthConnectorManifest | null = null;
  @Input() displayButton = false;
  @Input({ required: true }) connectorMetrics!: NorthConnectorMetrics;

  constructor(private northConnectorService: NorthConnectorService, private notificationService: NotificationService) {}

  ngOnInit(): void {
    if (!this.manifest) {
      this.northConnectorService.getNorthConnectorTypeManifest(this.northConnector.type).subscribe(manifest => {
        this.manifest = manifest;
      });
    }
  }

  resetMetrics() {
    this.northConnectorService.resetMetrics(this.northConnector.id).subscribe(() => {
      this.notificationService.success('north.monitoring.metrics-reset');
    });
  }
}
