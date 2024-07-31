import fetch from 'node-fetch';
import RepositoryService from '../repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { EngineSettingsDTO, RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import EncryptionService from '../encryption.service';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import { createProxyAgent } from '../proxy-agent';
import { OIBusCommandDTO } from '../../../../shared/model/command.model';
import { generateRandomId, getNetworkSettingsFromRegistration, getOIBusInfo } from '../utils';
import CommandService from './command.service';
import CommandServiceMock from '../../tests/__mocks__/command-service.mock';
import OIAnalyticsMessageService from './message.service';
import OIAnalyticsMessageServiceMock from '../../tests/__mocks__/message-service.mock';
import RegistrationService from './registration.service';
import ReloadServiceMock from '../../tests/__mocks__/reload-service.mock';
import ReloadService from '../reload.service';

jest.mock('node:fs/promises');
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');
jest.mock('../utils');
jest.mock('../proxy-agent');

const repositoryService: RepositoryService = new RepositoryServiceMock('', '');
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const commandService: CommandService = new CommandServiceMock();
const oianalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const reloadService: ReloadService = new ReloadServiceMock();

const nowDateString = '2020-02-02T02:02:02.222Z';
const logger: pino.Logger = new PinoLogger();
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

const command: OIBusCommandDTO = {
  id: 'id1',
  type: 'UPGRADE',
  status: 'COMPLETED',
  ack: true,
  creationDate: '2023-01-01T12:00:00Z',
  completedDate: '2023-01-01T12:00:00Z',
  result: 'ok',
  version: '3.2.0',
  assetId: 'assetId'
};

const fakeEngineSettings: EngineSettingsDTO = {
  id: 'id1',
  name: 'MyOIBus',
  logParameters: {
    oia: {
      level: 'silent'
    }
  }
} as EngineSettingsDTO;

