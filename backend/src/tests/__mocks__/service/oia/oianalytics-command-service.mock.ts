import { mock } from 'node:test';

/**
 * Create a mock object for OIAnalytics Command Service
 */
export default class OIAnalyticsCommandServiceMock {
  start = mock.fn();
  search = mock.fn();
  delete = mock.fn();
  checkCommands = mock.fn();
  sendAckCommands = mock.fn();
  checkRetrievedCommands = mock.fn();
  retrieveCommands = mock.fn();
  executeCommand = mock.fn();
  stop = mock.fn();
  setLogger = mock.fn();
}
