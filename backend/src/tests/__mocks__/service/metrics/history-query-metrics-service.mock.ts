import { mock } from 'node:test';
import { HistoryQueryMetrics } from '../../../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';
import HistoryQueryMetricsService from '../../../../service/metrics/history-query-metrics.service';
import HistoryQueryMock from '../../history-query.mock';
import type HistoryQueryMetricsRepository from '../../../../repository/metrics/history-query-metrics.repository';
import type { HistoryQueryEntity } from '../../../../model/histor-query.model';
import type { SouthSettings, SouthItemSettings } from '../../../../../shared/model/south-settings.model';
import type { NorthSettings } from '../../../../../shared/model/north-settings.model';

/**
 * Create a mock object for History Query Metrics Service
 */
export default class HistoryQueryMetricsServiceMock extends HistoryQueryMetricsService {
  // Prototype method — intercepted during super() to suppress repo calls
  override initMetrics(): void {
    return;
  }

  constructor() {
    super(
      new HistoryQueryMock({} as HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>),
      null! as HistoryQueryMetricsRepository
    );
  }

  override updateMetrics = mock.fn((): void => undefined);
  override resetMetrics = mock.fn((): void => undefined);
  override destroy = mock.fn((): void => undefined);
  override get metrics(): HistoryQueryMetrics {
    return { north: {} } as unknown as HistoryQueryMetrics;
  }
  override get stream(): PassThrough {
    return new PassThrough();
  }
}
