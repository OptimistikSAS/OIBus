/**
 * Create a mock object for Health Signal Service
 */
export default jest.fn().mockImplementation(() => ({
  setLogger: jest.fn(),
  setSettings: jest.fn()
}));
