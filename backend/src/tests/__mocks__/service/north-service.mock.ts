/**
 * Create a mock object for North Service
 */
export default jest.fn().mockImplementation(() => ({
  buildNorth: jest.fn(),
  testNorth: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  getInstalledNorthManifests: jest.fn(),
  createNorth: jest.fn(),
  getNorthDataStream: jest.fn(),
  searchCacheContent: jest.fn(),
  getCacheContentFileStream: jest.fn(),
  removeCacheContent: jest.fn(),
  removeAllCacheContent: jest.fn(),
  moveCacheContent: jest.fn(),
  moveAllCacheContent: jest.fn(),
  updateNorth: jest.fn(),
  deleteNorth: jest.fn(),
  startNorth: jest.fn(),
  stopNorth: jest.fn(),
  findSubscriptionsByNorth: jest.fn(),
  checkSubscription: jest.fn(),
  createSubscription: jest.fn(),
  deleteSubscription: jest.fn(),
  deleteAllSubscriptionsByNorth: jest.fn(),
  executeSetpoint: jest.fn()
}));
