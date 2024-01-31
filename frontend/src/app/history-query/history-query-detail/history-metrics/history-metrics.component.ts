import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { HistoryMetrics } from '../../../../../../shared/model/engine.model';
import { JsonPipe, NgIf } from '@angular/common';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { DurationPipe } from '../../../shared/duration.pipe';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { HistoryQueryDTO } from '../../../../../../shared/model/history-query.model';
import { NorthConnectorManifest } from '../../../../../../shared/model/north-connector.model';
import { SouthConnectorManifest } from '../../../../../../shared/model/south-connector.model';
import { ProgressbarComponent } from './progressbar/progressbar.component';

@Component({
  selector: 'oib-history-metrics',
  templateUrl: './history-metrics.component.html',
  styleUrl: './history-metrics.component.scss',
  imports: [TranslateModule, NgIf, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe, ProgressbarComponent],
  standalone: true
})
export class HistoryMetricsComponent {
  @Input({ required: true }) historyQuery!: HistoryQueryDTO;
  @Input({ required: true }) northManifest!: NorthConnectorManifest;
  @Input({ required: true }) southManifest!: SouthConnectorManifest;
  @Input({ required: true }) historyMetrics!: HistoryMetrics;

  constructor() {}

  get southProgressbarAnimated(): boolean {
    if (this.historyQuery.status === 'RUNNING' && this.historyMetrics.south.historyMetrics.intervalProgress !== 1) {
      return true;
    }
    return false;
  }

  get northProgress() {
    const valueProgress = this.historyMetrics.north.numberOfValuesSent / this.historyMetrics.south.numberOfValuesRetrieved;
    const fileProgress = this.historyMetrics.north.numberOfFilesSent / this.historyMetrics.south.numberOfFilesRetrieved;

    return valueProgress > 0 ? valueProgress : fileProgress;
  }

  get northProgressbarAnimated(): boolean {
    if (this.historyQuery.status === 'RUNNING' && this.northProgress !== 1) {
      return true;
    }
    return false;
  }
}
