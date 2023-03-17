/**
 * Create a mock object for OIBus engine
 */
export default jest.fn().mockImplementation(() => {
  return {
    setLogger: jest.fn(),
    startSouth: jest.fn(),
    stopSouth: jest.fn(),
    startNorth: jest.fn(),
    stopNorth: jest.fn(),
    addItemToSouth: jest.fn(),
    updateItemInSouth: jest.fn(),
    deleteItemFromSouth: jest.fn()
  };
});
