/**
 * Create a mock object for Reload Service
 */
export default jest.fn().mockImplementation(() => ({
  onUpdateOibusSettings: jest.fn(),
  onCreateNorth: jest.fn(),
  onUpdateNorthSettings: jest.fn(),
  onDeleteNorth: jest.fn(),
  onCreateSouth: jest.fn(),
  onUpdateSouthSettings: jest.fn(),
  onDeleteSouth: jest.fn(),
  onCreateSouthItem: jest.fn(),
  onUpdateSouthItemsSettings: jest.fn(),
  onCreateOrUpdateSouthItems: jest.fn(),
  onDeleteSouthItem: jest.fn(),
  onDeleteAllSouthItems: jest.fn(),
  onCreateHistoryQuery: jest.fn(),
  onUpdateHistoryItemsSettings: jest.fn(),
  onDeleteHistoryItem: jest.fn(),
  onCreateNorthSubscription: jest.fn(),
  onDeleteNorthSubscription: jest.fn(),
  oibusEngine: {
    resetSouthMetrics: jest.fn(),
    resetNorthMetrics: jest.fn(),
    getErrorFiles: jest.fn(),
    removeErrorFiles: jest.fn(),
    retryErrorFiles: jest.fn(),
    removeAllErrorFiles: jest.fn(),
    retryAllErrorFiles: jest.fn()
  }
}));