let service: RegistrationService;
describe('Registration service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (createProxyAgent as jest.Mock).mockReturnValue(undefined);

    service = new RegistrationService(
      repositoryService,
      encryptionService,
      commandService,
      oianalyticsMessageService,
      reloadService,
      logger
    );
  });

  it('should get NOT_REGISTERED registration settings', () => {
    const mockResult: RegistrationSettingsDTO = {
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
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    service.start();
    const result = service.getRegistrationSettings();
    expect(result).toEqual(mockResult);
    expect(repositoryService.registrationRepository.getRegistrationSettings).toHaveBeenCalledTimes(2);
  });

  it('should update registration', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('1234');

    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false
    };
    (getOIBusInfo as jest.Mock).mockReturnValueOnce({ version: 'v3.2.0' });
    (repositoryService.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce(fakeEngineSettings);
    const fetchResponse = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: '2020-02-02T02:12:02.222Z'
    };

    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.updateRegistrationSettings(command);
    expect(repositoryService.registrationRepository.updateRegistration).toHaveBeenCalledTimes(1);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(repositoryService.registrationRepository.updateRegistration).toHaveBeenCalledWith(
      command,
      '1234',
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      '2020-02-02T02:12:02.222Z'
    );
    expect(reloadService.restartLogger).not.toHaveBeenCalled();
  });

  it('should update registration with proxy', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('1234');

    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200/',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: 'user',
      proxyPassword: 'pass'
    };
    (getOIBusInfo as jest.Mock).mockReturnValueOnce({ version: 'v3.2.0' });
    (repositoryService.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce(fakeEngineSettings);
    const fetchResponse = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: '2020-02-02T02:12:02.222Z'
    };

    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.updateRegistrationSettings(command);
    expect(repositoryService.registrationRepository.updateRegistration).toHaveBeenCalledTimes(1);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(repositoryService.registrationRepository.updateRegistration).toHaveBeenCalledWith(
      command,
      '1234',
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      '2020-02-02T02:12:02.222Z'
    );
  });

  it('should update registration with proxy and without password', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('1234');

    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: '',
      proxyPassword: ''
    };
    (getOIBusInfo as jest.Mock).mockReturnValueOnce({ version: 'v3.2.0' });
    (repositoryService.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce(fakeEngineSettings);
    const fetchResponse = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: '2020-02-02T02:12:02.222Z'
    };

    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.updateRegistrationSettings(command);
    expect(repositoryService.registrationRepository.updateRegistration).toHaveBeenCalledTimes(1);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(repositoryService.registrationRepository.updateRegistration).toHaveBeenCalledWith(
      command,
      '1234',
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      '2020-02-02T02:12:02.222Z'
    );
  });

  it('should handle fetch error during registration update', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('1234');

    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false
    };
    (getOIBusInfo as jest.Mock).mockReturnValueOnce({ version: 'v3.2.0' });
    (repositoryService.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce(fakeEngineSettings);
    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });

    let error;
    try {
      await service.updateRegistrationSettings(command);
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(new Error('Registration failed: Error: error'));
  });

  it('should handle fetch bad response during registration update', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('1234');

    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false
    };
    (getOIBusInfo as jest.Mock).mockReturnValueOnce({ version: 'v3.2.0' });
    (repositoryService.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce(fakeEngineSettings);
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('invalid', { status: 404 })));

    let error;
    try {
      await service.updateRegistrationSettings(command);
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(new Error(`Registration failed with status code 404 and message: Not Found`));
  });

  it('should handle error if registration not found', async () => {
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValueOnce(null);
    (generateRandomId as jest.Mock).mockReturnValue('1234');

    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false
    };

    let error;
    try {
      await service.updateRegistrationSettings(command);
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(new Error('Registration settings not found'));
  });

  it('should activate registration', async () => {
    await service.activateRegistration('2020-20-20T00:00:00.000Z', 'token');
    expect(repositoryService.registrationRepository.activateRegistration).toHaveBeenCalledWith('2020-20-20T00:00:00.000Z', 'token');
  });

  it('should unregister', async () => {
    (repositoryService.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce(fakeEngineSettings);

    await service.onUnregister();
    expect(repositoryService.registrationRepository.unregister).toHaveBeenCalledTimes(1);
  });

  it('should check registration', async () => {
    const mockResult: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      token: 'token',
      activationCode: '1234',
      checkUrl: '/check/url',
      status: 'PENDING',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    const fetchResponse = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));
    service.activateRegistration = jest.fn();

    await service.checkRegistration();
    expect(fetch).toHaveBeenCalledWith(`${mockResult.host}${mockResult.checkUrl}`, { method: 'GET', timeout: 10000 });
    expect(service.activateRegistration).toHaveBeenCalledWith('2020-02-02T02:02:02.222Z', 'access_token');
    expect(reloadService.restartLogger).not.toHaveBeenCalled();
  });

  it('should check registration and return because already checking', async () => {
    const mockResult: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      token: 'token',
      activationCode: '1234',
      checkUrl: '/check/url',
      status: 'PENDING',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    (repositoryService.engineRepository.getEngineSettings as jest.Mock).mockReturnValue(fakeEngineSettings);
    const fetchResponse = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));
    service.activateRegistration = jest.fn();

    service.checkRegistration();
    await service.checkRegistration();
    expect(logger.trace).toHaveBeenCalledWith('On going registration check');
    await flushPromises();
  });

  it('should check registration but fail because of return status', async () => {
    const mockResult: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      token: 'token',
      activationCode: '1234',
      checkUrl: '/check/url',
      status: 'PENDING',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    const fetchResponse = { status: 'DECLINED', expired: true, accessToken: 'access_token' };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));
    service.activateRegistration = jest.fn();

    await service.checkRegistration();
    expect(fetch).toHaveBeenCalledWith(`${mockResult.host}${mockResult.checkUrl}`, { method: 'GET', timeout: 10000 });
    expect(service.activateRegistration).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(`Registration not completed. Status: DECLINED`);
    await service.checkRegistration();
  });

  it('should check registration but fail because of fetch response', async () => {
    const mockResult: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      token: 'token',
      activationCode: '1234',
      checkUrl: '/check/url',
      status: 'PENDING',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('invalid', { status: 404 })));
    await service.checkRegistration();
    expect(fetch).toHaveBeenCalledWith(`${mockResult.host}${mockResult.checkUrl}`, { method: 'GET', timeout: 10000 });
    expect(logger.error).toHaveBeenCalledWith(
      `Error 404 while checking registration status on ${mockResult.host}${mockResult.checkUrl}: Not Found`
    );
  });

  it('should check registration and fail when registration check url not set', async () => {
    const mockResult: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      token: 'token',
      activationCode: '1234',
      status: 'PENDING',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    await service.checkRegistration();
    expect(logger.error).toHaveBeenCalledWith('Error while checking registration status: Could not retrieve check URL');
  });

  it('should check registration and fail on fetch error', async () => {
    const mockResult: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      token: 'token',
      activationCode: '1234',
      checkUrl: 'check/url',
      status: 'PENDING',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });
    await service.checkRegistration();
    expect(logger.error).toHaveBeenCalledWith(
      `Error while checking registration status on ${mockResult.host}${mockResult.checkUrl}. Error: error`
    );
  });

  it('should check registration with proxy', async () => {
    const mockResult: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: 'user',
      proxyPassword: 'pass',
      token: 'token',
      activationCode: '1234',
      checkUrl: '/check/url',
      status: 'PENDING',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    const fetchResponse = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));
    service.activateRegistration = jest.fn();

    await service.checkRegistration();
    expect(fetch).toHaveBeenCalledWith(`${mockResult.host}${mockResult.checkUrl}`, { method: 'GET', timeout: 10000 });
    expect(service.activateRegistration).toHaveBeenCalledWith('2020-02-02T02:02:02.222Z', 'access_token');
  });

  it('should check registration with proxy and without password', async () => {
    const mockResult: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: '',
      proxyPassword: '',
      token: 'token',
      activationCode: '1234',
      checkUrl: '/check/url',
      status: 'PENDING',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    const fetchResponse = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));
    service.activateRegistration = jest.fn();

    await service.checkRegistration();
    expect(fetch).toHaveBeenCalledWith(`${mockResult.host}${mockResult.checkUrl}`, { method: 'GET', timeout: 10000 });
    expect(service.activateRegistration).toHaveBeenCalledWith('2020-02-02T02:02:02.222Z', 'access_token');
  });

  it('should check commands', async () => {
    service.checkRetrievedCommands = jest.fn();
    service.retrieveCommands = jest.fn();
    service.sendAckCommands = jest.fn();

    await service.checkCommands();
    expect(service.checkRetrievedCommands).toHaveBeenCalledTimes(1);
    expect(service.retrieveCommands).toHaveBeenCalledTimes(1);
    expect(service.sendAckCommands).toHaveBeenCalledTimes(1);
    expect(service.checkRetrievedCommands).toHaveBeenCalledTimes(1);
    expect(service.retrieveCommands).toHaveBeenCalledTimes(1);
    expect(service.sendAckCommands).toHaveBeenCalledTimes(1);
  });

  it('should check comm ands and return because already checking', async () => {
    service.checkRetrievedCommands = jest.fn().mockImplementation(() => {
      return new Promise<void>(resolve => {
        setTimeout(resolve, 1000);
      });
    });
    service.retrieveCommands = jest.fn();
    service.sendAckCommands = jest.fn();

    service.checkCommands();
    await service.checkCommands();
    expect(service.checkRetrievedCommands).toHaveBeenCalledTimes(1);
    expect(service.retrieveCommands).not.toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith('On going commands check');
    await flushPromises();
  });
});

