/**
 * Create a mock object for Repository Service
 */
export default jest.fn().mockImplementation(() => ({
  scanModeRepository: {
    getScanMode: jest.fn()
  }
}));
