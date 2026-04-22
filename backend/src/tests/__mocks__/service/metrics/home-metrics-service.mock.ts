import { mock } from 'node:test';

/**
 * Create a mock object for Home Metrics Service
 */
export default class HomeMetricsServiceMock {
  stream = mock.fn();
}
