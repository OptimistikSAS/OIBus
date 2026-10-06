import { mock } from 'node:test';

import type { NorthSettings } from '../../../../../shared/model/connector/north-settings.model';
import type { SouthItemSettings, SouthSettings } from '../../../../../shared/model/connector/south-settings.model';
import { HistoryQueryMetrics } from '../../../../../shared/model/domain/engine.model';

import type { HistoryQueryEntity } from '../../../../model/histor-query.model';
import type HistoryQueryMetricsRepository from '../../../../repository/metrics/history-query-metrics.repository';
import HistoryQueryMetricsService from '../../../../service/metrics/history-query-metrics.service';
import HistoryQueryMock from '../../history-query.mock';

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
      new HistoryQueryMock({
        queryTimeRange: { startTime: '2020-01-01T00:00:00.000Z', endTime: '2020-01-01T00:00:00.000Z', maxReadInterval: 3600, readDelay: 0 }
      } as HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>),
      null! as HistoryQueryMetricsRepository
    );
  }

  override updateMetrics = mock.fn((): void => undefined);
  override resetMetrics = mock.fn((): void => undefined);
  override destroy = mock.fn((): void => undefined);
  override get metrics(): HistoryQueryMetrics {
    return { north: {} } as unknown as HistoryQueryMetrics;
  }
}
