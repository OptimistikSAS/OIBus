import { EventEmitter } from 'node:events';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';

/**
 * Create a mock object for South Connector
 */
export default class SouthConnectorMock {
  constructor(settings: SouthConnectorEntity<SouthSettings, SouthItemSettings>) {
    this.settings = settings;
  }

  start = jest.fn().mockImplementation(() => Promise.resolve());
  connect = jest.fn();
  onItemChange = jest.fn();
  updateScanMode = jest.fn();
  isEnabled = jest.fn();
  createCronJob = jest.fn();
  addToQueue = jest.fn();
  run = jest.fn();
  createDeferredPromise = jest.fn();
  resolveDeferredPromise = jest.fn();
  historyQueryHandler = jest.fn();
  addContent = jest.fn();
  disconnect = jest.fn();
  stop = jest.fn();
  setLogger = jest.fn();
  resetCache = jest.fn();
  testConnection = jest.fn();
  testItem = jest.fn();
  resetMetrics = jest.fn();
  settings;
  connectedEvent = new EventEmitter();
  metricsEvent = new EventEmitter();
  queriesHistory = jest.fn();
  manageSouthCacheOnChange = jest.fn();
  sharableConnection = jest.fn();
  getSession = jest.fn();
  closeSession = jest.fn();
  getThrottlingSettings = jest
    .fn()
    .mockImplementation(value => ({ maxReadInterval: value.throttling.maxReadInterval, overlap: value.throttling.overlap }));
  getMaxInstantPerItem = jest.fn().mockImplementation(value => value.throttling?.maxInstantPerItem || false);
}
