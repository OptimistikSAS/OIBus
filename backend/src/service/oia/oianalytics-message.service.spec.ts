import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { getOIBusInfo } from '../utils';
import testData from '../../tests/utils/test-data';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import OIAnalyticsMessageService from './oianalytics-message.service';
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
import HistoryQueryRepository from '../../repository/config/history-query.repository';
import HistoryQueryRepositoryMock from '../../tests/__mocks__/repository/config/history-query-repository.mock';
import { OIAnalyticsMessageHistoryQueries } from '../../model/oianalytics-message.model';
import TransformerRepository from '../../repository/config/transformer.repository';
import TransformerRepositoryMock from '../../tests/__mocks__/repository/config/transformer-repository.mock';
import { StandardTransformer } from '../../model/transformer.model';
import IsoTransformer from '../transformers/iso-transformer';
import DeferredPromise from '../deferred-promise';

jest.mock('node:fs/promises');
jest.mock('../utils');
jest.mock('../encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const oIAnalyticsMessageRepository: OIAnalyticsMessageRepository = new OIAnalyticsMessageRepositoryMock();
const oIAnalyticsRegistrationService: OIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
const engineRepository: EngineRepository = new EngineRepositoryMock();
const ipFilterRepository: IpFilterRepository = new IpFilterRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const userRepository: UserRepository = new UserRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const northRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const historyQueryRepository: HistoryQueryRepository = new HistoryQueryRepositoryMock();
const transformerRepository: TransformerRepository = new TransformerRepositoryMock();
const oIAnalyticsClient: OIAnalyticsClient = new OianalyticsClientMock();

const logger: pino.Logger = new PinoLogger();

let service: OIAnalyticsMessageService;
describe('OIAnalytics Message Service', () => {
  const standardTransformer: StandardTransformer = {
    id: IsoTransformer.transformerName,
    type: 'standard',
    functionName: IsoTransformer.transformerName,
    inputType: 'any',
    outputType: 'any'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (getOIBusInfo as jest.Mock).mockReturnValue(testData.engine.oIBusInfo);
    (oIAnalyticsMessageRepository.list as jest.Mock).mockReturnValue(testData.oIAnalytics.messages.oIBusList);
    (oIAnalyticsMessageRepository.create as jest.Mock).mockReturnValue(testData.oIAnalytics.messages.oIBusList[0]);
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.completed);
    (engineRepository.get as jest.Mock).mockReturnValue(testData.engine.settings);
    (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    (ipFilterRepository.list as jest.Mock).mockReturnValue(testData.ipFilters.list);
    (certificateRepository.list as jest.Mock).mockReturnValue(testData.certificates.list);
    (userRepository.list as jest.Mock).mockReturnValue(testData.users.list);
    (southRepository.findAllSouth as jest.Mock).mockReturnValue(testData.south.list);
    (southRepository.findSouthById as jest.Mock).mockImplementation(id => testData.south.list.find(element => element.id === id));
    (northRepository.findAllNorth as jest.Mock).mockReturnValue(testData.north.list);
    (northRepository.findNorthById as jest.Mock).mockImplementation(id => testData.north.list.find(element => element.id === id));
    (transformerRepository.list as jest.Mock).mockReturnValue([...testData.transformers.list, standardTransformer]);

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
      historyQueryRepository,
      transformerRepository,
      oIAnalyticsClient,
      logger
    );
  });

  afterEach(async () => {
    await flushPromises();
    oIAnalyticsRegistrationService.registrationEvent.removeAllListeners();
  });

  it('should properly start and stop', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    service['retryMessageInterval'] = setTimeout(() => null);
    service.run = jest.fn();
    service.start();
    expect(service.run).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageRepository.list).toHaveBeenCalledWith({
      status: ['PENDING'],
      types: []
    });

    await service.stop();
    service.resolveDeferredPromise();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(`Stopping OIAnalytics message service...`);
    expect(logger.debug).toHaveBeenCalledWith(`OIAnalytics message service stopped`);
  });

  it('should properly create full config message on registration', () => {
    service.createFullConfigMessageIfNotPending = jest.fn();
    service.start();
    expect(service.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    expect(service.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(2);
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

    expect(logger.debug).toHaveBeenCalledWith('Waiting for OIAnalytics message to finish');
    jest.advanceTimersByTime(20_000);

    await service.stop();
    expect(logger.debug).toHaveBeenCalledWith(`OIAnalytics message service stopped`);
  });

  it('should properly stop with stop timeout already set', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const deferredPromise = new DeferredPromise();
    service['runProgress$'] = deferredPromise;
    service['stopTimeout'] = setTimeout(() => {
      deferredPromise.resolve();
    }, 30_000);

    service.stop();
    jest.advanceTimersByTime(30_000);
    await flushPromises();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should properly resend message if fetch fails', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    (oIAnalyticsClient.sendConfiguration as jest.Mock) = jest.fn().mockImplementationOnce(() => {
      throw new Error('fetch error');
    });
    service['retryMessageInterval'] = 1 as unknown as NodeJS.Timeout;

    service.start();
    await flushPromises();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      `Retrying message ${testData.oIAnalytics.messages.oIBusList[0].id} of type ${testData.oIAnalytics.messages.oIBusList[0].type} after error: fetch error`
    );
  });

  it('should not resend message if fetch fails because of Bad request', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    (oIAnalyticsClient.sendConfiguration as jest.Mock) = jest.fn().mockImplementationOnce(() => {
      throw new Error('Bad Request');
    });

    service.start();
    await flushPromises();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending message ${testData.oIAnalytics.messages.oIBusList[0].id} of type ${testData.oIAnalytics.messages.oIBusList[0].type}: Bad Request`
    );
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
      historyQueryRepository,
      transformerRepository,
      oIAnalyticsClient,
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
      historyQueryRepository,
      transformerRepository,
      oIAnalyticsClient,
      logger
    );
  });

  it('should properly start and do nothing', () => {
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock)
      .mockReturnValueOnce(testData.oIAnalytics.registration.pending)
      .mockReturnValueOnce(testData.oIAnalytics.registration.pending)
      .mockReturnValueOnce(testData.oIAnalytics.registration.pending);
    (oIAnalyticsMessageRepository.list as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.messages.oIBusList);
    service.start();
    expect(oIAnalyticsMessageRepository.list).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith("OIBus is not registered to OIAnalytics. Full config message won't be created");
    expect(logger.debug).toHaveBeenCalledWith("OIBus is not registered to OIAnalytics. History query message won't be created");
    expect(logger.trace).toHaveBeenCalledWith("OIBus is not registered to OIAnalytics. Messages won't be sent");
  });

  it('should not create save history query message if not register', async () => {
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.pending);
    service.createFullHistoryQueriesMessageIfNotPending();
    expect(logger.debug).toHaveBeenCalledWith("OIBus is not registered to OIAnalytics. History query message won't be created");
    expect(oIAnalyticsMessageRepository.list).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageRepository.create).not.toHaveBeenCalled();
  });

  it('should not create save history query message if message already exists', async () => {
    const saveHistoryQueryMessage: OIAnalyticsMessageHistoryQueries = {
      id: 'messageId2',
      status: 'PENDING',
      error: null,
      completedDate: null,
      type: 'history-queries'
    };
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.completed);
    (oIAnalyticsMessageRepository.list as jest.Mock).mockReturnValueOnce([saveHistoryQueryMessage]);
    service.createFullHistoryQueriesMessageIfNotPending();
    expect(oIAnalyticsMessageRepository.create).not.toHaveBeenCalled();
  });

  it('should create save history query message and run it', async () => {
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.pending);
    (oIAnalyticsMessageRepository.list as jest.Mock).mockReturnValueOnce([]);
    service.start();
    const saveHistoryQueryMessage: OIAnalyticsMessageHistoryQueries = {
      id: 'messageId3',
      status: 'PENDING',
      error: null,
      completedDate: null,
      type: 'history-queries'
    };
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock)
      .mockReturnValueOnce(testData.oIAnalytics.registration.completed)
      .mockReturnValueOnce(testData.oIAnalytics.registration.completed)
      .mockReturnValueOnce(testData.oIAnalytics.registration.completed);
    (oIAnalyticsMessageRepository.list as jest.Mock).mockReturnValueOnce([]);
    (historyQueryRepository.findAllHistoriesFull as jest.Mock).mockReturnValueOnce(testData.historyQueries.list);
    (oIAnalyticsMessageRepository.create as jest.Mock).mockReturnValueOnce(saveHistoryQueryMessage);
    service.createFullHistoryQueriesMessageIfNotPending();
    expect(oIAnalyticsMessageRepository.create).toHaveBeenCalledWith({
      type: 'history-queries'
    });
    expect(oIAnalyticsClient.sendHistoryQuery).toHaveBeenCalledWith(testData.oIAnalytics.registration.completed, expect.anything());
  });
});
