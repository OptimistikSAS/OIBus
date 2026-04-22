import { EventEmitter } from 'node:events';
import { mock } from 'node:test';

/**
 * Create a mock object for OIAnalytics Registration Service
 */
export default class OIAnalyticsRegistrationServiceMock {
  start = mock.fn();
  getRegistrationSettings = mock.fn();
  register = mock.fn();
  checkRegistration = mock.fn();
  editRegistrationSettings = mock.fn();
  updateKeys = mock.fn();
  testConnection = mock.fn();
  unregister = mock.fn();
  stop = mock.fn();
  registrationEvent = new EventEmitter();
}
