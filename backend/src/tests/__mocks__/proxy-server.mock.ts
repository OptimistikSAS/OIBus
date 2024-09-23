/**
 * Create a mock object for Proxy Server
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn(),
    refreshIpFilters: jest.fn()
  };
});
