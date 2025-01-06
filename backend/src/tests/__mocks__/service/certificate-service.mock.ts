/**
 * Create a mock object for Certificate Service
 */
export default jest.fn().mockImplementation(() => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateNameAndDescription: jest.fn(),
  delete: jest.fn()
}));
