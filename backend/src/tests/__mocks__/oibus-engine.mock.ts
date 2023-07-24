/**
 * Create a mock object for OIBus engine
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn(),
    startSouth: jest.fn(),
    stopSouth: jest.fn(),
    startNorth: jest.fn(),
    stopNorth: jest.fn(),
    addItemToSouth: jest.fn(),
    updateItemInSouth: jest.fn(),
    deleteItemFromSouth: jest.fn(),
    addValues: jest.fn(),
    addExternalValues: jest.fn(),
    addFile: jest.fn(),
    addExternalFile: jest.fn(),
    deleteAllItemsFromSouth: jest.fn(),
    getErrorFiles: jest.fn()
  };
});
