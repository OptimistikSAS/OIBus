import { mock } from 'node:test';

/**
 * Create a mock object for OIAnalytics Registration repository
 */
export default class OianalyticsRegistrationRepositoryMock {
  get = mock.fn();
  register = mock.fn();
  update = mock.fn();
  updateKeys = mock.fn();
  activate = mock.fn();
  unregister = mock.fn();
}
