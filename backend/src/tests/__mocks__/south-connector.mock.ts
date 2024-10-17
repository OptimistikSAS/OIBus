import { EventEmitter } from 'node:events';

/**
 * Create a mock object for South Connector
 */
export default jest.fn().mockImplementation(settings => {
  return {
    start: jest.fn().mockImplementation(() => Promise.resolve()),
    connect: jest.fn(),
    onItemChange: jest.fn(),
    updateScanMode: jest.fn(),
    isEnabled: jest.fn(),
    createCronJob: jest.fn(),
    addToQueue: jest.fn(),
    run: jest.fn(),
    createDeferredPromise: jest.fn(),
    resolveDeferredPromise: jest.fn(),
    historyQueryHandler: jest.fn(),
    addContent: jest.fn(),
    disconnect: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn(),
    resetCache: jest.fn(),
    getMetricsDataStream: jest.fn(),
    resetMetrics: jest.fn(),
    settings: settings,
    connectedEvent: new EventEmitter()
  };
});
