import fs from 'node:fs/promises';
import fetch from 'node-fetch';
import OIBusService from './oibus.service';
import OIBusEngine from '../engine/oibus-engine';
import OibusEngineMock from '../tests/__mocks__/oibus-engine.mock';
import HistoryQueryEngine from '../engine/history-query-engine';
import HistoryQueryEngineMock from '../tests/__mocks__/history-query-engine.mock';
import { OibusUpdateCheckResponse } from '../../../shared/model/update.model';
import * as utils from '../service/utils';
import RepositoryService from './repository.service';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import EncryptionService from './encryption.service';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/logger.mock';
import { createProxyAgent } from './proxy.service';

jest.mock('node:fs/promises');
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');
jest.mock('./utils');
jest.mock('./proxy.service');

const oibusEngine: OIBusEngine = new OibusEngineMock();
const historyQueryEngine: HistoryQueryEngine = new HistoryQueryEngineMock();
const repositoryRepository: RepositoryService = new RepositoryServiceMock('', '');
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

const nowDateString = '2020-02-02T02:02:02.222Z';
const logger: pino.Logger = new PinoLogger();
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

let service: OIBusService;
describe('OIBus service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (createProxyAgent as jest.Mock).mockReturnValue(undefined);

    service = new OIBusService(oibusEngine, historyQueryEngine, repositoryRepository, encryptionService, logger);
  });

  it('should restart OIBus', async () => {
    await service.restartOIBus();
    expect(oibusEngine.stop).toHaveBeenCalled();
    expect(historyQueryEngine.stop).toHaveBeenCalled();
    expect(historyQueryEngine.start).toHaveBeenCalled();
    expect(oibusEngine.start).toHaveBeenCalled();
  });

  it('should stop OIBus', async () => {
    await service.stopOIBus();
    expect(oibusEngine.stop).toHaveBeenCalled();
    expect(historyQueryEngine.stop).toHaveBeenCalled();
  });

  it('should add values', async () => {
    await service.addValues('source', []);
    expect(oibusEngine.addExternalValues).toHaveBeenCalledWith('source', []);
  });

  it('should add file', async () => {
    await service.addFile('source', 'filePath');
    expect(oibusEngine.addExternalFile).toHaveBeenCalledWith('source', 'filePath');
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
    (repositoryRepository.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    const result = service.getRegistrationSettings();
    expect(result).toEqual(mockResult);
    expect(repositoryRepository.registrationRepository.getRegistrationSettings).toHaveBeenCalledTimes(2);
  });

  it('should update registration', async () => {
    (utils.generateRandomId as jest.Mock).mockReturnValue('1234');

    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false
    };
    (utils.getOIBusInfo as jest.Mock).mockReturnValueOnce({ version: 'v3.2.0' });
    (repositoryRepository.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce({ id: 'id1', name: 'MyOIBus' });
    const fetchResponse = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: '2020-02-02T02:12:02.222Z'
    };

    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.updateRegistrationSettings(command);
    expect(repositoryRepository.registrationRepository.updateRegistration).toHaveBeenCalledTimes(1);
    expect(utils.generateRandomId).toHaveBeenCalledWith(6);
    expect(repositoryRepository.registrationRepository.updateRegistration).toHaveBeenCalledWith(
      command,
      '1234',
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      '2020-02-02T02:12:02.222Z'
    );
  });

  it('should update registration with proxy', async () => {
    (utils.generateRandomId as jest.Mock).mockReturnValue('1234');

    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: 'user',
      proxyPassword: 'pass'
    };
    (utils.getOIBusInfo as jest.Mock).mockReturnValueOnce({ version: 'v3.2.0' });
    (repositoryRepository.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce({ id: 'id1', name: 'MyOIBus' });
    const fetchResponse = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: '2020-02-02T02:12:02.222Z'
    };

    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.updateRegistrationSettings(command);
    expect(repositoryRepository.registrationRepository.updateRegistration).toHaveBeenCalledTimes(1);
    expect(utils.generateRandomId).toHaveBeenCalledWith(6);
    expect(repositoryRepository.registrationRepository.updateRegistration).toHaveBeenCalledWith(
      command,
      '1234',
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      '2020-02-02T02:12:02.222Z'
    );
  });

  it('should update registration with proxy and without password', async () => {
    (utils.generateRandomId as jest.Mock).mockReturnValue('1234');

    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: '',
      proxyPassword: ''
    };
    (utils.getOIBusInfo as jest.Mock).mockReturnValueOnce({ version: 'v3.2.0' });
    (repositoryRepository.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce({ id: 'id1', name: 'MyOIBus' });
    const fetchResponse = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: '2020-02-02T02:12:02.222Z'
    };

    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.updateRegistrationSettings(command);
    expect(repositoryRepository.registrationRepository.updateRegistration).toHaveBeenCalledTimes(1);
    expect(utils.generateRandomId).toHaveBeenCalledWith(6);
    expect(repositoryRepository.registrationRepository.updateRegistration).toHaveBeenCalledWith(
      command,
      '1234',
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      '2020-02-02T02:12:02.222Z'
    );
  });

  it('should handle fetch error during registration update', async () => {
    (utils.generateRandomId as jest.Mock).mockReturnValue('1234');

    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false
    };
    (utils.getOIBusInfo as jest.Mock).mockReturnValueOnce({ version: 'v3.2.0' });
    (repositoryRepository.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce({ id: 'id1', name: 'MyOIBus' });
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
    (utils.generateRandomId as jest.Mock).mockReturnValue('1234');

    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false
    };
    (utils.getOIBusInfo as jest.Mock).mockReturnValueOnce({ version: 'v3.2.0' });
    (repositoryRepository.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce({ id: 'id1', name: 'MyOIBus' });
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
    (repositoryRepository.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValueOnce(null);
    (utils.generateRandomId as jest.Mock).mockReturnValue('1234');
    (repositoryRepository.engineRepository.getEngineSettings as jest.Mock).mockReturnValueOnce({ id: 'id1', name: 'MyOIBus' });

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
    expect(repositoryRepository.registrationRepository.activateRegistration).toHaveBeenCalledWith('2020-20-20T00:00:00.000Z', 'token');
  });

  it('should unregister', () => {
    service.unregister();
    expect(repositoryRepository.registrationRepository.unregister).toHaveBeenCalledTimes(1);
  });

  it('should check for update', async () => {
    (utils.getOIBusInfo as jest.Mock).mockReturnValue({ architecture: 'x64', platform: 'linux', version: 'v3.1.0' });
    const expectedUrl = `http://localhost:3333/api/update?platform=linux&architecture=x64`;
    const expectedFetchOptions = {
      timeout: 10000
    };
    const fetchResponse: OibusUpdateCheckResponse = {
      latestVersion: '1.0.0',
      changelog: 'Changelog'
    };

    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    const updateData = await service.checkForUpdate();

    expect(fetch).toHaveBeenCalledWith(expectedUrl, expectedFetchOptions);
    expect(updateData).toEqual({
      hasAvailableUpdate: true,
      actualVersion: 'v3.1.0',
      latestVersion: fetchResponse.latestVersion,
      changelog: fetchResponse.changelog
    });
  });

  it('should handle fetch error during update check', async () => {
    (utils.getOIBusInfo as jest.Mock).mockReturnValue({ architecture: 'x64', platform: 'linux', version: 'v3.1.0' });
    const expectedUrl = `http://localhost:3333/api/update?platform=linux&architecture=x64`;
    const expectedFetchOptions = {
      timeout: 10000
    };
    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });

    try {
      await service.checkForUpdate();
    } catch (error) {
      expect(fetch).toHaveBeenCalledWith(expectedUrl, expectedFetchOptions);
      expect(error).toEqual(new Error('Update check failed: Error: error'));
    }
  });

  it('should handle invalid fetch response during update check', async () => {
    (utils.getOIBusInfo as jest.Mock).mockReturnValue({ architecture: 'x64', platform: 'linux', version: 'v3.1.0' });
    const expectedUrl = `http://localhost:3333/api/update?platform=linux&architecture=x64`;
    const expectedFetchOptions = {
      timeout: 10000
    };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('invalid', { status: 404 })));

    try {
      await service.checkForUpdate();
    } catch (error) {
      expect(fetch).toHaveBeenCalledWith(expectedUrl, expectedFetchOptions);
      expect(error).toEqual(new Error('Update check failed with status code 404 and message: Not Found'));
    }
  });

  it('should download update', async () => {
    (utils.getOIBusInfo as jest.Mock).mockReturnValue({ architecture: 'x64', platform: 'linux', version: 'v3.1.0' });
    const expectedUrl = `http://localhost:3333/api/oibus?platform=linux&architecture=x64`;
    const expectedFilename = `oibus-linux_x64.zip`;

    await service.downloadUpdate();

    expect(utils.downloadFile).toHaveBeenCalledWith(expectedUrl, expectedFilename, 60000);
    expect(utils.unzip).toHaveBeenCalledWith(expectedFilename, '.');
    expect(utils.unzip).toHaveBeenCalledWith(expectedFilename, '.');
    expect(fs.unlink).toHaveBeenCalledWith(expectedFilename);
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
    (repositoryRepository.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    const fetchResponse = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));
    service.activateRegistration = jest.fn();

    await service.checkRegistration();
    expect(fetch).toHaveBeenCalledWith(`${mockResult.host}${mockResult.checkUrl}`, { method: 'GET', timeout: 10000 });
    expect(service.activateRegistration).toHaveBeenCalledWith('2020-02-02T02:02:02.222Z', 'access_token');
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
    (repositoryRepository.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
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
    (repositoryRepository.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    const fetchResponse = { status: 'DECLINED', expired: true, accessToken: 'access_token' };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));
    service.activateRegistration = jest.fn();

    await service.checkRegistration();
    expect(fetch).toHaveBeenCalledWith(`${mockResult.host}${mockResult.checkUrl}`, { method: 'GET', timeout: 10000 });
    expect(service.activateRegistration).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(`Registration not completed. Status: DECLINED`);
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
    (repositoryRepository.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
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
    (repositoryRepository.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
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
    (repositoryRepository.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
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
    (repositoryRepository.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
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
    (repositoryRepository.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
    const fetchResponse = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));
    service.activateRegistration = jest.fn();

    await service.checkRegistration();
    expect(fetch).toHaveBeenCalledWith(`${mockResult.host}${mockResult.checkUrl}`, { method: 'GET', timeout: 10000 });
    expect(service.activateRegistration).toHaveBeenCalledWith('2020-02-02T02:02:02.222Z', 'access_token');
  });
});

describe('OIBus service with PENDING registration', () => {
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
    (repositoryRepository.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(mockResult);
  });

  it('should get PENDING registration settings', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    service = new OIBusService(oibusEngine, historyQueryEngine, repositoryRepository, encryptionService, logger);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);

    const result = service.getRegistrationSettings();
    expect(result).toEqual(mockResult);
    expect(repositoryRepository.registrationRepository.getRegistrationSettings).toHaveBeenCalledTimes(2);
  });

  it('should stop and clear interval', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    service = new OIBusService(oibusEngine, historyQueryEngine, repositoryRepository, encryptionService, logger);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    await service.stopOIBus();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should activate registration and clear interval', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    service = new OIBusService(oibusEngine, historyQueryEngine, repositoryRepository, encryptionService, logger);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    await service.activateRegistration('2020-20-20T00:00:00.000Z', 'token');
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should unregister and clear interval', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    service = new OIBusService(oibusEngine, historyQueryEngine, repositoryRepository, encryptionService, logger);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    service.unregister();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});
