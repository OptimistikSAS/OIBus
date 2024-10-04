import RepositoryService from '../repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/service/repository-service.mock';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { getNetworkSettingsFromRegistration, getOIBusInfo } from '../utils';
import OIAnalyticsMessageService from './oianalytics-message.service';
import testData from '../../tests/utils/test-data';
import EncryptionService from '../encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { flushPromises } from '../../tests/utils/test-utils';
import fetch from 'node-fetch';
import { DateTime } from 'luxon';

jest.mock('node:fs/promises');
jest.mock('node-fetch');
jest.mock('../utils');

const repositoryService: RepositoryService = new RepositoryServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

const logger: pino.Logger = new PinoLogger();

let service: OIAnalyticsMessageService;
describe('OIAnalytics Message Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (getOIBusInfo as jest.Mock).mockReturnValue(testData.engine.oIBusInfo);
    (repositoryService.oianalyticsMessageRepository.list as jest.Mock).mockReturnValue(testData.oIAnalytics.messages.oIBusList);
    (repositoryService.oianalyticsMessageRepository.create as jest.Mock).mockReturnValue(testData.oIAnalytics.messages.oIBusList[0]);
    (repositoryService.oianalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.completed);
    (repositoryService.engineRepository.get as jest.Mock).mockReturnValue(testData.engine.settings);
    (repositoryService.cryptoRepository.getCryptoSettings as jest.Mock).mockReturnValue(testData.engine.crypto);
    (repositoryService.scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    (repositoryService.southConnectorRepository.findAll as jest.Mock).mockReturnValue(testData.south.list);
    (repositoryService.northConnectorRepository.findAll as jest.Mock).mockReturnValue(testData.north.list);

    service = new OIAnalyticsMessageService(repositoryService, encryptionService, logger);
  });

  afterEach(async () => {
    await flushPromises();
  });

  it('should properly start and stop', async () => {
    service.run = jest.fn();
    service.start();
    expect(service.run).toHaveBeenCalledTimes(1);
    expect(repositoryService.oianalyticsMessageRepository.list).toHaveBeenCalledWith({
      status: ['PENDING'],
      types: []
    });

    await service.stop();
    expect(logger.debug).toHaveBeenCalledWith(`Stopping OIAnalytics message service...`);
    expect(logger.debug).toHaveBeenCalledWith(`OIAnalytics message service stopped`);
  });

  it('should properly catch command exception', async () => {
    (getNetworkSettingsFromRegistration as jest.Mock).mockReturnValueOnce({
      host: 'http://localhost:4200',
      agent: undefined,
      headers: { authorization: `Bearer token` }
    });
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve({ ok: false, status: 400, statusText: 'statusText' }));

    service.start();
    service.stop();

    jest.advanceTimersByTime(1_000);

    await service.stop();

    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending message ${testData.oIAnalytics.messages.oIBusList[0].id} of type ${testData.oIAnalytics.messages.oIBusList[0].type}. Error: statusText`
    );
    expect(repositoryService.oianalyticsMessageRepository.markAsErrored).toHaveBeenCalledWith(
      testData.oIAnalytics.messages.oIBusList[0].id,
      DateTime.fromISO(testData.constants.dates.FAKE_NOW).plus({ second: 1 }).toUTC().toISO()!,
      'statusText'
    );
    expect(logger.debug).toHaveBeenCalledWith('Waiting for OIAnalytics message to finish');
  });

  it('should properly send message and wait for it to finish before stopping', async () => {
    (getNetworkSettingsFromRegistration as jest.Mock).mockImplementationOnce(() => {
      return new Promise(resolve => {
        setTimeout(
          () =>
            resolve({
              host: 'http://localhost:4200',
              agent: undefined,
              headers: { authorization: `Bearer token` }
            }),
          1_000
        );
      });
    });
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({}))));

    service.start(); // trigger a runProgress

    expect(getNetworkSettingsFromRegistration).toHaveBeenCalledTimes(1);
    service.start(); // should enter only once in run

    expect(getNetworkSettingsFromRegistration).toHaveBeenCalledTimes(1);

    service.stop();
    jest.advanceTimersByTime(1_000);

    await flushPromises();
    expect(getNetworkSettingsFromRegistration).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(repositoryService.oianalyticsMessageRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.messages.oIBusList[0].id,
      DateTime.fromISO(testData.constants.dates.FAKE_NOW).plus({ second: 1 }).toUTC().toISO()!
    );
    expect(logger.debug).toHaveBeenCalledWith('Waiting for OIAnalytics message to finish');
    expect(logger.debug).toHaveBeenCalledWith('Full OIBus configuration sent to OIAnalytics');
  });

  it('should properly send message and trigger timeout', async () => {
    (getNetworkSettingsFromRegistration as jest.Mock).mockImplementationOnce(() => {
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

    (repositoryService.oianalyticsMessageRepository.list as jest.Mock).mockReturnValue([]);

    service = new OIAnalyticsMessageService(repositoryService, encryptionService, logger);
  });

  it('should properly start when no message retrieved', () => {
    expect(repositoryService.oianalyticsMessageRepository.markAsCompleted).not.toHaveBeenCalled();

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
    (repositoryService.oianalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.pending);
    (repositoryService.oianalyticsMessageRepository.list as jest.Mock).mockReturnValue(testData.oIAnalytics.messages.oIBusList);

    service = new OIAnalyticsMessageService(repositoryService, encryptionService, logger);
  });

  it('should properly start and do nothing', () => {
    service.start();
    expect(repositoryService.oianalyticsMessageRepository.list).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith("OIBus is not registered to OIAnalytics. Messages won't be created");
    expect(logger.trace).toHaveBeenCalledWith("OIBus is not registered to OIAnalytics. Messages won't be sent");
  });
});
