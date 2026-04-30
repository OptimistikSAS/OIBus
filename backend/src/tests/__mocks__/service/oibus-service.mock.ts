import { EventEmitter } from 'node:events';
import { mock } from 'node:test';

/**
 * Create a mock object for OIBus Service
 */
export default class OIBusServiceMock {
  start = mock.fn();
  getEngineSettings = mock.fn();
  getInfo = mock.fn();
  getProxyServer = mock.fn();
  updateEngineSettings = mock.fn();
  updateOIBusVersion = mock.fn();
  restart = mock.fn();
  stop = mock.fn();
  addExternalContent = mock.fn();
  setLogger = mock.fn();
  logHealthSignal = mock.fn();
  updateEngineMetrics = mock.fn();
  resetEngineMetrics = mock.fn();
  resetNorthMetrics = mock.fn();
  resetSouthMetrics = mock.fn();
  searchCacheContent = mock.fn();
  getFileFromCache = mock.fn();
  updateCacheContent = mock.fn();
  stream = new EventEmitter();
  loggerEvent = new EventEmitter();
  portChangeEvent = new EventEmitter();
}
