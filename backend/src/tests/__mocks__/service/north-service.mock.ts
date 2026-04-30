import { mock } from 'node:test';

/**
 * Create a mock object for North Service
 */
export default class NorthServiceMock {
  listManifest = mock.fn();
  getManifest = mock.fn();
  list = mock.fn();
  findById = mock.fn();
  create = mock.fn();
  update = mock.fn();
  delete = mock.fn();
  start = mock.fn();
  stop = mock.fn();
  getNorthDataStream = mock.fn();
  getNorthMetric = mock.fn();
  testNorth = mock.fn(async () => ({ items: [] }));
  addOrEditTransformer = mock.fn();
  removeTransformer = mock.fn();
  checkSubscription = mock.fn();
  subscribeToSouth = mock.fn();
  unsubscribeFromSouth = mock.fn();
  unsubscribeFromAllSouth = mock.fn();
  searchCacheContent = mock.fn();
  getCacheFileContent = mock.fn();
  removeCacheContent = mock.fn();
  removeAllCacheContent = mock.fn();
  moveCacheContent = mock.fn();
  moveAllCacheContent = mock.fn();
  executeSetpoint = mock.fn();
  retrieveSecretsFromNorth = mock.fn();
}
