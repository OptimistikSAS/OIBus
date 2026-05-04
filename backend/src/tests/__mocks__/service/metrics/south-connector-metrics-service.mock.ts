import { mock } from 'node:test';
import { SouthConnectorMetrics } from '../../../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';

/**
 * Create a mock object for South Connector Metrics Service
 */
export default class SouthConnectorMetricsServiceMock {
  initMetrics = mock.fn((): void => undefined);
  updateMetrics = mock.fn((): void => undefined);
  resetMetrics = mock.fn((): void => undefined);
  destroy = mock.fn((): void => undefined);
  metrics: SouthConnectorMetrics = {} as SouthConnectorMetrics;
  stream: PassThrough = new PassThrough();
}
