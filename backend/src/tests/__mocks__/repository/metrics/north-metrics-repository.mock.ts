import { mock } from 'node:test';
import { NorthConnectorMetrics } from '../../../../../shared/model/engine.model';

/**
 * Create a mock object for North Connector Metrics Repository
 */
export default class NorthMetricsRepositoryMock {
  initMetrics = mock.fn((_northId: string): void => undefined);
  getMetrics = mock.fn((_northId: string): NorthConnectorMetrics | null => null);
  updateMetrics = mock.fn((_northId: string, _metrics: NorthConnectorMetrics): void => undefined);
  removeMetrics = mock.fn((_northId: string): void => undefined);
}
