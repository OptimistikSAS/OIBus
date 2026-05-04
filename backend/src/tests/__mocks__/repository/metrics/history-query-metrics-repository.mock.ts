import { mock } from 'node:test';
import { HistoryQueryMetrics } from '../../../../../shared/model/engine.model';

/**
 * Create a mock object for History Query Metrics Repository
 */
export default class HistoryQueryMetricsRepositoryMock {
  initMetrics = mock.fn((_historyQueryId: string): void => undefined);
  getMetrics = mock.fn((_historyQueryId: string): HistoryQueryMetrics | null => null);
  updateMetrics = mock.fn((_historyQueryId: string, _metrics: HistoryQueryMetrics): void => undefined);
  removeMetrics = mock.fn((_historyQueryId: string): void => undefined);
}
