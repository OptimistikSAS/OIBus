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
    addContent: jest.fn(),
    addExternalContent: jest.fn(),
    deleteAllItemsFromSouth: jest.fn(),
    getErrorFiles: jest.fn(),
    updateScanMode: jest.fn(),
    deleteSouth: jest.fn(),
    deleteNorth: jest.fn(),
    addItemToNorth: jest.fn(),
    updateItemInNorth: jest.fn(),
    deleteItemFromNorth: jest.fn(),
    deleteAllItemsFromNorth: jest.fn()
  };
});
