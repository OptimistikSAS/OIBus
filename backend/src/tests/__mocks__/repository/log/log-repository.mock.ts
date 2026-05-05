import { mock } from 'node:test';
import { OIBusLog, PinoLog } from '../../../../model/logs.model';
import { LogSearchParam, Scope, ScopeType } from '../../../../../shared/model/logs.model';
import { Page } from '../../../../../shared/model/types';
import LogRepository from '../../../../repository/logs/log.repository';

/**
 * Create a mock object for Log repository
 */
export default class LogRepositoryMock extends LogRepository {
  constructor() {
    super(null!);
  }
  override search = mock.fn(
    (_searchParams: LogSearchParam): Page<OIBusLog> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  override suggestScopes = mock.fn((_name: string): Array<Scope> => []);
  override getScopeById = mock.fn((_id: string): Scope | null => null);
  override saveAll = mock.fn((_logsToStore: Array<PinoLog>): void => undefined);
  override count = mock.fn((): number => 0);
  override delete = mock.fn((_numberOfLogsToDelete: number): void => undefined);
  override deleteLogsByScopeId = mock.fn((_scopeType: ScopeType, _scopeId: string): void => undefined);
  override vacuum = mock.fn((): void => undefined);
}
