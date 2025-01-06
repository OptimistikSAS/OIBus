/**
 * Create a mock object for Log Service
 */
export default jest.fn().mockImplementation(() => ({
  search: jest.fn(),
  searchScopesByName: jest.fn(),
  getScopeById: jest.fn(),
  addLogsFromRemote: jest.fn()
}));
