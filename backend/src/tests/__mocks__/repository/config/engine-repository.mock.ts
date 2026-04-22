import { mock } from 'node:test';

/**
 * Create a mock object for Engine repository
 */
export default class EngineRepositoryMock {
  get = mock.fn();
  update = mock.fn();
  updateVersion = mock.fn();
}
