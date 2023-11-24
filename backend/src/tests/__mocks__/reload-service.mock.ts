/**
 * Create a mock object for Reload Service
 */
export default jest.fn().mockImplementation(() => ({
  onUpdateOibusSettings: jest.fn(),
  onCreateNorth: jest.fn(),
  onUpdateNorthSettings: jest.fn(),
  onDeleteNorth: jest.fn(),
  onStartNorth: jest.fn(),
  onStopNorth: jest.fn(),
  onCreateSouth: jest.fn(),
  onUpdateSouth: jest.fn(),
  onDeleteSouth: jest.fn(),
  onStartSouth: jest.fn(),
  onStopSouth: jest.fn(),
  onCreateSouthItem: jest.fn(),
  onUpdateSouthItemsSettings: jest.fn(),
  onCreateOrUpdateSouthItems: jest.fn(),
  onDeleteSouthItem: jest.fn(),
  onEnableSouthItem: jest.fn(),
  onDisableSouthItem: jest.fn(),
  onDeleteAllSouthItems: jest.fn(),
  onCreateHistoryQuery: jest.fn(),
  onUpdateHistoryQuerySettings: jest.fn(),
  onStartHistoryQuery: jest.fn(),
  onPauseHistoryQuery: jest.fn(),
  onDeleteHistoryQuery: jest.fn(),
  onUpdateHistoryItemsSettings: jest.fn(),
  onDeleteHistoryItem: jest.fn(),
  onEnableHistoryItem: jest.fn(),
  onDisableHistoryItem: jest.fn(),
  onDeleteAllHistoryItems: jest.fn(),
  onCreateOrUpdateHistoryQueryItems: jest.fn(),
  onCreateHistoryItem: jest.fn(),
  onCreateNorthSubscription: jest.fn(),
  onCreateExternalNorthSubscription: jest.fn(),
  onDeleteNorthSubscription: jest.fn(),
  onDeleteExternalNorthSubscription: jest.fn(),
  onUpdateScanMode: jest.fn(),
  oibusEngine: {
    resetSouthMetrics: jest.fn(),
    resetNorthMetrics: jest.fn(),
    getErrorFiles: jest.fn(),
    removeErrorFiles: jest.fn(),
    retryErrorFiles: jest.fn(),
    removeAllErrorFiles: jest.fn(),
    retryAllErrorFiles: jest.fn(),
    getArchiveFiles: jest.fn(),
    removeArchiveFiles: jest.fn(),
    retryArchiveFiles: jest.fn(),
    removeAllArchiveFiles: jest.fn(),
    retryAllArchiveFiles: jest.fn(),
    testSouth: jest.fn(),
    getCacheFiles: jest.fn(),
    removeCacheFiles: jest.fn(),
    archiveCacheFiles: jest.fn(),
    getCacheValues: jest.fn(),
    removeCacheValues: jest.fn(),
    removeAllCacheValues: jest.fn()
  }
}));
