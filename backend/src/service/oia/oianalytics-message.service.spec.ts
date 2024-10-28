import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { getOIBusInfo } from '../utils';
import OIAnalyticsMessageService from './oianalytics-message.service';
import testData from '../../tests/utils/test-data';
import EncryptionService from '../encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { flushPromises } from '../../tests/utils/test-utils';
import { DateTime } from 'luxon';
import OIAnalyticsMessageRepository from '../../repository/config/oianalytics-message.repository';
import OIAnalyticsMessageRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-message-repository.mock';
import EngineRepository from '../../repository/config/engine.repository';
import EngineRepositoryMock from '../../tests/__mocks__/repository/config/engine-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import OIAnalyticsClient from './oianalytics-client.service';
import OianalyticsClientMock from '../../tests/__mocks__/service/oia/oianalytics-client.mock';
import IpFilterRepository from '../../repository/config/ip-filter.repository';
import IpFilterRepositoryMock from '../../tests/__mocks__/repository/config/ip-filter-repository.mock';
import CertificateRepository from '../../repository/config/certificate.repository';
import CertificateRepositoryMock from '../../tests/__mocks__/repository/config/certificate-repository.mock';
import UserRepository from '../../repository/config/user.repository';
import UserRepositoryMock from '../../tests/__mocks__/repository/config/user-repository.mock';
import OIAnalyticsRegistrationService from './oianalytics-registration.service';
import OIAnalyticsRegistrationServiceMock from '../../tests/__mocks__/service/oia/oianalytics-registration-service.mock';

jest.mock('node:fs/promises');
jest.mock('../utils');

const oIAnalyticsMessageRepository: OIAnalyticsMessageRepository = new OIAnalyticsMessageRepositoryMock();
const oIAnalyticsRegistrationService: OIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
const engineRepository: EngineRepository = new EngineRepositoryMock();
const ipFilterRepository: IpFilterRepository = new IpFilterRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const userRepository: UserRepository = new UserRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const northRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const oIAnalyticsClient: OIAnalyticsClient = new OianalyticsClientMock();

const logger: pino.Logger = new PinoLogger();

