/**
 * Create a mock object for User repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    search: jest.fn(),
    findById: jest.fn(),
    findByLogin: jest.fn(),
    getHashedPasswordByLogin: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updatePassword: jest.fn(),
    delete: jest.fn()
  };
});
