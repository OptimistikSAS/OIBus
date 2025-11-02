/**
 * Create a mock object for South Service
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
  getSouthDataStream: jest.fn(),
  testSouth: jest.fn(),
  testItem: jest.fn(),
  listItems: jest.fn(),
  searchItems: jest.fn(),
  findItemById: jest.fn(),
  createItem: jest.fn(),
  updateItem: jest.fn(),
  enableItem: jest.fn(),
  disableItem: jest.fn(),
  enableItems: jest.fn(),
  disableItems: jest.fn(),
  deleteItem: jest.fn(),
  deleteItems: jest.fn(),
  deleteAllItems: jest.fn(),
  checkImportItems: jest.fn(),
  importItems: jest.fn(),
  retrieveSecretsFromSouth: jest.fn()
}));
