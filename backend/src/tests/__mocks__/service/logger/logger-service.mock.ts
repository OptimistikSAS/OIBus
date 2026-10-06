import { mock } from 'node:test';

import { ScopeType } from '../../../../../shared/model/domain/logs.model';

import { EngineSettings } from '../../../../model/engine.model';
import type { ILogger } from '../../../../model/logger.model';
import { OIAnalyticsRegistration } from '../../../../model/oianalytics-registration.model';

/**
 * Create a mock object for Logger Service
 */
export default class LoggerServiceMock {
  start = mock.fn(async (_engineSettings: EngineSettings, _registration: OIAnalyticsRegistration | null): Promise<void> => undefined);
  createChildLogger = mock.fn((_scopeType: ScopeType, _scopeId?: string, _scopeName?: string): ILogger => ({}) as ILogger);
  stop = mock.fn((): void => undefined);
}
