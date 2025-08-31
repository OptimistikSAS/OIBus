import { EventEmitter } from 'node:events';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';

/**
 * Create a mock object for South Connector
 */
export default class SouthConnectorMock {
  private connector: SouthConnectorEntity<SouthSettings, SouthItemSettings>;
  constructor(connector: SouthConnectorEntity<SouthSettings, SouthItemSettings>) {
    this.connector = connector;
  }

  start = jest.fn().mockImplementation(() => Promise.resolve());
  connect = jest.fn();
  updateScanModeIfUsed = jest.fn();
  updateSouthCacheOnScanModeAndMaxInstantChanges = jest.fn();
  isEnabled = jest.fn();
  updateCronJobs = jest.fn();
  updateSubscriptions = jest.fn();
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
  connectedEvent = new EventEmitter();
  metricsEvent = new EventEmitter();
  queriesHistory = jest.fn();
  queriesFile = jest.fn();
  queriesLastPoint = jest.fn();
  queriesSubscription = jest.fn();
  getThrottlingSettings = jest
    .fn()
    .mockImplementation(value => ({ maxReadInterval: value.throttling.maxReadInterval, overlap: value.throttling.overlap }));
  getMaxInstantPerItem = jest.fn().mockImplementation(value => value.throttling?.maxInstantPerItem || false);

  set connectorConfiguration(connectorConfiguration: SouthConnectorEntity<SouthSettings, SouthItemSettings>) {
    this.connector = connectorConfiguration;
  }

  get connectorConfiguration() {
    return this.connector;
  }
}
