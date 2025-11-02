/**
 * Create a mock object for Log Service
 */
export default jest.fn().mockImplementation(() => ({
  search: jest.fn(),
  suggestScopes: jest.fn(),
  getScopeById: jest.fn()
}));
