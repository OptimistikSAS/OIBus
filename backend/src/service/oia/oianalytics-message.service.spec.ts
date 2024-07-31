import RepositoryService from '../repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/service/repository-service.mock';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { getNetworkSettingsFromRegistration, getOIBusInfo } from '../utils';
import { RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import OIAnalyticsMessageService from './oianalytics-message.service';
import { OIAnalyticsMessageInfo } from '../../../../shared/model/oianalytics-message.model';
import OianalyticsConfigurationClientMock from '../../tests/__mocks__/service/oia/oianalytics-configuration-client.mock';
import OIAnalyticsConfigurationClient from './oianalytics-configuration.client';

jest.mock('node:fs/promises');
jest.mock('node-fetch');
jest.mock('../utils');

// @ts-ignore
jest.spyOn(process, 'exit').mockImplementation(() => {});

const repositoryService: RepositoryService = new RepositoryServiceMock('', '');
const configurationClient: OIAnalyticsConfigurationClient = new OianalyticsConfigurationClientMock('', '');

const nowDateString = '2020-02-02T02:02:02.222Z';
const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const infoMessage: OIAnalyticsMessageInfo = {
  id: '1234',
  status: 'ERRORED',
  type: 'info',
  error: '',
  completedDate: '2019-02-02T02:02:02.22Z',
  creationDate: '2019-02-02T02:02:02.22Z'
};

let service: OIAnalyticsMessageService;
describe('OIAnalytics message service with messages', () => {
  const registration: RegistrationSettingsDTO = {
    id: 'id',
    host: 'http://localhost:4200',
    acceptUnauthorized: false,
    useProxy: false,
    token: 'token',
    activationCode: '1234',
    status: 'REGISTERED',
    activationDate: '2020-20-20T00:00:00.000Z',
    activationExpirationDate: ''
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (getOIBusInfo as jest.Mock).mockReturnValue({ version: 'v3.2.0' });

    (repositoryService.oianalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registration);
    (repositoryService.oianalyticsMessageRepository.list as jest.Mock).mockReturnValue([infoMessage]);
    service = new OIAnalyticsMessageService(repositoryService, configurationClient, logger);
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

  it('should properly send message and wait for it to finish before stopping', async () => {
    service.sendMessage = jest.fn().mockImplementation(() => {
      return new Promise<void>(resolve => {
        setTimeout(resolve, 1000);
      });
    });

    service.start();
    service.start();

    service.stop();

    jest.advanceTimersByTime(1000);
    await service.stop();
    service.removeMessageFromQueue(infoMessage.id);

    expect(service.sendMessage).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for OIAnalytics message to finish');
    service.addMessageToQueue(infoMessage);
  });

  it('should properly send message and trigger timeout', async () => {
    service.sendMessage = jest.fn().mockImplementation(() => {
      return new Promise<void>(resolve => {
        setTimeout(resolve, 100_000);
      });
    });

    service.start();
    service.stop();
    jest.advanceTimersByTime(10_000);

    service.stop();

    expect(logger.debug).toHaveBeenCalledWith('Waiting for OIAnalytics message to finish');
    jest.advanceTimersByTime(20_000);

    await service.stop();
    expect(logger.debug).toHaveBeenCalledWith(`OIAnalytics message service stopped`);
  });

  it('should properly catch command exception', async () => {
    service.sendMessage = jest.fn().mockImplementation(() => {
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => reject(new Error('exception')), 1000);
      });
    });

    service.start();
    service.stop();

    jest.advanceTimersByTime(1000);

    await service.stop();
    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending message ${infoMessage.id} (created ${infoMessage.creationDate}) of type ${infoMessage.type}. Error: exception`
    );
    expect(service.sendMessage).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for OIAnalytics message to finish');
  });
});

describe('OIAnalytics message service without message', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (repositoryService.oianalyticsMessageRepository.list as jest.Mock).mockReturnValue([]);
    (getNetworkSettingsFromRegistration as jest.Mock).mockReturnValue({ host: 'http://localhost:4200', headers: {}, agent: undefined });

    service = new OIAnalyticsMessageService(repositoryService, configurationClient, logger);
  });

  it('should properly start when not registered', () => {
    const registration: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      token: 'token',
      activationCode: '1234',
      status: 'NOT_REGISTERED',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.oianalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registration);

    expect(getOIBusInfo).not.toHaveBeenCalled();
    expect(repositoryService.oianalyticsMessageRepository.markAsCompleted).not.toHaveBeenCalled();

    service.run = jest.fn();
    service.start();
    expect(logger.debug).toHaveBeenCalledWith(`Message service not started: OIAnalytics not registered`);
    expect(service.run).not.toHaveBeenCalled();
  });

  it('should properly start when registered', () => {
    const registration: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      token: 'token',
      activationCode: '1234',
      status: 'REGISTERED',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.oianalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registration);

    service.run = jest.fn();
    service.start();
    expect(service.run).not.toHaveBeenCalled();
  });

  it('should change logger', () => {
    service.setLogger(anotherLogger);
  });
});
