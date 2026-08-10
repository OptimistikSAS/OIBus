import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { HistoryQueryMetrics } from '../../../../../../backend/shared/model/engine.model';
import { DecimalPipe, JsonPipe } from '@angular/common';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    TranslateDirective,
    DatetimePipe,
    DurationPipe,
    BoxComponent,
    BoxTitleDirective,
    JsonPipe,
    ProgressbarComponent,
    FileSizePipe,
    DecimalPipe
  ]
})
export class HistoryMetricsComponent {
  readonly historyQuery = input.required<HistoryQueryDTO>();
  readonly northManifest = input.required<NorthConnectorManifest>();
  readonly southManifest = input.required<SouthConnectorManifest>();
  readonly historyMetrics = input.required<HistoryQueryMetrics>();
  readonly southProgressbarAnimated = computed(
    () => this.historyQuery().status === 'RUNNING' && this.historyMetrics().historyMetrics.intervalProgress !== 1
  );

  /**
   * Whether the payload carries per-item progress fields. Only connectors that query items one at a
   * time (SOUTH_SINGLE_ITEMS, decided backend-side) populate `numberOfItems`, so this is gated purely
   * on the shape of the payload rather than duplicating the connector-type list on the frontend.
   */
  readonly hasItemProgress = computed(() => (this.historyMetrics().historyMetrics.numberOfItems ?? 0) > 0);

  readonly itemProgressbarAnimated = computed(() => {
    const historyMetrics = this.historyMetrics().historyMetrics;
    const progress = (historyMetrics.currentItemNumber ?? 0) / (historyMetrics.numberOfItems ?? 1);
    return this.historyQuery().status === 'RUNNING' && progress !== 1;
  });

  readonly itemIntervalProgressbarAnimated = computed(
    () => this.historyQuery().status === 'RUNNING' && this.historyMetrics().historyMetrics.itemIntervalProgress !== 1
  );

  /**
   * Values + files retrieved per second since metrics collection started.
   */
  readonly southRate = computed(() => {
    const elapsedSeconds = (Date.now() - Date.parse(this.historyMetrics().metricsStart)) / 1000;
    if (!elapsedSeconds) {
      return 0;
    }
    const totalRetrieved = this.historyMetrics().south.numberOfValuesRetrieved + this.historyMetrics().south.numberOfFilesRetrieved;
    return totalRetrieved / elapsedSeconds;
  });

  /**
   * Rough ETA in seconds, extrapolated from the ratcheted `intervalProgress` and the elapsed time since
   * metrics collection started. Since `intervalProgress` is monotonic (never regresses, even across
   * restarts), extrapolating from elapsed-so-far / progress-so-far stays stable across restarts.
   */
  readonly southEta = computed(() => {
    const historyMetrics = this.historyMetrics().historyMetrics;
    if (!historyMetrics.running || !historyMetrics.intervalProgress) {
      return null;
    }
    const elapsedSeconds = (Date.now() - Date.parse(this.historyMetrics().metricsStart)) / 1000;
    if (!elapsedSeconds) {
      return null;
    }
    const remainingFraction = 1 - historyMetrics.intervalProgress;
    return (elapsedSeconds / historyMetrics.intervalProgress) * remainingFraction;
  });

  get northProgress() {
    return this.historyMetrics().north.contentSentSize / this.historyMetrics().north.contentCachedSize;
  }

  get northProgressbarAnimated(): boolean {
    return this.historyQuery().status === 'RUNNING' && this.northProgress < 1;
  }
}
