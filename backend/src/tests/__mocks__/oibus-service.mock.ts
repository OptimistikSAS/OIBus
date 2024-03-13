/**
 * Create a mock object for OIBus Service
 */
export default jest.fn().mockImplementation(() => ({
  setLogger: jest.fn(),
  addFile: jest.fn(),
  addValues: jest.fn(),
  stopOIBus: jest.fn(),
  restartOIBus: jest.fn()
}));
