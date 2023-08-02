import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { EngineMetrics } from '../../../../../shared/model/engine.model';
import { DatePipe, JsonPipe, NgIf, PercentPipe } from '@angular/common';
import { WindowService } from '../../shared/window.service';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { NotificationService } from '../../shared/notification.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EngineService } from '../../services/engine.service';
import { FileSizePipe } from '../../shared/file-size.pipe';

@Component({
  selector: 'oib-engine-metrics',
  templateUrl: './engine-metrics.component.html',
  styleUrls: ['./engine-metrics.component.scss'],
  imports: [
    TranslateModule,
    NgIf,
    DatetimePipe,
    DurationPipe,
    BoxComponent,
    BoxTitleDirective,
    JsonPipe,
    DatePipe,
    PercentPipe,
    FileSizePipe
  ],
  standalone: true
})
export class EngineMetricsComponent implements OnInit, OnDestroy {
  metrics: EngineMetrics | null = null;
  connectorStream: EventSource | null = null;

  constructor(
    private windowService: WindowService,
    private engineService: EngineService,
    private notificationService: NotificationService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const token = this.windowService.getStorageItem('oibus-token');

    this.connectorStream = new EventSource(`/sse/engine?token=${token}`, { withCredentials: true });
    this.connectorStream.onmessage = (event: MessageEvent) => {
      if (event && event.data) {
        this.metrics = JSON.parse(event.data);
        this.cd.detectChanges();
      }
    };
  }

  ngOnDestroy() {
    this.connectorStream?.close();
  }

  resetMetrics() {
    this.engineService.resetMetrics().subscribe(() => {
      this.notificationService.success('engine.monitoring.metrics-reset');
    });
  }
}
