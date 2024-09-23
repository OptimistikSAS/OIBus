/**
 * Create a mock object for South Service
 */
export default jest.fn().mockImplementation(() => ({
  runSouth: jest.fn(),
  testSouth: jest.fn(),
  testSouthItem: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  getInstalledSouthManifests: jest.fn(),
  createSouth: jest.fn(),
  updateSouthWithoutItems: jest.fn(),
  updateSouth: jest.fn(),
  deleteSouth: jest.fn(),
  startSouth: jest.fn(),
  stopSouth: jest.fn(),
  getSouthItems: jest.fn(),
  searchSouthItems: jest.fn(),
  findAllItemsForSouthConnector: jest.fn(),
  findSouthConnectorItemById: jest.fn(),
  createItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  deleteAllItemsForSouthConnector: jest.fn(),
  enableItem: jest.fn(),
  disableItem: jest.fn(),
  checkCsvImport: jest.fn(),
  importItems: jest.fn()
}));
