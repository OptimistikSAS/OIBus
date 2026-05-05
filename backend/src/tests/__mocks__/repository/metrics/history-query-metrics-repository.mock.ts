import { mock } from 'node:test';
import { HistoryQueryMetrics } from '../../../../../shared/model/engine.model';
import HistoryQueryMetricsRepository from '../../../../repository/metrics/history-query-metrics.repository';

/**
 * Create a mock object for History Query Metrics Repository
 */
export default class HistoryQueryMetricsRepositoryMock extends HistoryQueryMetricsRepository {
  constructor() {
    super(null!);
  }
  override initMetrics = mock.fn((_historyQueryId: string): void => undefined);
  override getMetrics = mock.fn((_historyQueryId: string): HistoryQueryMetrics | null => null);
  override updateMetrics = mock.fn((_historyQueryId: string, _metrics: HistoryQueryMetrics): void => undefined);
  override removeMetrics = mock.fn((_historyQueryId: string): void => undefined);
}
