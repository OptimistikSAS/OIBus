/**
 * Create a mock object for User Service
 */
export default jest.fn().mockImplementation(() => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findByLogin: jest.fn(),
  getHashedPasswordByLogin: jest.fn(),
  search: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updatePassword: jest.fn(),
  delete: jest.fn()
}));
