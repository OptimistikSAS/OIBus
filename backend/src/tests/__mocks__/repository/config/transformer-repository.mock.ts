/**
 * Create a mock object for Transformer repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    list: jest.fn(),
    search: jest.fn(),
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn()
  };
});
