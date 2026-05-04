import { mock } from 'node:test';
import { EngineMetrics } from '../../../../../shared/model/engine.model';

/**
 * Create a mock object for Engine Metrics Repository
 */
export default class EngineMetricsRepositoryMock {
  initMetrics = mock.fn((_engineId: string): void => undefined);
  getMetrics = mock.fn((_engineId: string): EngineMetrics | null => null);
  updateMetrics = mock.fn((_engineId: string, _metrics: EngineMetrics): void => undefined);
  removeMetrics = mock.fn((_engineId: string): void => undefined);
}
