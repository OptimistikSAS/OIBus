/**
 * Create a mock object for OIBus Service
 */
export default jest.fn().mockImplementation(() => ({
  getOIBusInfo: jest.fn(),
  stopOIBus: jest.fn(),
  restartOIBus: jest.fn(),
  addValues: jest.fn(),
  addFile: jest.fn(),
  checkForUpdate: jest.fn(),
  downloadUpdate: jest.fn(),
  getRegistrationSettings: jest.fn(),
  updateRegistrationSettings: jest.fn(),
  unregister: jest.fn()
}));
