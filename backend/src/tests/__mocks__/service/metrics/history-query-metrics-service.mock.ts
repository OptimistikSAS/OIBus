import { mock } from 'node:test';
import { HistoryQueryMetrics } from '../../../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';

/**
 * Create a mock object for History Query Metrics Service
 */
export default class HistoryQueryMetricsServiceMock {
  initMetrics = mock.fn((): void => undefined);
  updateMetrics = mock.fn((): void => undefined);
  resetMetrics = mock.fn((): void => undefined);
  destroy = mock.fn((): void => undefined);
  metrics: HistoryQueryMetrics = {} as HistoryQueryMetrics;
  stream: PassThrough = new PassThrough();
}
