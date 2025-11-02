/**
 * Create a mock object for Scan Mode Service
 */
export default jest.fn().mockImplementation(() => ({
  list: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  verifyCron: jest.fn()
}));
