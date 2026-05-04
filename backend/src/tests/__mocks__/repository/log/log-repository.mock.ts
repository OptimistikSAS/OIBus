import { mock } from 'node:test';
import { OIBusLog, PinoLog } from '../../../../model/logs.model';
import { LogSearchParam, Scope, ScopeType } from '../../../../../shared/model/logs.model';
import { Page } from '../../../../../shared/model/types';

/**
 * Create a mock object for Log repository
 */
export default class LogRepositoryMock {
  search = mock.fn(
    (_searchParams: LogSearchParam): Page<OIBusLog> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  suggestScopes = mock.fn((_name: string): Array<Scope> => []);
  getScopeById = mock.fn((_id: string): Scope | null => null);
  saveAll = mock.fn((_logsToStore: Array<PinoLog>): void => undefined);
  count = mock.fn((): number => 0);
  delete = mock.fn((_numberOfLogsToDelete: number): void => undefined);
  deleteLogsByScopeId = mock.fn((_scopeType: ScopeType, _scopeId: string): void => undefined);
  vacuum = mock.fn((): void => undefined);
}
