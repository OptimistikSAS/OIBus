/**
 * Create a mock object for IP Filter repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  };
});
