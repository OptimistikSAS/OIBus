/**
 * Create a mock object for History Query Service
 */
export default jest.fn().mockImplementation(() => ({
  getHistoryQuery: jest.fn(),
  getHistoryQueryList: jest.fn(),
  getItems: jest.fn(),
  stopHistoryQuery: jest.fn(),
  repositoryService: {
    southMetricsRepository: {
      createMetricsTable: jest.fn(),
      getMetrics: jest.fn()
    },
    northMetricsRepository: {
      createMetricsTable: jest.fn(),
      getMetrics: jest.fn()
    }
  }
}));
