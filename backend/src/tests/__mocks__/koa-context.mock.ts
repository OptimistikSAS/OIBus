import EncryptionServiceMock from './service/encryption-service.mock';
import NorthServiceMock from './service/north-service.mock';
import SouthServiceMock from './service/south-service.mock';
import OIBusServiceMock from './service/oibus-service.mock';
import EngineMetricsServiceMock from './service/metrics/engine-metrics-service.mock';
import ScanModeServiceMock from './service/scan-mode-service.mock';
import IpFilterServiceMock from './service/ip-filter-service.mock';
import OIAnalyticsRegistrationServiceMock from './service/oia/oianalytics-registration-service.mock';
import OIAnalyticsCommandServiceMock from './service/oia/oianalytics-command-service.mock';
import HistoryQueryServiceMock from './service/history-query-service.mock';
import UserServiceMock from './service/user-service.mock';
import LogServiceMock from './service/log-service.mock';
import CertificateServiceMock from './service/certificate-service.mock';

/**
 * Create a mock object for Koa Context
 */
export default jest.fn().mockImplementation(() => ({
  app: {
    scanModeService: new ScanModeServiceMock(),
    ipFilterService: new IpFilterServiceMock(),
    encryptionService: new EncryptionServiceMock(),
    northService: new NorthServiceMock(),
    southService: new SouthServiceMock(),
    historyQueryService: new HistoryQueryServiceMock(),
    oIBusService: new OIBusServiceMock(),
    oIAnalyticsRegistrationService: new OIAnalyticsRegistrationServiceMock(),
    oIAnalyticsCommandService: new OIAnalyticsCommandServiceMock(),
    engineMetricsService: new EngineMetricsServiceMock(),
    userService: new UserServiceMock(),
    logService: new LogServiceMock(),
    certificateService: new CertificateServiceMock(),
    logger: {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn()
    },
    whiteList: []
  },
  request: {},
  params: {},
  query: {},
  ok: jest.fn(),
  attachment: jest.fn(),
  created: jest.fn(),
  noContent: jest.fn(),
  badRequest: jest.fn(),
  internalServerError: jest.fn(),
  notFound: jest.fn(),
  throw: jest.fn(),
  set: jest.fn()
}));
