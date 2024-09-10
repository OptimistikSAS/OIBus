/**
 * Create a mock object for Scan Mode Service
 */
export default jest.fn().mockImplementation(() => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  verifyCron: jest.fn()
}));
