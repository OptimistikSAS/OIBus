/**
 * Create a mock object for Repository Service
 */
export default jest.fn().mockImplementation(() => ({
  northConnectorRepository: {
    getNorthConnector: jest.fn(),
    getNorthConnectors: jest.fn(),
    createNorthConnector: jest.fn(),
    updateNorthConnector: jest.fn(),
    stopNorthConnector: jest.fn(),
    startNorthConnector: jest.fn(),
    deleteNorthConnector: jest.fn()
  },
  southConnectorRepository: {
    getSouthConnector: jest.fn(),
    getSouthConnectors: jest.fn(),
    createSouthConnector: jest.fn(),
    updateSouthConnector: jest.fn(),
    stopSouthConnector: jest.fn(),
    startSouthConnector: jest.fn(),
    deleteSouthConnector: jest.fn()
  },
  southItemRepository: {
    searchSouthItems: jest.fn(),
    listSouthItems: jest.fn(),
    getSouthItem: jest.fn(),
    getSouthItems: jest.fn(),
    createSouthItem: jest.fn(),
    updateSouthItem: jest.fn(),
    deleteSouthItem: jest.fn(),
    enableSouthItem: jest.fn(),
    disableSouthItem: jest.fn(),
    deleteAllSouthItems: jest.fn(),
    createAndUpdateSouthItems: jest.fn()
  },
  historyQueryRepository: {
    getHistoryQueries: jest.fn(),
    getHistoryQuery: jest.fn(),
    createHistoryQuery: jest.fn(),
    updateHistoryQuery: jest.fn(),
    startHistoryQuery: jest.fn(),
    stopHistoryQuery: jest.fn(),
    deleteHistoryQuery: jest.fn()
  },
  historyQueryItemRepository: {
    getHistoryItem: jest.fn(),
    getHistoryItems: jest.fn(),
    list: jest.fn(),
    createHistoryItem: jest.fn(),
    updateHistoryItem: jest.fn(),
    deleteHistoryItem: jest.fn(),
    enableHistoryItem: jest.fn(),
    disableHistoryItem: jest.fn(),
    deleteAllItems: jest.fn(),
    searchHistoryItems: jest.fn(),
    createAndUpdateItems: jest.fn()
  },
  externalSourceRepository: {
    getExternalSources: jest.fn(),
    getExternalSource: jest.fn(),
    findExternalSourceByReference: jest.fn(),
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
    searchLogs: jest.fn(),
    getScopeById: jest.fn(),
    searchScopesByName: jest.fn()
  },
  engineRepository: {
    getEngineSettings: jest.fn(),
    updateEngineSettings: jest.fn()
  },
  subscriptionRepository: {
    getNorthSubscriptions: jest.fn(),
    getExternalNorthSubscriptions: jest.fn(),
    getSubscribedNorthConnectors: jest.fn(),
    checkNorthSubscription: jest.fn(),
    checkExternalNorthSubscription: jest.fn(),
    createNorthSubscription: jest.fn(),
    createExternalNorthSubscription: jest.fn(),
    deleteNorthSubscription: jest.fn(),
    deleteExternalNorthSubscription: jest.fn(),
    deleteNorthSubscriptions: jest.fn(),
    deleteExternalNorthSubscriptions: jest.fn()
  },
  southMetricsRepository: {
    database: jest.fn(),
    initMetrics: jest.fn(),
    getMetrics: jest.fn(),
    updateMetrics: jest.fn(),
    removeMetrics: jest.fn()
  },
  northMetricsRepository: {
    database: jest.fn(),
    initMetrics: jest.fn(),
    getMetrics: jest.fn(),
    updateMetrics: jest.fn(),
    removeMetrics: jest.fn()
  },
  southCacheRepository: {
    deleteAllCacheScanModes: jest.fn(),
    deleteCacheScanModesByItem: jest.fn()
  }
}));
