/**
 * Create a mock object for Logger Service
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    createChildLogger: jest.fn(),
    stop: jest.fn()
  };
});
