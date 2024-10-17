/**
 * Create a mock object for North Connector repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    findAllNorth: jest.fn(),
    findNorthById: jest.fn(),
    saveNorthConnector: jest.fn(),
    startNorth: jest.fn(),
    stopNorth: jest.fn(),
    deleteNorth: jest.fn(),
    listNorthSubscriptions: jest.fn(),
    checkSubscription: jest.fn(),
    createSubscription: jest.fn(),
    deleteSubscription: jest.fn(),
    deleteAllSubscriptionsByNorth: jest.fn()
  };
});
