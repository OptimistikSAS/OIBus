/**
 * Create a mock object for Repository Service
 */
export default jest.fn().mockImplementation(() => ({
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
    searchSouthItems: jest.fn(),
    getSouthItem: jest.fn(),
    getSouthItems: jest.fn(),
    createSouthItem: jest.fn(),
    updateSouthItem: jest.fn(),
    deleteSouthItem: jest.fn(),
    deleteSouthItemByConnectorId: jest.fn()
  },
  historyQueryRepository: {
    getHistoryQueries: jest.fn(),
    getHistoryQuery: jest.fn(),
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
  },
  externalSourceRepository: {
    getExternalSources: jest.fn(),
    getExternalSource: jest.fn(),
    createExternalSource: jest.fn(),
    updateExternalSource: jest.fn(),
    deleteExternalSource: jest.fn()
  },
  ipFilterRepository: {
    getIpFilters: jest.fn(),
    getIpFilter: jest.fn(),
    createIpFilter: jest.fn(),
    updateIpFilter: jest.fn(),
    deleteIpFilter: jest.fn()
  },
  scanModeRepository: {
    getScanModes: jest.fn(),
    getScanMode: jest.fn(),
    createScanMode: jest.fn(),
    updateScanMode: jest.fn(),
    deleteScanMode: jest.fn()
  },
  proxyRepository: {
    getProxies: jest.fn(),
    getProxy: jest.fn(),
    createProxy: jest.fn(),
    updateProxy: jest.fn(),
    deleteProxy: jest.fn()
  },
  userRepository: {
    searchUsers: jest.fn(),
    getUserById: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    updatePassword: jest.fn(),
    deleteUser: jest.fn()
  },
  logRepository: {
    searchLogs: jest.fn()
  },
  engineRepository: {
    getEngineSettings: jest.fn(),
    updateEngineSettings: jest.fn()
  },
  subscriptionRepository: {
    getNorthSubscriptions: jest.fn(),
    getSubscribedNorthConnectors: jest.fn(),
    checkNorthSubscription: jest.fn(),
    createNorthSubscription: jest.fn(),
    deleteNorthSubscription: jest.fn(),
    deleteNorthSubscriptions: jest.fn()
  }
}));
