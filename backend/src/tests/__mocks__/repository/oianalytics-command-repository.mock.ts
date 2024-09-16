/**
 * Create a mock object for OIAnalytics Command repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    findAll: jest.fn(),
    search: jest.fn(),
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    cancel: jest.fn(),
    markAsCompleted: jest.fn(),
    markAsErrored: jest.fn(),
    markAsRunning: jest.fn(),
    markAsAcknowledged: jest.fn(),
    delete: jest.fn()
  };
});
