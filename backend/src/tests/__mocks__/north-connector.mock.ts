import { EventEmitter } from 'node:events';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthItemSettings, NorthSettings } from '../../../shared/model/north-settings.model';

/**
 * Create a mock object for North Connector
 */
export default class NorthConnectorMock {
  constructor(settings: NorthConnectorEntity<NorthSettings, NorthItemSettings>) {
    this.settings = settings;
  }
  start = jest.fn().mockImplementation(() => Promise.resolve());
  isEnabled = jest.fn();
  updateConnectorSubscription = jest.fn();
  connect = jest.fn();
  createCronJob = jest.fn();
  addToQueue = jest.fn();
  createDeferredPromise = jest.fn();
  resolveDeferredPromise = jest.fn();
  run = jest.fn();
  handleContentWrapper = jest.fn();
  handleValuesWrapper = jest.fn();
  handleFilesWrapper = jest.fn();
  createOIBusError = jest.fn();
  cacheValues = jest.fn();
  cacheFile = jest.fn();
  isSubscribed = jest.fn();
  isCacheEmpty = jest.fn();
  onItemChange = jest.fn();
  disconnect = jest.fn();
  stop = jest.fn();
  setLogger = jest.fn();
  updateScanMode = jest.fn();
  getErrorFiles = jest.fn();
  getErrorFileContent = jest.fn();
  removeErrorFiles = jest.fn();
  retryErrorFiles = jest.fn();
  removeAllErrorFiles = jest.fn();
  retryAllErrorFiles = jest.fn();
  getCacheFiles = jest.fn();
  getCacheFileContent = jest.fn();
  removeCacheFiles = jest.fn();
  archiveCacheFiles = jest.fn();
  getArchiveFiles = jest.fn();
  getArchiveFileContent = jest.fn();
  removeArchiveFiles = jest.fn();
  retryArchiveFiles = jest.fn();
  removeAllArchiveFiles = jest.fn();
  retryAllArchiveFiles = jest.fn();
  resetMetrics = jest.fn();
  resetCache = jest.fn();
  getCacheValues = jest.fn();
  removeCacheValues = jest.fn();
  removeAllCacheValues = jest.fn();
  removeAllCacheFiles = jest.fn();
  getErrorValues = jest.fn();
  removeErrorValues = jest.fn();
  removeAllErrorValues = jest.fn();
  retryErrorValues = jest.fn();
  retryAllErrorValues = jest.fn();
  testConnection = jest.fn();
  settings;
  metricsEvent = new EventEmitter();
}
