import { mock } from 'node:test';
import { SouthConnectorMetrics } from '../../../../../shared/model/engine.model';

/**
 * Create a mock object for South Connector Metrics Repository
 */
export default class SouthMetricsRepositoryMock {
  initMetrics = mock.fn((_southId: string): void => undefined);
  getMetrics = mock.fn((_southId: string): SouthConnectorMetrics | null => null);
  updateMetrics = mock.fn((_southId: string, _metrics: SouthConnectorMetrics): void => undefined);
  removeMetrics = mock.fn((_southId: string): void => undefined);
}
