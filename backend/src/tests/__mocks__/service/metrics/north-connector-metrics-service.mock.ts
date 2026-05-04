import { mock } from 'node:test';
import { NorthConnectorMetrics } from '../../../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';

/**
 * Create a mock object for North Connector Metrics Service
 */
export default class NorthConnectorMetricsServiceMock {
  initMetrics = mock.fn((): void => undefined);
  updateMetrics = mock.fn((): void => undefined);
  resetMetrics = mock.fn((): void => undefined);
  destroy = mock.fn((): void => undefined);
  metrics: NorthConnectorMetrics = {} as NorthConnectorMetrics;
  stream: PassThrough = new PassThrough();
}
