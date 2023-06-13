import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { ConnectorMetrics } from '../../../../../shared/model/engine.model';
import { NgIf } from '@angular/common';
import { WindowService } from '../../shared/window.service';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { NotificationService } from '../../shared/notification.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';

@Component({
  selector: 'oib-south-metrics',
  templateUrl: './south-metrics.component.html',
  styleUrls: ['./south-metrics.component.scss'],
  imports: [TranslateModule, NgIf, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective],
  standalone: true
})
export class SouthMetricsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) southConnector!: SouthConnectorDTO;

  connectorMetrics: ConnectorMetrics | null = null;
  connectorStream: EventSource | null = null;

  constructor(
    private windowService: WindowService,
    private southService: SouthConnectorService,
    private notificationService: NotificationService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const token = this.windowService.getStorageItem('oibus-token');

    this.connectorStream = new EventSource(`/sse/south/${this.southConnector!.id}?token=${token}`, { withCredentials: true });
    this.connectorStream.onmessage = (event: MessageEvent) => {
      if (event && event.data) {
        this.connectorMetrics = JSON.parse(event.data);
        this.cd.detectChanges();
      }
    };
  }

  ngOnDestroy() {
    this.connectorStream?.close();
  }

  resetMetrics() {
    this.southService.resetMetrics(this.southConnector.id).subscribe(() => {
      this.notificationService.success('south.data.metrics-reset');
    });
  }
}
