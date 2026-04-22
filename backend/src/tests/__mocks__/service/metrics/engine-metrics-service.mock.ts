import { EventEmitter } from 'node:events';
import { mock } from 'node:test';

/**
 * Create a mock object for Engine Metrics Service
 */
export default class EngineMetricsServiceMock {
  setLogger = mock.fn();
  resetMetrics = mock.fn();
  updateMetrics = mock.fn();
  stream = new EventEmitter();
}
