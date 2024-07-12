import RepositoryServiceMock from './repository-service.mock';

/**
 * Create a mock object for History Query Service
 */
export default jest.fn().mockImplementation(() => ({
  getHistoryQuery: jest.fn(),
  getHistoryQueryList: jest.fn(),
  listItems: jest.fn(),
  stopHistoryQuery: jest.fn(),
  repositoryService: new RepositoryServiceMock()
}));
