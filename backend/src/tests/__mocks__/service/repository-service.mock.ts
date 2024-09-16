import SouthMetricsRepositoryMock from '../repository/south-metrics-repository.mock';
import NorthMetricsRepositoryMock from '../repository/north-metrics-repository.mock';
import ScanModeRepositoryMock from '../repository/scan-mode-repository.mock';
import SubscriptionRepositoryMock from '../repository/subscription-repository.mock';
import SouthConnectorRepositoryMock from '../repository/south-connector-repository.mock';
import NorthConnectorRepositoryMock from '../repository/north-connector-repository.mock';
import IpFilterRepositoryMock from '../repository/ip-filter-repository.mock';
import CryptoRepositoryMock from '../repository/crypto-repository.mock';

/**
 * Create a mock object for Repository Service
 */
export default jest.fn().mockImplementation(() => ({
  northConnectorRepository: new NorthConnectorRepositoryMock(),
  southConnectorRepository: new SouthConnectorRepositoryMock(),
  southItemRepository: {
    search: jest.fn(),
    list: jest.fn(),
    findById: jest.fn(),
    findAllForSouthConnector: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    deleteAllBySouthConnector: jest.fn(),
    createAndUpdateSouthItems: jest.fn()
  },
  northItemRepository: {
    list: jest.fn(),
    search: jest.fn(),
    findAllForNorthConnector: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    deleteAllByNorthConnector: jest.fn(),
    createAndUpdateNorthItems: jest.fn()
  },
  historyQueryRepository: {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  historyQueryItemRepository: {
    search: jest.fn(),
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteAllByHistoryId: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    createAndUpdateAll: jest.fn()
  },
  ipFilterRepository: new IpFilterRepositoryMock(),
  scanModeRepository: new ScanModeRepositoryMock(),
  certificateRepository: {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateNameAndDescription: jest.fn(),
    delete: jest.fn()
  },
  oianalyticsRegistrationRepository: {
    get: jest.fn(),
    register: jest.fn(),
    update: jest.fn(),
    createDefault: jest.fn(),
    unregister: jest.fn(),
    activate: jest.fn()
  },
  userRepository: {
    search: jest.fn(),
    findById: jest.fn(),
    findByLogin: jest.fn(),
    getHashedPasswordByLogin: jest.fn(),
    create: jest.fn(),
    updatePassword: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createDefault: jest.fn()
  },
  logRepository: {
    search: jest.fn(),
    getScopeById: jest.fn(),
    searchScopesByName: jest.fn(),
    createAll: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    deleteLogsByScopeId: jest.fn()
  },
  oianalyticsCommandRepository: {
    findAll: jest.fn(),
    search: jest.fn(),
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
    markAsCompleted: jest.fn(),
    markAsErrored: jest.fn(),
    markAsRunning: jest.fn(),
    markAsAcknowledged: jest.fn(),
    delete: jest.fn()
  },
  oianalyticsMessageRepository: {
    search: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    markAsCompleted: jest.fn(),
    markAsErrored: jest.fn()
  },
  engineRepository: {
    get: jest.fn(),
    update: jest.fn(),
    updateVersion: jest.fn(),
    createDefault: jest.fn()
  },
  cryptoRepository: new CryptoRepositoryMock(),
  subscriptionRepository: new SubscriptionRepositoryMock(),
  southMetricsRepository: new SouthMetricsRepositoryMock(),
  northMetricsRepository: new NorthMetricsRepositoryMock(),
  southCacheRepository: {
    getScanMode: jest.fn(),
    createOrUpdate: jest.fn(),
    getLatestMaxInstants: jest.fn(),
    deleteAllBySouthConnector: jest.fn(),
    deleteAllBySouthItem: jest.fn(),
    deleteAllByScanMode: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    reset: jest.fn(),
    createCustomTable: jest.fn(),
    runQueryOnCustomTable: jest.fn(),
    getQueryOnCustomTable: jest.fn()
  },
  transformerRepository: {
    createTransformer: jest.fn(),
    updateTransformer: jest.fn(),
    deleteTransformer: jest.fn(),
    getTransformer: jest.fn(),
    getTransformers: jest.fn()
  },
  northTransformerRepository: {
    addTransformer: jest.fn(),
    getTransformers: jest.fn(),
    removeTransformer: jest.fn()
  },
  southTransformerRepository: {
    addTransformer: jest.fn(),
    getTransformers: jest.fn(),
    removeTransformer: jest.fn()
  },
  historyTransformerRepository: {
    addTransformer: jest.fn(),
    getTransformers: jest.fn(),
    removeTransformer: jest.fn()
  }
}));
