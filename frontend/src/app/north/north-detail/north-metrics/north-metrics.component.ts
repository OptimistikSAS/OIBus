import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NorthConnectorMetrics } from '../../../../../../shared/model/engine.model';
import { JsonPipe, NgIf } from '@angular/common';
import { WindowService } from '../../../shared/window.service';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { DurationPipe } from '../../../shared/duration.pipe';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { NotificationService } from '../../../shared/notification.service';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { FileSizePipe } from '../../../shared/file-size.pipe';

@Component({
  selector: 'oib-north-metrics',
  templateUrl: './north-metrics.component.html',
  styleUrls: ['./north-metrics.component.scss'],
  imports: [TranslateModule, NgIf, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe, FileSizePipe],
  standalone: true
})
export class NorthMetricsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) northConnector!: NorthConnectorDTO;
  @Input({ required: true }) manifest!: NorthConnectorManifest;

  connectorMetrics: NorthConnectorMetrics | null = null;
  connectorStream: EventSource | null = null;

  constructor(
    private windowService: WindowService,
    private northConnectorService: NorthConnectorService,
    private notificationService: NotificationService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const token = this.windowService.getStorageItem('oibus-token');

    this.connectorStream = new EventSource(`/sse/north/${this.northConnector!.id}?token=${token}`, { withCredentials: true });
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
    this.northConnectorService.resetMetrics(this.northConnector.id).subscribe(() => {
      this.notificationService.success('north.monitoring.metrics-reset');
    });
  }
}
