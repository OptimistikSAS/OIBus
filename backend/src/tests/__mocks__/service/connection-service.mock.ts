/**
 * Create a mock object for Connection Service
 */
export default jest.fn().mockImplementation(() => ({
  getConnection: jest.fn(),
  disconnect: jest.fn(),
  isConnectionUsed: jest.fn(),
  init: jest.fn()
}));
