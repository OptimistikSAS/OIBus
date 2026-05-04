import { mock } from 'node:test';
import { OIBusLog } from '../../../model/logs.model';
import { LogSearchParam, Scope } from '../../../../shared/model/logs.model';
import { Page } from '../../../../shared/model/types';

/**
 * Create a mock object for Log Service
 */
export default class LogServiceMock {
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
  getScopeById = mock.fn((_scopeId: string): Scope => ({}) as Scope);
}
