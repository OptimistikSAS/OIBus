/**
 * Create a mock object for North Connector repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    findAllNorth: jest.fn(),
    findNorthById: jest.fn(),
    saveNorth: jest.fn(),
    startNorth: jest.fn(),
    stopNorth: jest.fn(),
    deleteNorth: jest.fn(),
    addOrEditTransformer: jest.fn(),
    removeTransformer: jest.fn()
  };
});
