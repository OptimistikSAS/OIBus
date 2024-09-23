/**
 * Create a mock object for Connection Service
 */
export default jest.fn().mockImplementation(() => ({
  create: jest.fn(),
  remove: jest.fn(),
  findConnection: jest.fn()
}));
