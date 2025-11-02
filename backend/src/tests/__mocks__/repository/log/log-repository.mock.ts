/**
 * Create a mock object for Log repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    search: jest.fn(),
    suggestScopes: jest.fn(),
    getScopeById: jest.fn(),
    saveAll: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    deleteLogsByScopeId: jest.fn(),
    vacuum: jest.fn()
  };
});
