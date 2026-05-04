import { mock } from 'node:test';
import { OIBusCommand } from '../../../../model/oianalytics-command.model';
import { OIAnalyticsRegistration } from '../../../../model/oianalytics-registration.model';
import { CommandSearchParam } from '../../../../../shared/model/command.model';
import { Page } from '../../../../../shared/model/types';
import type { ILogger } from '../../../../model/logger.model';

/**
 * Create a mock object for OIAnalytics Command Service
 */
export default class OIAnalyticsCommandServiceMock {
  start = mock.fn(async (): Promise<void> => undefined);
  search = mock.fn(
    (_searchParams: CommandSearchParam): Page<OIBusCommand> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  delete = mock.fn((_commandId: string): void => undefined);
  checkCommands = mock.fn(async (): Promise<void> => undefined);
  sendAckCommands = mock.fn(async (_registration: OIAnalyticsRegistration): Promise<void> => undefined);
  checkRetrievedCommands = mock.fn(async (_registration: OIAnalyticsRegistration): Promise<void> => undefined);
  retrieveCommands = mock.fn(async (_registration: OIAnalyticsRegistration): Promise<void> => undefined);
  executeCommand = mock.fn(async (): Promise<void> => undefined);
  stop = mock.fn(async (): Promise<void> => undefined);
  setLogger = mock.fn((_logger: ILogger): void => undefined);
}
