/**
 * Create a mock object for North Service
 */
export default jest.fn().mockImplementation(() => ({
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  start: jest.fn(),
  stop: jest.fn()
}));
