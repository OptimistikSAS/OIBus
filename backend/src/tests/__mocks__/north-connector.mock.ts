import { EventEmitter } from 'node:events';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';

/**
 * Create a mock object for North Connector
 */
export default class NorthConnectorMock {
  constructor(settings: NorthConnectorEntity<NorthSettings>) {
    this.settings = settings;
  }
  start = jest.fn().mockImplementation(() => Promise.resolve());
  isEnabled = jest.fn();
  updateConnectorSubscription = jest.fn();
  connect = jest.fn();
  createCronJob = jest.fn();
  addTaskToQueue = jest.fn();
  run = jest.fn();
  handleContentWrapper = jest.fn();
  createOIBusError = jest.fn();
  resetCache = jest.fn();
  cacheContent = jest.fn();
  isSubscribed = jest.fn();
  isCacheEmpty = jest.fn();
  disconnect = jest.fn();
  stop = jest.fn();
  setLogger = jest.fn();
  updateScanMode = jest.fn();
  searchCacheContent = jest.fn();
  getCacheContentFileStream = jest.fn();
  removeCacheContent = jest.fn();
  removeAllCacheContent = jest.fn();
  moveCacheContent = jest.fn();
  moveAllCacheContent = jest.fn();
  metadataFileListToCacheContentList = jest.fn();
  testConnection = jest.fn();
  settings;
  metricsEvent = new EventEmitter();
}
