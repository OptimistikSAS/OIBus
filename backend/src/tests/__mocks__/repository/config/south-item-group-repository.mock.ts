/**
 * Create a mock object for South Item Group Repository
 */
export default jest.fn().mockImplementation(() => ({
  findById: jest.fn(),
  findBySouthId: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
}));
