import { PassThrough } from 'node:stream';

/**
 * Create a mock object for Home Metrics Service
 */
export default class HomeMetricsServiceMock {
  stream: PassThrough = new PassThrough();
}
