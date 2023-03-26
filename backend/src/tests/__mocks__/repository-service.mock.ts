/**
 * Create a mock object for Repository Service
 */
export default jest.fn().mockImplementation(() => ({
  scanModeRepository: {
    getScanMode: jest.fn()
  },
  northConnectorRepository: {
    getNorthConnector: jest.fn(),
    getNorthConnectors: jest.fn(),
    createNorthConnector: jest.fn(),
    updateNorthConnector: jest.fn(),
    deleteNorthConnector: jest.fn()
  },
  southConnectorRepository: {
    getSouthConnector: jest.fn(),
    getSouthConnectors: jest.fn(),
    createSouthConnector: jest.fn(),
    updateSouthConnector: jest.fn(),
    deleteSouthConnector: jest.fn()
  },
  southItemRepository: {
    getSouthItem: jest.fn(),
    getSouthItems: jest.fn(),
    createSouthItem: jest.fn(),
    updateSouthItem: jest.fn(),
    deleteSouthItem: jest.fn(),
    deleteSouthItemByConnectorId: jest.fn()
  },
  historyQueryRepository: {
    getHistoryQuery: jest.fn(),
    getHistoryQueries: jest.fn(),
    createHistoryQuery: jest.fn(),
    updateHistoryQuery: jest.fn(),
    deleteHistoryQuery: jest.fn()
  },
  historyQueryItemRepository: {
    getHistoryItem: jest.fn(),
    getHistoryItems: jest.fn(),
    createHistoryItem: jest.fn(),
    updateHistoryItem: jest.fn(),
    deleteHistoryItem: jest.fn(),
    deleteHistoryItemByHistoryId: jest.fn()
  }
}));
