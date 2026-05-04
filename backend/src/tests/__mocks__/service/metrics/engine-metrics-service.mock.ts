import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
import { EngineMetrics } from '../../../../../shared/model/engine.model';
import type { ILogger } from '../../../../model/logger.model';

/**
 * Create a mock object for Engine Metrics Service
 */
export default class EngineMetricsServiceMock {
  setLogger = mock.fn((_logger: ILogger): void => undefined);
  resetMetrics = mock.fn((): void => undefined);
  updateMetrics = mock.fn((_metrics: Partial<EngineMetrics>): void => undefined);
  stream = new EventEmitter();
}
