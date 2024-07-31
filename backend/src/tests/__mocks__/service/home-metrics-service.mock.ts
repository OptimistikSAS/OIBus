/**
 * Create a mock object for Home Metrics Service
 */
export default jest.fn().mockImplementation(() => ({
  addNorth: jest.fn(),
  removeNorth: jest.fn(),
  addSouth: jest.fn(),
  removeSouth: jest.fn(),
  updateMetrics: jest.fn()
}));
