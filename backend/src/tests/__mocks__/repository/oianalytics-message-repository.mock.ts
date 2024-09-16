/**
 * Create a mock object for OIAnalytics Message repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    search: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    markAsCompleted: jest.fn(),
    markAsErrored: jest.fn()
  };
});
