/**
 * Create a mock object for Encryption Service
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn()
  };
});