describe('Registration service with PENDING registration', () => {
  const mockResult: RegistrationSettingsDTO = {
    id: 'id',
    host: 'http://localhost:4200',
    acceptUnauthorized: false,
    useProxy: false,
    token: 'token',
    activationCode: '1234',
    status: 'PENDING',
    checkUrl: 'http://localhost:4200/check/url',
    activationDate: '2020-20-20T00:00:00.000Z',
    activationExpirationDate: ''
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (createProxyAgent as jest.Mock).mockReturnValue(undefined);
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    service = new RegistrationService(
      repositoryService,
      encryptionService,
      commandService,
      oianalyticsMessageService,
      reloadService,
      logger
    );
  });

  it('should get PENDING registration settings', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    service.start();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);

    const result = service.getRegistrationSettings();
    expect(result).toEqual(mockResult);
    expect(repositoryService.registrationRepository.getRegistrationSettings).toHaveBeenCalledTimes(2);
  });

  it('should stop and clear interval', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    service.start();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    await service.stop();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should activate registration and clear interval', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    service.start();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    await service.activateRegistration('2020-20-20T00:00:00.000Z', 'token');
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should unregister and clear interval', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    service.start();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    service.unregister();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Registration service with REGISTERED registration', () => {
  const mockResult: RegistrationSettingsDTO = {
    id: 'id',
    host: 'http://localhost:4200',
    acceptUnauthorized: false,
    useProxy: false,
    token: 'token',
    activationCode: '1234',
    status: 'REGISTERED',
    checkUrl: 'http://localhost:4200/check/url',
    activationDate: '2020-20-20T00:00:00.000Z',
    activationExpirationDate: ''
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (createProxyAgent as jest.Mock).mockReturnValue(undefined);
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    service = new RegistrationService(
      repositoryService,
      encryptionService,
      commandService,
      oianalyticsMessageService,
      reloadService,
      logger
    );
  });

  it('should get REGISTERED registration settings', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    service.start();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);

    const result = service.getRegistrationSettings();
    expect(result).toEqual(mockResult);
    expect(repositoryService.registrationRepository.getRegistrationSettings).toHaveBeenCalledTimes(2);
  });

  it('should stop and clear interval', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    service.start();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    await service.stop();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should activate registration and clear interval', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    service.start();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    await service.activateRegistration('2020-20-20T00:00:00.000Z', 'token');
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should unregister and clear interval', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    service.start();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    service.unregister();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});

describe('OIBus service should interact with OIA and', () => {
  const mockResult: RegistrationSettingsDTO = {
    id: 'id',
    host: 'http://localhost:4200',
    acceptUnauthorized: false,
    useProxy: false,
    token: 'token',
    activationCode: '1234',
    status: 'REGISTERED',
    checkUrl: 'http://localhost:4200/check/url',
    activationDate: '2020-20-20T00:00:00.000Z',
    activationExpirationDate: ''
  };
  const mockEngineSettings: EngineSettingsDTO = {
    id: 'id1',
    name: 'MyOIBus',
    logParameters: {
      oia: {
        level: 'error'
      }
    }
  } as EngineSettingsDTO;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (createProxyAgent as jest.Mock).mockReturnValue(undefined);
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    (repositoryService.engineRepository.getEngineSettings as jest.Mock).mockReturnValue(mockEngineSettings);
    (getNetworkSettingsFromRegistration as jest.Mock).mockReturnValue({ host: 'http://localhost:4200', headers: {}, agent: undefined });
    service = new RegistrationService(
      repositoryService,
      encryptionService,
      commandService,
      oianalyticsMessageService,
      reloadService,
      logger
    );
  });

  it('should ack commands and return if no commands in OIBus', async () => {
    (repositoryService.commandRepository.searchCommandsList as jest.Mock).mockReturnValue([]);

    await service.sendAckCommands();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should ack commands', async () => {
    (repositoryService.commandRepository.searchCommandsList as jest.Mock).mockReturnValue([command]);

    const fetchResponse: Array<OIBusCommandDTO> = [{ id: 'id1' }] as Array<OIBusCommandDTO>;
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.sendAckCommands();
    expect(logger.trace).toHaveBeenCalledWith(`1 commands acknowledged`);
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/api/oianalytics/oibus/commands/status', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([command]),
      timeout: 10000,
      agent: undefined
    });
    expect(repositoryService.commandRepository.markAsAcknowledged).toHaveBeenCalledWith('id1');
  });

  it('should ack commands and manage 404 error', async () => {
    (repositoryService.commandRepository.searchCommandsList as jest.Mock).mockReturnValue([command]);

    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('invalid', { status: 404 })));

    await service.sendAckCommands();
    expect(logger.error).toHaveBeenCalledWith(
      `Error 404 while acknowledging 1 commands on http://localhost:4200/api/oianalytics/oibus/commands/status: Not Found`
    );
  });

  it('should ack commands and log error on fetch error', async () => {
    (repositoryService.commandRepository.searchCommandsList as jest.Mock).mockReturnValue([command]);

    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });

    await service.sendAckCommands();
    expect(logger.error).toHaveBeenCalledWith(
      `Error while acknowledging 1 commands on http://localhost:4200/api/oianalytics/oibus/commands/status. ${new Error('error')}`
    );
  });

  it('should check cancelled commands and return if no commands in OIBus', async () => {
    (repositoryService.commandRepository.searchCommandsList as jest.Mock).mockReturnValue([]);

    await service.checkRetrievedCommands();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should check cancelled commands and no command retrieved from oia', async () => {
    (repositoryService.commandRepository.searchCommandsList as jest.Mock).mockReturnValue([command]);

    const fetchResponse: Array<OIBusCommandDTO> = [];
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.checkRetrievedCommands();
    expect(logger.trace).toHaveBeenCalledWith(`No command cancelled among the 1 commands`);
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/api/oianalytics/oibus/commands/list-by-ids?ids=id1', {
      method: 'GET',
      headers: {},
      timeout: 10000,
      agent: undefined
    });
  });

  it('should check cancelled commands and cancel retrieved commands', async () => {
    (repositoryService.commandRepository.searchCommandsList as jest.Mock).mockReturnValue([command]);

    const fetchResponse: Array<OIBusCommandDTO> = [{ id: 'id1' }] as Array<OIBusCommandDTO>;
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.checkRetrievedCommands();
    expect(logger.trace).toHaveBeenCalledWith(`1 commands cancelled among the 1 pending commands`);
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/api/oianalytics/oibus/commands/list-by-ids?ids=id1', {
      method: 'GET',
      headers: {},
      timeout: 10000,
      agent: undefined
    });
    expect(repositoryService.commandRepository.cancel).toHaveBeenCalledWith('id1');
  });

  it('should check cancelled commands log error if fetch response not ok', async () => {
    (repositoryService.commandRepository.searchCommandsList as jest.Mock).mockReturnValue([command]);

    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('invalid', { status: 404 })));

    await service.checkRetrievedCommands();
    expect(logger.error).toHaveBeenCalledWith(
      `Error 404 while checking PENDING commands status on http://localhost:4200/api/oianalytics/oibus/commands/list-by-ids?ids=id1: Not Found`
    );
  });

  it('should check cancelled commands log error on fetch error', async () => {
    (repositoryService.commandRepository.searchCommandsList as jest.Mock).mockReturnValue([command]);

    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });

    await service.checkRetrievedCommands();
    expect(logger.error).toHaveBeenCalledWith(
      `Error while checking PENDING commands status on http://localhost:4200/api/oianalytics/oibus/commands/list-by-ids?ids=id1. ${new Error(
        'error'
      )}`
    );
  });

  it('should retrieve commands and trace logs if no command retrieved', async () => {
    const fetchResponse: Array<OIBusCommandDTO> = [];
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.retrieveCommands();
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/api/oianalytics/oibus/commands/pending', {
      method: 'GET',
      headers: {},
      timeout: 10000,
      agent: undefined
    });
  });

  it('should retrieve and create commands', async () => {
    const fetchResponse: Array<OIBusCommandDTO> = [command];
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.retrieveCommands();
    expect(logger.trace).toHaveBeenCalledWith(`1 commands to add`);
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/api/oianalytics/oibus/commands/pending', {
      method: 'GET',
      headers: {},
      timeout: 10000,
      agent: undefined
    });
    expect(repositoryService.commandRepository.create).toHaveBeenCalledWith('id1', command);
  });

  it('should retrieve log error on bad fetch response', async () => {
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('invalid', { status: 404 })));

    await service.retrieveCommands();
    expect(logger.error).toHaveBeenCalledWith(
      `Error 404 while retrieving commands on http://localhost:4200/api/oianalytics/oibus/commands/pending: Not Found`
    );
  });

  it('should retrieve log error on fetch error', async () => {
    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });

    await service.retrieveCommands();
    expect(logger.debug).toHaveBeenCalledWith(
      `Error while retrieving commands on http://localhost:4200/api/oianalytics/oibus/commands/pending. ${new Error('error')}`
    );
  });

  it('should unregister', async () => {
    service.unregister = jest.fn();
    await service.onUnregister();
    expect(service.unregister).toHaveBeenCalledTimes(1);
    expect(reloadService.restartLogger).toHaveBeenCalledTimes(1);
  });

  it('should update registration', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('1234');

    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false
    };
    (getOIBusInfo as jest.Mock).mockReturnValueOnce({ version: 'v3.2.0' });
    (repositoryService.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce(mockEngineSettings);
    const fetchResponse = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: '2020-02-02T02:12:02.222Z'
    };

    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.updateRegistrationSettings(command);
    expect(reloadService.restartLogger).toHaveBeenCalledTimes(1);
    expect(repositoryService.registrationRepository.updateRegistration).toHaveBeenCalledTimes(1);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(repositoryService.registrationRepository.updateRegistration).toHaveBeenCalledWith(
      command,
      '1234',
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      '2020-02-02T02:12:02.222Z'
    );
  });

  it('should check registration', async () => {
    const mockResult: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      token: 'token',
      activationCode: '1234',
      checkUrl: '/check/url',
      status: 'PENDING',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    (repositoryService.engineRepository.getEngineSettings as jest.Mock).mockReturnValue(mockEngineSettings);
    const fetchResponse = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));
    service.activateRegistration = jest.fn();

    await service.checkRegistration();
    expect(reloadService.restartLogger).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(`${mockResult.host}${mockResult.checkUrl}`, { method: 'GET', timeout: 10000 });
    expect(service.activateRegistration).toHaveBeenCalledWith('2020-02-02T02:02:02.222Z', 'access_token');
  });
});
