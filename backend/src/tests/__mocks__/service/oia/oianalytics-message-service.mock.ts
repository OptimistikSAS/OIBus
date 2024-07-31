/**
 * Create a mock object for Command Service
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    run: jest.fn(),
    removeMessageFromQueue: jest.fn(),
    addMessageToQueue: jest.fn(),
    sendMessage: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn(),
    createFullConfigMessage: jest.fn()
  };
});
