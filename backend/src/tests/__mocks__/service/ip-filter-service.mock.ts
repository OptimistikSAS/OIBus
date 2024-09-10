/**
 * Create a mock object for IP Filter Service
 */
export default jest.fn().mockImplementation(() => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
}));
