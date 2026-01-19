/**
 * Create a mock object for Transformer service
 */
export default jest.fn().mockImplementation(() => {
  return {
    listManifest: jest.fn(),
    getManifest: jest.fn(),
    search: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    test: jest.fn(),
    generateTemplate: jest.fn()
  };
});
