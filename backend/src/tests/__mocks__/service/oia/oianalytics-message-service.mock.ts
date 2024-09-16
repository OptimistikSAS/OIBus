/**
 * Create a mock object for OIAnalytics Message Service
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    run: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn(),
    createFullConfigMessageIfNotPending: jest.fn()
  };
});
