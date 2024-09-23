import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from './encryption.service';
import pino from 'pino';
import SouthService from './south.service';
import ConnectionService from './connection.service';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import SouthConnectorMetricsRepository from '../repository/logs/south-connector-metrics.repository';
import SouthMetricsRepositoryMock from '../tests/__mocks__/repository/log/south-metrics-repository.mock';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import ConnectionServiceMock from '../tests/__mocks__/service/connection-service.mock';
import testData from '../tests/utils/test-data';
import { SouthConnectorEntity } from '../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import OIAnalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';

jest.mock('../south/south-opcua/south-opcua');

const validator = new JoiValidator();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const logRepository: LogRepository = new LogRepositoryMock();
const southMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const connectionService: ConnectionService = new ConnectionServiceMock();

const logger: pino.Logger = new PinoLogger();
let service: SouthService;
describe('south service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new SouthService(
      validator,
      southConnectorRepository,
      logRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      oIAnalyticsMessageService,
      encryptionService,
      connectionService
    );
  });

  it('should get a South connector settings', () => {
    service.findById('southId');
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledTimes(1);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith('southId');
  });

  it('should get a South connector items', () => {
    service.getSouthItems('southId');
    expect(southConnectorRepository.findAllItemsForSouth).toHaveBeenCalledTimes(1);
    expect(southConnectorRepository.findAllItemsForSouth).toHaveBeenCalledWith('southId');
  });

  it('should get all South connector settings', () => {
    service.findAll();
    expect(southConnectorRepository.findAllSouth).toHaveBeenCalledTimes(1);
  });

  it('should create South connector', () => {
    const connector = service.runSouth(testData.south.list[0], jest.fn(), 'myBaseFolder', logger);
    expect(connector).toBeDefined();
  });

  it('should not create South connector not installed', () => {
    let connector;
    let error;
    try {
      connector = service.runSouth(
        {
          id: 'southId',
          name: 'mySouth',
          description: 'my test connector',
          type: 'another'
        } as SouthConnectorEntity<SouthSettings, SouthItemSettings>,
        jest.fn(),
        'myBaseFolder',
        logger
      );
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('South connector of type another not installed'));
    expect(connector).not.toBeDefined();
  });

  it('should retrieve a list of south manifest', () => {
    const list = service.getInstalledSouthManifests();
    expect(list).toBeDefined();
  });
});
