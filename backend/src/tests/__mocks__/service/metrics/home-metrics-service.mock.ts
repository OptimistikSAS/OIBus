/**
 * Create a mock object for Home Metrics Service
 */
export default jest.fn().mockImplementation(() => ({
  stream: jest.fn()
}));
