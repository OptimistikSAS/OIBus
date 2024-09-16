/**
 * Create a mock object for OIAnalytics Registration repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    get: jest.fn(),
    register: jest.fn(),
    update: jest.fn(),
    activate: jest.fn(),
    unregister: jest.fn()
  };
});
