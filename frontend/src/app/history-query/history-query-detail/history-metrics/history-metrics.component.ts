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

@Component({
  selector: 'oib-history-metrics',
  templateUrl: './history-metrics.component.html',
  styleUrl: './history-metrics.component.scss',
  imports: [TranslateModule, NgIf, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe],
  standalone: true
})
export class HistoryMetricsComponent {
  @Input({ required: true }) historyQuery!: HistoryQueryDTO;
  @Input({ required: true }) northManifest!: NorthConnectorManifest;
  @Input({ required: true }) southManifest!: SouthConnectorManifest;
  @Input({ required: true }) historyMetrics!: HistoryMetrics;

  constructor() {}
}
