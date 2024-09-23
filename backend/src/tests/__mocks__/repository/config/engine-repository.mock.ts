/**
 * Create a mock object for Engine repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    get: jest.fn(),
    update: jest.fn(),
    updateVersion: jest.fn()
  };
});
