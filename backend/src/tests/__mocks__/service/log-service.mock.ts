import { mock } from 'node:test';

/**
 * Create a mock object for Log Service
 */
export default class LogServiceMock {
  search = mock.fn();
  suggestScopes = mock.fn();
  getScopeById = mock.fn();
}