let service: OIAnalyticsMessageService;
describe('OIAnalytics Message Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (getOIBusInfo as jest.Mock).mockReturnValue(testData.engine.oIBusInfo);
    (oIAnalyticsMessageRepository.list as jest.Mock).mockReturnValue(testData.oIAnalytics.messages.oIBusList);
    (oIAnalyticsMessageRepository.create as jest.Mock).mockReturnValue(testData.oIAnalytics.messages.oIBusList[0]);
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.completed);
    (engineRepository.get as jest.Mock).mockReturnValue(testData.engine.settings);
    (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    (ipFilterRepository.findAll as jest.Mock).mockReturnValue(testData.ipFilters.list);
    (certificateRepository.findAll as jest.Mock).mockReturnValue(testData.certificates.list);
    (userRepository.findAll as jest.Mock).mockReturnValue(testData.users.list);
    (southRepository.findAllSouth as jest.Mock).mockReturnValue(testData.south.list);
    (southRepository.findSouthById as jest.Mock).mockImplementation(id => testData.south.list.find(element => element.id === id));
    (northRepository.findAllNorth as jest.Mock).mockReturnValue(testData.north.list);
    (northRepository.findNorthById as jest.Mock).mockImplementation(id => testData.north.list.find(element => element.id === id));

    service = new OIAnalyticsMessageService(
      oIAnalyticsMessageRepository,
      oIAnalyticsRegistrationService,
      engineRepository,
      scanModeRepository,
      ipFilterRepository,
      certificateRepository,
      userRepository,
      southRepository,
      northRepository,
      oIAnalyticsClient,
      encryptionService,
      logger
    );
  });

  afterEach(async () => {
    await flushPromises();
  });

  it('should properly start and stop', async () => {
    service.run = jest.fn();
    service.start();
    expect(service.run).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageRepository.list).toHaveBeenCalledWith({
      status: ['PENDING'],
      types: []
    });

    await service.stop();
    expect(logger.debug).toHaveBeenCalledWith(`Stopping OIAnalytics message service...`);
    expect(logger.debug).toHaveBeenCalledWith(`OIAnalytics message service stopped`);
  });

  it('should properly catch command exception', async () => {
    (oIAnalyticsClient.sendConfiguration as jest.Mock).mockImplementationOnce(() => {
      throw new Error('error');
    });

    service.start();
    service.stop();

    jest.advanceTimersByTime(1_000);

    await service.stop();

    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending message ${testData.oIAnalytics.messages.oIBusList[0].id} of type ${testData.oIAnalytics.messages.oIBusList[0].type}. error`
    );
    expect(oIAnalyticsMessageRepository.markAsErrored).toHaveBeenCalledWith(
      testData.oIAnalytics.messages.oIBusList[0].id,
      DateTime.fromISO(testData.constants.dates.FAKE_NOW).plus({ second: 1 }).toUTC().toISO()!,
      'error'
    );
    expect(logger.debug).toHaveBeenCalledWith('Waiting for OIAnalytics message to finish');
  });

  it('should properly send message and wait for it to finish before stopping', async () => {
    (oIAnalyticsClient.sendConfiguration as jest.Mock).mockImplementationOnce(() => {
      return new Promise(resolve => {
        setTimeout(() => resolve(null), 1_000);
      });
    });

    service.start(); // trigger a runProgress

    expect(oIAnalyticsClient.sendConfiguration).toHaveBeenCalledTimes(1);
    service.start(); // should enter only once in run

    expect(oIAnalyticsClient.sendConfiguration).toHaveBeenCalledTimes(1);

    service.stop();
    jest.advanceTimersByTime(1_000);

    await flushPromises();
    expect(oIAnalyticsClient.sendConfiguration).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.messages.oIBusList[0].id,
      DateTime.fromISO(testData.constants.dates.FAKE_NOW).plus({ second: 1 }).toUTC().toISO()!
    );
    expect(logger.debug).toHaveBeenCalledWith('Waiting for OIAnalytics message to finish');
    expect(logger.debug).toHaveBeenCalledWith('Full OIBus configuration sent to OIAnalytics');
  });

  it('should properly send message', async () => {
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValue({
      ...testData.oIAnalytics.registration.completed,
      publicCipherKey: null
    });
    (oIAnalyticsClient.sendConfiguration as jest.Mock).mockImplementationOnce(() => Promise.resolve());
    service.start(); // trigger a runProgress
    expect(oIAnalyticsClient.sendConfiguration).toHaveBeenCalledTimes(1);
  });

  it('should properly send message and trigger timeout', async () => {
    (oIAnalyticsClient.sendConfiguration as jest.Mock).mockImplementationOnce(() => {
      return new Promise<void>(resolve => {
        setTimeout(resolve, 100_000);
      });
    });

    service.start();
    service.stop();
    jest.advanceTimersByTime(10_000);

    // service.stop();

    expect(logger.debug).toHaveBeenCalledWith('Waiting for OIAnalytics message to finish');
    jest.advanceTimersByTime(20_000);

    await service.stop();
    expect(logger.debug).toHaveBeenCalledWith(`OIAnalytics message service stopped`);
  });
});

describe('OIAnalytics message service without message', () => {
  const anotherLogger: pino.Logger = new PinoLogger();

  beforeEach(() => {
    jest.clearAllMocks();

    (oIAnalyticsMessageRepository.list as jest.Mock).mockReturnValue([]);

    service = new OIAnalyticsMessageService(
      oIAnalyticsMessageRepository,
      oIAnalyticsRegistrationService,
      engineRepository,
      scanModeRepository,
      ipFilterRepository,
      certificateRepository,
      userRepository,
      southRepository,
      northRepository,
      oIAnalyticsClient,
      encryptionService,
      logger
    );
  });

  it('should properly start when no message retrieved', () => {
    expect(oIAnalyticsMessageRepository.markAsCompleted).not.toHaveBeenCalled();

    service.run = jest.fn();
    service.start();
    expect(service.run).not.toHaveBeenCalled();
  });

  it('should change logger', () => {
    service.setLogger(anotherLogger);
  });
});

describe('OIAnalytics message service without completed registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.pending);
    (oIAnalyticsMessageRepository.list as jest.Mock).mockReturnValue(testData.oIAnalytics.messages.oIBusList);

    service = new OIAnalyticsMessageService(
      oIAnalyticsMessageRepository,
      oIAnalyticsRegistrationService,
      engineRepository,
      scanModeRepository,
      ipFilterRepository,
      certificateRepository,
      userRepository,
      southRepository,
      northRepository,
      oIAnalyticsClient,
      encryptionService,
      logger
    );
  });

  it('should properly start and do nothing', () => {
    service.start();
    expect(oIAnalyticsMessageRepository.list).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith("OIBus is not registered to OIAnalytics. Messages won't be created");
    expect(logger.trace).toHaveBeenCalledWith("OIBus is not registered to OIAnalytics. Messages won't be sent");
  });
});
