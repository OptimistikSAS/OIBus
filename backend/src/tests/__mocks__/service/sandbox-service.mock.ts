import { mock } from 'node:test';

/**
 * Create a mock object for Sandbox Service
 */
export default class SandboxServiceMock {
  execute = mock.fn();
}
