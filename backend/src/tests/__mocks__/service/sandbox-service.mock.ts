/**
 * Create a mock object for Sandbox Service
 */
export default jest.fn().mockImplementation(() => {
  return {
    execute: jest.fn()
  };
});
