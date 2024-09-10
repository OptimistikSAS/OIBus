/**
 * Create a mock object for North Connector repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    stop: jest.fn(),
    start: jest.fn(),
    delete: jest.fn()
  };
});
