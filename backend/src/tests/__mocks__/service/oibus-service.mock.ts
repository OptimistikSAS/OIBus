import { EventEmitter } from 'node:events';

/**
 * Create a mock object for OIBus Service
 */
export default jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  getEngineSettings: jest.fn(),
  getInfo: jest.fn(),
  getProxyServer: jest.fn(),
  updateEngineSettings: jest.fn(),
  updateOIBusVersion: jest.fn(),
  restart: jest.fn(),
  stop: jest.fn(),
  addExternalContent: jest.fn(),
  setLogger: jest.fn(),
  logHealthSignal: jest.fn(),
  updateEngineMetrics: jest.fn(),
  resetEngineMetrics: jest.fn(),
  resetNorthMetrics: jest.fn(),
  resetSouthMetrics: jest.fn(),
  stream: new EventEmitter(),
  loggerEvent: new EventEmitter(),
  portChangeEvent: new EventEmitter()
}));
