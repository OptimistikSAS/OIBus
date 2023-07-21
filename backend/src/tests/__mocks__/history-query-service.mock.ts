import SouthMetricsRepositoryMock from './south-metrics-repository.mock';
import NorthMetricsRepositoryMock from './north-metrics-repository.mock';

/**
 * Create a mock object for History Query Service
 */
export default jest.fn().mockImplementation(() => ({
  getHistoryQuery: jest.fn(),
  getHistoryQueryList: jest.fn(),
  getItems: jest.fn(),
  stopHistoryQuery: jest.fn(),
  repositoryService: {
    southMetricsRepository: new SouthMetricsRepositoryMock(),
    northMetricsRepository: new NorthMetricsRepositoryMock()
  }
}));
