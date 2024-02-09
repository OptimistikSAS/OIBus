/**
 * Create a mock object for Command Service
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    addCommandToQueue: jest.fn(),
    removeCommandFromQueue: jest.fn(pass => pass)
  };
});
