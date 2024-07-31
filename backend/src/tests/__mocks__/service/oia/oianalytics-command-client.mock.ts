/**
 * Create a mock object for Command Service
 */
export default jest.fn().mockImplementation(() => {
  return {
    completeCommand: jest.fn()
  };
});
