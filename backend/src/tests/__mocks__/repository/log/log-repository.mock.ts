import { mock } from 'node:test';

/**
 * Create a mock object for Log repository
 */
export default class LogRepositoryMock {
  search = mock.fn();
  suggestScopes = mock.fn();
  getScopeById = mock.fn();
  saveAll = mock.fn();
  count = mock.fn();
  delete = mock.fn();
  deleteLogsByScopeId = mock.fn();
  vacuum = mock.fn();
}
