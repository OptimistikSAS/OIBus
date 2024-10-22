/**
 * Create a mock object for OIAnalytics Client
 */
export default jest.fn().mockImplementation(() => {
  return {
    updateCommandStatus: jest.fn(),
    retrieveCancelledCommands: jest.fn(),
    retrievePendingCommands: jest.fn(),
    register: jest.fn(),
    checkRegistration: jest.fn(),
    sendConfiguration: jest.fn(),
    downloadFile: jest.fn()
  };
});
