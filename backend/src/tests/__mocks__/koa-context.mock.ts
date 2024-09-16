import RepositoryServiceMock from './service/repository-service.mock';
import ReloadServiceMock from './service/reload-service.mock';
import EncryptionServiceMock from './service/encryption-service.mock';
import NorthServiceMock from './service/north-service.mock';
import SouthServiceMock from './service/south-service.mock';
import OIBusServiceMock from './service/oibus-service.mock';
import EngineMetricsServiceMock from './service/engine-metrics-service.mock';
import NorthConnectorConfigServiceMock from './service/north-connector-config-service.mock';
import SouthConnectorConfigServiceMock from './service/south-connector-config-service.mock';
import ScanModeServiceMock from './service/scan-mode-service.mock';
import SubscriptionServiceMock from './service/subscription-service.mock';
import IpFilterServiceMock from './service/ip-filter-service.mock';
import OIAnalyticsRegistrationServiceMock from './service/oia/oianalytics-registration-service.mock';
import OIAnalyticsCommandServiceMock from './service/oia/oianalytics-command-service.mock';

/**
 * Create a mock object for Koa Context
 */
export default jest.fn().mockImplementation(() => ({
  app: {
    scanModeService: new ScanModeServiceMock(),
    subscriptionService: new SubscriptionServiceMock(),
    ipFilterService: new IpFilterServiceMock(),
    repositoryService: new RepositoryServiceMock(),
    reloadService: new ReloadServiceMock(),
    encryptionService: new EncryptionServiceMock(),
    northService: new NorthServiceMock(),
    northConnectorConfigService: new NorthConnectorConfigServiceMock(),
    southService: new SouthServiceMock(),
    southConnectorConfigService: new SouthConnectorConfigServiceMock(),
    oIBusService: new OIBusServiceMock(),
    oIAnalyticsRegistrationService: new OIAnalyticsRegistrationServiceMock(),
    oIAnalyticsCommandService: new OIAnalyticsCommandServiceMock(),
    engineMetricsService: new EngineMetricsServiceMock(),
    logger: {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn()
    },
    ipFilters: {
      whiteList: []
    }
  },
  request: {},
  params: {},
  query: {},
  ok: jest.fn(),
  created: jest.fn(),
  noContent: jest.fn(),
  badRequest: jest.fn(),
  internalServerError: jest.fn(),
  notFound: jest.fn(),
  throw: jest.fn(),
  set: jest.fn()
}));
