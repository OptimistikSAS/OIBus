import { mock } from 'node:test';

/**
 * Create a mock object for OIAnalytics Client
 */
export default class OIAnalyticsClientMock {
  updateCommandStatus = mock.fn();
  retrieveCancelledCommands = mock.fn();
  retrievePendingCommands = mock.fn();
  register = mock.fn();
  checkRegistration = mock.fn();
  sendConfiguration = mock.fn();
  sendHistoryQuery = mock.fn();
  deleteHistoryQuery = mock.fn();
  downloadFile = mock.fn();
}
