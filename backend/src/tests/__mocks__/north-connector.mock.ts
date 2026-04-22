import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';

/**
 * Create a mock object for North Connector
 */
export default class NorthConnectorMock {
  private connector: NorthConnectorEntity<NorthSettings>;
  constructor(connector: NorthConnectorEntity<NorthSettings>) {
    this.connector = connector;
  }
  start = mock.fn(async () => undefined);
  isEnabled = mock.fn();
  connect = mock.fn();
  createCronJob = mock.fn();
  addTaskToQueue = mock.fn();
  run = mock.fn();
  handleContentWrapper = mock.fn();
  createOIBusError = mock.fn();
  resetCache = mock.fn();
  cacheContent = mock.fn();
  isSubscribed = mock.fn();
  isCacheEmpty = mock.fn();
  disconnect = mock.fn();
  stop = mock.fn();
  setLogger = mock.fn();
  updateScanMode = mock.fn();
  searchCacheContent = mock.fn();
  getFileFromCache = mock.fn();
  updateCacheContent = mock.fn();
  testConnection = mock.fn(async () => ({ items: [] }));
  metricsEvent = new EventEmitter();

  set connectorConfiguration(connectorConfiguration: NorthConnectorEntity<NorthSettings>) {
    this.connector = connectorConfiguration;
  }

  get connectorConfiguration() {
    return this.connector;
  }
}
