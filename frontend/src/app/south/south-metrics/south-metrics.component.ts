import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorDTO, SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorMetrics } from '../../../../../shared/model/engine.model';
import { JsonPipe, NgIf } from '@angular/common';
import { WindowService } from '../../shared/window.service';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { NotificationService } from '../../shared/notification.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'oib-south-metrics',
  templateUrl: './south-metrics.component.html',
  styleUrls: ['./south-metrics.component.scss'],
  imports: [TranslateModule, NgIf, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe, RouterLink],
  standalone: true
})
export class SouthMetricsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) southConnector!: SouthConnectorDTO;
  @Input() manifest: SouthConnectorManifest | null = null;
  @Input() displayButton = false;

  connectorMetrics: SouthConnectorMetrics | null = null;
  connectorStream: EventSource | null = null;

  constructor(
    private windowService: WindowService,
    private southService: SouthConnectorService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (!this.manifest) {
      this.southService.getSouthConnectorTypeManifest(this.southConnector.type).subscribe(manifest => {
        this.manifest = manifest;
        this.connectToEventSource();
      });
    } else {
      this.connectToEventSource();
    }
  }

  connectToEventSource(): void {
    const token = this.windowService.getStorageItem('oibus-token');
    this.connectorStream = new EventSource(`/sse/south/${this.southConnector.id}?token=${token}`, { withCredentials: true });
    this.connectorStream.addEventListener('message', (event: MessageEvent) => {
      if (event && event.data) {
        this.connectorMetrics = JSON.parse(event.data);
      }
    });
  }

  ngOnDestroy() {
    this.connectorStream?.close();
  }

  resetMetrics() {
    this.southService.resetMetrics(this.southConnector.id).subscribe(() => {
      this.notificationService.success('south.monitoring.metrics-reset');
    });
  }
}
