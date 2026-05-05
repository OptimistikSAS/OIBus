import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { OIBusCommand } from '../../../../model/oianalytics-command.model';
import { OIAnalyticsFetchCommandDTO } from '../../../../service/oia/oianalytics.model';
import { CommandSearchParam } from '../../../../../shared/model/command.model';
import { Instant, Page } from '../../../../../shared/model/types';
import OIAnalyticsCommandRepository from '../../../../repository/config/oianalytics-command.repository';

/**
 * Create a mock object for OIAnalytics Command repository
 */
export default class OianalyticsCommandRepositoryMock extends OIAnalyticsCommandRepository {
  constructor() {
    super({} as Database);
  }
  override findAll = mock.fn((): Array<OIBusCommand> => []);
  override search = mock.fn(
    (_searchParams: CommandSearchParam): Page<OIBusCommand> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  override list = mock.fn((_searchParams: Omit<CommandSearchParam, 'page'>): Array<OIBusCommand> => []);
  override findById = mock.fn((_id: string): OIBusCommand | null => null);
  override create = mock.fn((_command: OIAnalyticsFetchCommandDTO): void => undefined);
  override cancel = mock.fn((_id: string): void => undefined);
  override markAsCompleted = mock.fn((_id: string, _completedDate: Instant, _result: string): void => undefined);
  override markAsErrored = mock.fn((_id: string, _result: string): void => undefined);
  override markAsRunning = mock.fn((_id: string): void => undefined);
  override markAsAcknowledged = mock.fn((_id: string): void => undefined);
  override delete = mock.fn((_id: string): void => undefined);
}
