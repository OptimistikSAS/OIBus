import { Component, computed, input } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { HistoryQueryMetrics } from '../../../../../../backend/shared/model/engine.model';
import { JsonPipe } from '@angular/common';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { DurationPipe } from '../../../shared/duration.pipe';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { HistoryQueryDTO } from '../../../../../../backend/shared/model/history-query.model';
import { NorthConnectorManifest } from '../../../../../../backend/shared/model/north-connector.model';
import { SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';
import { ProgressbarComponent } from './progressbar/progressbar.component';
import { FileSizePipe } from '../../../shared/file-size.pipe';

@Component({
  selector: 'oib-history-metrics',
  templateUrl: './history-metrics.component.html',
  styleUrl: './history-metrics.component.scss',
  imports: [TranslateDirective, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe, ProgressbarComponent, FileSizePipe]
})
export class HistoryMetricsComponent {
  readonly historyQuery = input.required<HistoryQueryDTO>();
  readonly northManifest = input.required<NorthConnectorManifest>();
  readonly southManifest = input.required<SouthConnectorManifest>();
  readonly historyMetrics = input.required<HistoryQueryMetrics>();
  readonly southProgressbarAnimated = computed(
    () => this.historyQuery().status === 'RUNNING' && this.historyMetrics().historyMetrics.intervalProgress !== 1
  );

  get northProgress() {
    return this.historyMetrics().north.contentSentSize / this.historyMetrics().north.contentCachedSize;
  }

  get northProgressbarAnimated(): boolean {
    return this.historyQuery().status === 'RUNNING' && this.northProgress < 1;
  }
}
