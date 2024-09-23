/**
 * Create a mock object for Certificate repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateNameAndDescription: jest.fn(),
    delete: jest.fn()
  };
});
