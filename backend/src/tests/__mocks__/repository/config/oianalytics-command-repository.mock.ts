import { mock } from 'node:test';
import { OIBusCommand } from '../../../../model/oianalytics-command.model';
import { OIAnalyticsFetchCommandDTO } from '../../../../service/oia/oianalytics.model';
import { CommandSearchParam } from '../../../../../shared/model/command.model';
import { Instant, Page } from '../../../../../shared/model/types';

/**
 * Create a mock object for OIAnalytics Command repository
 */
export default class OianalyticsCommandRepositoryMock {
  findAll = mock.fn((): Array<OIBusCommand> => []);
  search = mock.fn(
    (_searchParams: CommandSearchParam): Page<OIBusCommand> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  list = mock.fn((_searchParams: Omit<CommandSearchParam, 'page'>): Array<OIBusCommand> => []);
  findById = mock.fn((_id: string): OIBusCommand | null => null);
  create = mock.fn((_command: OIAnalyticsFetchCommandDTO): void => undefined);
  cancel = mock.fn((_id: string): void => undefined);
  markAsCompleted = mock.fn((_id: string, _completedDate: Instant, _result: string): void => undefined);
  markAsErrored = mock.fn((_id: string, _result: string): void => undefined);
  markAsRunning = mock.fn((_id: string): void => undefined);
  markAsAcknowledged = mock.fn((_id: string): void => undefined);
  delete = mock.fn((_id: string): void => undefined);
}
