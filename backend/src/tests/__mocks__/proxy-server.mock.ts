import { mock } from 'node:test';

/**
 * Create a mock object for Proxy Server
 */
export default class ProxyServerMock {
  start = mock.fn();
  stop = mock.fn();
  setLogger = mock.fn();
  refreshIpFilters = mock.fn();
}
