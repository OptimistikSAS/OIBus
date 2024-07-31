import RepositoryServiceMock from './service/repository-service.mock';
import ReloadServiceMock from './service/reload-service.mock';
import EncryptionServiceMock from './service/encryption-service.mock';
import NorthServiceMock from './service/north-service.mock';
import SouthServiceMock from './service/south-service.mock';
import OIBusServiceMock from './service/oibus-service.mock';
import EngineMetricsServiceMock from './service/engine-metrics-service.mock';
import RegistrationServiceMock from './service/registration-service.mock';
import NorthConnectorConfigServiceMock from './service/north-connector-config-service.mock';
import SouthConnectorConfigServiceMock from './service/south-connector-config-service.mock';
import ScanModeConfigServiceMock from './service/scan-mode-config-service.mock';

/**
 * Create a mock object for Koa Context
 */
export default jest.fn().mockImplementation(() => ({
  app: {
    repositoryService: new RepositoryServiceMock(),
    reloadService: new ReloadServiceMock(),
    encryptionService: new EncryptionServiceMock(),
    northService: new NorthServiceMock(),
    northConnectorConfigService: new NorthConnectorConfigServiceMock(),
    southService: new SouthServiceMock(),
    southConnectorConfigService: new SouthConnectorConfigServiceMock(),
    scanModeConfigService: new ScanModeConfigServiceMock(),
    oibusService: new OIBusServiceMock(),
    registrationService: new RegistrationServiceMock(),
    engineMetricsService: new EngineMetricsServiceMock(),
    logger: {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn()
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
