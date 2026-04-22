import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
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

  start = mock.fn(async () => undefined);
  connect = mock.fn();
  updateScanModeIfUsed = mock.fn();
  isEnabled = mock.fn();
  updateCronJobs = mock.fn();
  updateSubscriptions = mock.fn();
  addToQueue = mock.fn();
  run = mock.fn();
  createDeferredPromise = mock.fn();
  resolveDeferredPromise = mock.fn();
  historyQueryHandler = mock.fn();
  directQueryHandler = mock.fn();
  addContent = mock.fn();
  disconnect = mock.fn();
  stop = mock.fn();
  setLogger = mock.fn();
  resetCache = mock.fn();
  testConnection = mock.fn(async () => ({ items: [] }));
  testItem = mock.fn();
  resetMetrics = mock.fn();
  connectedEvent = new EventEmitter();
  metricsEvent = new EventEmitter();
  hasHistoryQuery = mock.fn();
  hasDirectQuery = mock.fn();
  hasSubscription = mock.fn();

  set connectorConfiguration(connectorConfiguration: SouthConnectorEntity<SouthSettings, SouthItemSettings>) {
    this.connector = connectorConfiguration;
  }

  get connectorConfiguration() {
    return this.connector;
  }
}
