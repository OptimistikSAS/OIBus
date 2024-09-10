/**
 * Create a mock object for OIBus engine
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn(),
    createSouth: jest.fn(),
    startSouth: jest.fn(),
    reloadSouth: jest.fn(),
    stopSouth: jest.fn(),
    createNorth: jest.fn(),
    startNorth: jest.fn(),
    reloadNorth: jest.fn(),
    stopNorth: jest.fn(),
    updateNorthConnectorSubscriptions: jest.fn(),
    onSouthItemsChange: jest.fn(),
    addContent: jest.fn(),
    addExternalContent: jest.fn(),
    getErrorFiles: jest.fn(),
    updateScanMode: jest.fn(),
    updateSubscriptions: jest.fn(),
    deleteSouth: jest.fn(),
    deleteNorth: jest.fn()
  };
});
