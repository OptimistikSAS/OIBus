import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from './encryption.service';
import NorthService from './north.service';
import pino from 'pino';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/config/north-connector-repository.mock';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';
import NorthMetricsRepositoryMock from '../tests/__mocks__/repository/log/north-metrics-repository.mock';
import testData from '../tests/utils/test-data';
import { NorthConnectorEntity } from '../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import CertificateRepository from '../repository/config/certificate.repository';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import OianalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';

jest.mock('./encryption.service');
jest.mock('./north-connector-metrics.service');

const validator = new JoiValidator();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const northMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const logRepository: LogRepository = new LogRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OianalyticsRegistrationRepositoryMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

const logger: pino.Logger = new PinoLogger();
let service: NorthService;
describe('north service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new NorthService(
      validator,
      northConnectorRepository,
      southConnectorRepository,
      northMetricsRepository,
      scanModeRepository,
      logRepository,
      certificateRepository,
      oIAnalyticsRegistrationRepository,
      oIAnalyticsMessageService,
      encryptionService
    );
  });

  it('should get a North connector settings', () => {
    service.findById('northId');
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledTimes(1);
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith('northId');
  });

  it('should get all North connector settings', () => {
    service.findAll();
    expect(northConnectorRepository.findAllNorth).toHaveBeenCalledTimes(1);
  });

  it('should create North connector', () => {
    const connector = service.runNorth(testData.north.list[0], 'myBaseFolder', logger);
    expect(connector).toBeDefined();
  });

  it('should not create North connector not installed', () => {
    let connector;
    let error;
    try {
      connector = service.runNorth(
        {
          id: 'northId',
          name: 'myNorth',
          description: 'my test connector',
          type: 'another'
        } as NorthConnectorEntity<NorthSettings>,
        'myBaseFolder',
        logger
      );
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('North connector of type another not installed'));
    expect(connector).not.toBeDefined();
  });

  it('should retrieve a list of north manifest', () => {
    const list = service.getInstalledNorthManifests();
    expect(list).toBeDefined();
  });
});
