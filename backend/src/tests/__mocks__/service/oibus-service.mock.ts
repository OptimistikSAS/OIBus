import { EventEmitter } from 'node:events';

/**
 * Create a mock object for OIBus Service
 */
export default jest.fn().mockImplementation(() => ({
  startOIBus: jest.fn(),
  getEngineSettings: jest.fn(),
  getOIBusInfo: jest.fn(),
  getProxyServer: jest.fn(),
  updateEngineSettings: jest.fn(),
  updateOIBusVersion: jest.fn(),
  setWebServerChangeLogger: jest.fn(),
  setWebServerChangePort: jest.fn(),
  restartOIBus: jest.fn(),
  stopOIBus: jest.fn(),
  addExternalContent: jest.fn(),
  setLogger: jest.fn(),
  logHealthSignal: jest.fn(),
  updateMetrics: jest.fn(),
  resetMetrics: jest.fn(),
  resetNorthConnectorMetrics: jest.fn(),
  resetSouthConnectorMetrics: jest.fn(),
  stream: new EventEmitter(),
  loggerEvent: new EventEmitter(),
  portChangeEvent: new EventEmitter()
}));
