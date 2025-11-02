/**
 * Create a mock object for North Service
 */
export default jest.fn().mockImplementation(() => ({
  listManifest: jest.fn(),
  getManifest: jest.fn(),
  list: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  getNorthDataStream: jest.fn(),
  testNorth: jest.fn(),
  addOrEditTransformer: jest.fn(),
  removeTransformer: jest.fn(),
  checkSubscription: jest.fn(),
  subscribeToSouth: jest.fn(),
  unsubscribeFromSouth: jest.fn(),
  unsubscribeFromAllSouth: jest.fn(),
  searchCacheContent: jest.fn(),
  getCacheFileContent: jest.fn(),
  removeCacheContent: jest.fn(),
  removeAllCacheContent: jest.fn(),
  moveCacheContent: jest.fn(),
  moveAllCacheContent: jest.fn(),
  executeSetpoint: jest.fn(),
  retrieveSecretsFromNorth: jest.fn()
}));
