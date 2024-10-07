/**
 * Create a mock object for North Service
 */
export default jest.fn().mockImplementation(() => ({
  runNorth: jest.fn(),
  testNorth: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  getInstalledNorthManifests: jest.fn(),
  createNorth: jest.fn(),
  updateNorthWithoutSubscriptions: jest.fn(),
  updateNorth: jest.fn(),
  deleteNorth: jest.fn(),
  startNorth: jest.fn(),
  stopNorth: jest.fn()
}));
