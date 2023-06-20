import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { HistoryMetrics } from '../../../../../../shared/model/engine.model';
import { JsonPipe, NgIf } from '@angular/common';
import { WindowService } from '../../../shared/window.service';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { DurationPipe } from '../../../shared/duration.pipe';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { HistoryQueryDTO } from '../../../../../../shared/model/history-query.model';
import { NorthConnectorManifest } from '../../../../../../shared/model/north-connector.model';
import { SouthConnectorManifest } from '../../../../../../shared/model/south-connector.model';

@Component({
  selector: 'oib-history-metrics',
  templateUrl: './history-metrics.component.html',
  styleUrls: ['./history-metrics.component.scss'],
  imports: [TranslateModule, NgIf, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe],
  standalone: true
})
export class HistoryMetricsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) historyQuery!: HistoryQueryDTO;
  @Input({ required: true }) northManifest!: NorthConnectorManifest;
  @Input({ required: true }) southManifest!: SouthConnectorManifest;

  historyMetrics: HistoryMetrics | null = null;
  stream: EventSource | null = null;

  constructor(private windowService: WindowService, private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    const token = this.windowService.getStorageItem('oibus-token');

    this.stream = new EventSource(`/sse/history-queries/${this.historyQuery!.id}?token=${token}`, { withCredentials: true });
    this.stream.onmessage = (event: MessageEvent) => {
      if (event && event.data) {
        this.historyMetrics = JSON.parse(event.data);
        this.cd.detectChanges();
      }
    };
  }

  ngOnDestroy() {
    this.stream?.close();
  }
}
