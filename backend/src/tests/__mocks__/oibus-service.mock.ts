/**
 * Create a mock object for OIBus Service
 */
export default jest.fn().mockImplementation(() => ({
  getOIBusInfo: jest.fn()
}));
