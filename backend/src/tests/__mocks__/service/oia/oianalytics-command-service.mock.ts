/**
 * Create a mock object for OIAnalytics Command Service
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    search: jest.fn(),
    checkCommands: jest.fn(),
    sendAckCommands: jest.fn(),
    checkRetrievedCommands: jest.fn(),
    retrieveCommands: jest.fn(),
    executeCommand: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn()
  };
});
