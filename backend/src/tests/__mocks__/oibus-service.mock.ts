/**
 * Create a mock object for OIBus Service
 */
export default jest.fn().mockImplementation(() => ({
  setLogger: jest.fn(),
  addExternalContent: jest.fn(),
  stopOIBus: jest.fn(),
  restartOIBus: jest.fn()
}));
