/**
 * Create a mock object for Command Service
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    addMessageToQueue: jest.fn(),
    removeMessageFromQueue: jest.fn(pass => pass)
  };
});
