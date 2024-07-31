/**
 * Create a mock object for South Service
 */
export default jest.fn().mockImplementation(() => ({
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  createItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  deleteAllItems: jest.fn(),
  enableItem: jest.fn(),
  disableItem: jest.fn()
}));
