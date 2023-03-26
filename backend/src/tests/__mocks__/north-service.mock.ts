/**
 * Create a mock object for North Service
 */
export default jest.fn().mockImplementation(() => ({
  createNorth: jest.fn(),
  getNorth: jest.fn(),
  getNorthList: jest.fn()
}));
