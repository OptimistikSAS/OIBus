import RepositoryService from '../repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import EncryptionService from '../encryption.service';
import pino from 'pino';
import fetch from 'node-fetch';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import { getNetworkSettingsFromRegistration, getOIBusInfo } from '../utils';
import { RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import OIAnalyticsMessageService from './message.service';
import { InfoMessageContent, OIAnalyticsMessageDTO } from '../../../../shared/model/oianalytics-message.model';

jest.mock('node:fs/promises');
jest.mock('node-fetch');
jest.mock('../utils');

// @ts-ignore
jest.spyOn(process, 'exit').mockImplementation(() => {});

const repositoryService: RepositoryService = new RepositoryServiceMock('', '');
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

const nowDateString = '2020-02-02T02:02:02.222Z';
const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const existingMessage: OIAnalyticsMessageDTO = {
  id: '1234',
  status: 'ERRORED',
  type: 'INFO',
  content: {} as InfoMessageContent
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

    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(registration);
    (repositoryService.oianalyticsMessageRepository.searchMessagesList as jest.Mock).mockReturnValue([existingMessage]);
    service = new OIAnalyticsMessageService(repositoryService, encryptionService, logger);
  });

  it('should properly start and stop', async () => {
    service.run = jest.fn();
    service.start();
    expect(service.run).toHaveBeenCalledTimes(1);
    expect(repositoryService.oianalyticsMessageRepository.searchMessagesList).toHaveBeenCalledWith({
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
    service.removeMessageFromQueue(existingMessage.id);

    expect(service.sendMessage).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for OIAnalytics message to finish');
    service.addMessageToQueue(existingMessage);
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
      `Error while sending message ${existingMessage.id} (created ${existingMessage.creationDate}) of type ${existingMessage.type}. Error: exception`
    );
    expect(service.sendMessage).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for OIAnalytics message to finish');
  });
});

describe('OIAnalytics message service without message', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (repositoryService.oianalyticsMessageRepository.searchMessagesList as jest.Mock).mockReturnValue([]);
    (getNetworkSettingsFromRegistration as jest.Mock).mockReturnValue({ host: 'http://localhost:4200', headers: {}, agent: undefined });

    service = new OIAnalyticsMessageService(repositoryService, encryptionService, logger);
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
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(registration);

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
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(registration);

    service.run = jest.fn();
    service.start();
    expect(service.run).not.toHaveBeenCalled();
  });

  it('should send message and trigger next run', async () => {
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response()));

    await service.sendMessage(existingMessage);
    expect(logger.trace).toHaveBeenCalledWith(
      `${existingMessage.id} (created ${existingMessage.creationDate}) of type ${existingMessage.type} sent`
    );
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/api/oianalytics/oibus/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(existingMessage),
      timeout: 15_000,
      agent: undefined
    });
    expect(repositoryService.oianalyticsMessageRepository.markAsCompleted).toHaveBeenCalledWith(existingMessage.id, nowDateString);

    jest.advanceTimersByTime(15000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should send message and manage 404 error', async () => {
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('invalid', { status: 404, statusText: 'Not Found' })));

    await service.sendMessage(existingMessage);
    expect(logger.error).toHaveBeenCalledWith(
      `Error 404 while sending message ${existingMessage.id} (created ${existingMessage.creationDate}) of type ` +
        `${existingMessage.type} on http://localhost:4200/api/oianalytics/oibus/message: Not Found`
    );
  });

  it('should send message and log error on fetch error', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });

    await service.sendMessage(existingMessage);
    expect(logger.debug).toHaveBeenCalledWith(
      `Error while sending message ${existingMessage.id} (created ${existingMessage.creationDate}) of type ` +
        `${existingMessage.type} on http://localhost:4200/api/oianalytics/oibus/message. ${new Error('error')}`
    );

    await service.stop();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

    await service.sendMessage(existingMessage);
    await service.sendMessage(existingMessage);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(15000);
    await service.stop();
  });

  it('should send message, log error and retry on fetch auth error', async () => {
    (fetch as unknown as jest.Mock).mockReturnValueOnce(
      Promise.resolve(new Response('invalid', { status: 401, statusText: 'Unauthorized' }))
    );

    await service.sendMessage(existingMessage);
    expect(logger.debug).toHaveBeenCalledWith(
      `Error 401 while sending message ${existingMessage.id} (created ${existingMessage.creationDate}) of type ` +
        `${existingMessage.type} on http://localhost:4200/api/oianalytics/oibus/message: Unauthorized`
    );

    jest.advanceTimersByTime(15000);
    await service.stop();
  });

  it('should change logger', () => {
    service.setLogger(anotherLogger);
  });
});
