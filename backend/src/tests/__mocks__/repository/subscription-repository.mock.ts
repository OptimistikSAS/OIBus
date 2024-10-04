/**
 * Create a mock object for Subscriptions repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    listSouthByNorth: jest.fn(),
    listNorthBySouth: jest.fn(),
    checkSubscription: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteAllByNorth: jest.fn()
  };
});
