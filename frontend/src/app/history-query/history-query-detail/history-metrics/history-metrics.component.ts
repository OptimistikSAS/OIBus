import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { HistoryQueryMetrics } from '../../../../../../backend/shared/model/engine.model';
import { JsonPipe } from '@angular/common';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { DurationPipe } from '../../../shared/duration.pipe';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { HistoryQueryDTO } from '../../../../../../backend/shared/model/history-query.model';
import { NorthConnectorManifest } from '../../../../../../backend/shared/model/north-connector.model';
import { SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';
import { ProgressbarComponent } from './progressbar/progressbar.component';
import { SouthItemSettings, SouthSettings } from '../../../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';

@Component({
  selector: 'oib-history-metrics',
  templateUrl: './history-metrics.component.html',
  styleUrl: './history-metrics.component.scss',
  imports: [TranslateModule, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe, ProgressbarComponent],
  standalone: true
})
export class HistoryMetricsComponent {
  @Input({ required: true }) historyQuery!: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>;
  @Input({ required: true }) northManifest!: NorthConnectorManifest;
  @Input({ required: true }) southManifest!: SouthConnectorManifest;
  @Input({ required: true }) historyMetrics!: HistoryQueryMetrics;

  constructor() {}

  get southProgressbarAnimated(): boolean {
    return this.historyQuery.status === 'RUNNING' && this.historyMetrics.historyMetrics.intervalProgress !== 1;
  }

  get northProgress() {
    const valueProgress = this.historyMetrics.north.numberOfValuesSent / this.historyMetrics.south.numberOfValuesRetrieved;
    const fileProgress = this.historyMetrics.north.numberOfFilesSent / this.historyMetrics.south.numberOfFilesRetrieved;

    return valueProgress > 0 ? valueProgress : fileProgress;
  }

  get northProgressbarAnimated(): boolean {
    return this.historyQuery.status === 'RUNNING' && this.northProgress < 1;
  }
}
