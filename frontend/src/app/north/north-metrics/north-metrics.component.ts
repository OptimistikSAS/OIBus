import { Component, Input, NgZone, OnInit } from '@angular/core';
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
import { Router } from '@angular/router';

@Component({
  selector: 'oib-north-metrics',
  templateUrl: './north-metrics.component.html',
  styleUrls: ['./north-metrics.component.scss'],
  imports: [TranslateModule, NgIf, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe, FileSizePipe],
  standalone: true
})
export class NorthMetricsComponent implements OnInit {
  @Input({ required: true }) northConnector!: NorthConnectorDTO;
  @Input() manifest: NorthConnectorManifest | null = null;
  @Input() displayButton = false;
  @Input({ required: true }) connectorMetrics!: NorthConnectorMetrics;

  constructor(
    private zone: NgZone,
    private router: Router,
    private northConnectorService: NorthConnectorService,
    private notificationService: NotificationService
  ) {}

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
