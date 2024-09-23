import fetch from 'node-fetch';
import { RegistrationSettingsCommandDTO } from '../../../../shared/model/engine.model';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import EncryptionService from '../encryption.service';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { generateRandomId, getNetworkSettingsFromRegistration, getOIBusInfo } from '../utils';
import OIAnalyticsRegistrationService from './oianalytics-registration.service';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import OianalyticsRegistrationRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import EngineRepository from '../../repository/config/engine.repository';
import EngineRepositoryMock from '../../tests/__mocks__/repository/config/engine-repository.mock';
import testData from '../../tests/utils/test-data';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { flushPromises } from '../../tests/utils/test-utils';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';

jest.mock('node:fs/promises');
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');
jest.mock('../../web-server/controllers/validators/joi.validator');
jest.mock('../utils');

const validator = new JoiValidator();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OianalyticsRegistrationRepositoryMock();
const engineRepository: EngineRepository = new EngineRepositoryMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

const logger: pino.Logger = new PinoLogger();

let service: OIAnalyticsRegistrationService;
describe('OIAnalytics Registration Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (generateRandomId as jest.Mock).mockReturnValue('123ABC');
    (getOIBusInfo as jest.Mock).mockReturnValue(testData.engine.oIBusInfo);
    (getNetworkSettingsFromRegistration as jest.Mock).mockReturnValue({
      host: 'http://localhost:4200',
      agent: undefined,
      headers: { authorization: `Bearer token` }
    });
    (engineRepository.get as jest.Mock).mockReturnValue(testData.engine.settings);

    service = new OIAnalyticsRegistrationService(validator, oIAnalyticsRegistrationRepository, engineRepository, encryptionService, logger);
  });

  it('should start with completed registration', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    (oIAnalyticsRegistrationRepository.get as jest.Mock)
      .mockReturnValueOnce(testData.oIAnalytics.registration.completed)
      .mockReturnValueOnce(testData.oIAnalytics.registration.pending);

    service.start();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(oIAnalyticsRegistrationRepository.get).toHaveBeenCalledTimes(1);

    service.start();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsRegistrationRepository.get).toHaveBeenCalledTimes(2);
  });

  it('should get registration settings', () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.completed);

    expect(service.getRegistrationSettings()).toEqual(testData.oIAnalytics.registration.completed);
  });

  it('should register', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.completed);
    const fetchResponse = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: testData.constants.dates.FAKE_NOW
    };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.register(testData.oIAnalytics.registration.command);

    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(encryptionService.encryptText).not.toHaveBeenCalled();
    expect(engineRepository.get).toHaveBeenCalledTimes(1);
    expect(getOIBusInfo).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsRegistrationRepository.register).toHaveBeenCalledWith(
      testData.oIAnalytics.registration.command,
      '123ABC',
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      testData.constants.dates.FAKE_NOW
    );
  });

  it('should update registration with proxy', async () => {
    const command: Omit<OIAnalyticsRegistration, 'id' | 'status' | 'activationDate'> = {
      host: 'http://localhost:4200/',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: 'user',
      proxyPassword: 'pass'
    };
    const fetchResponse = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: testData.constants.dates.FAKE_NOW
    };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.register(command);
    expect(encryptionService.encryptText).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsRegistrationRepository.register).toHaveBeenCalledWith(
      command,
      '123ABC',
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      testData.constants.dates.FAKE_NOW
    );
  });

  it('should handle fetch error during registration', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.completed);
    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });

    await expect(service.register(testData.oIAnalytics.registration.command)).rejects.toThrow(
      new Error('Registration failed: Error: error')
    );
  });

  it('should handle fetch bad response during registration update', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.completed);
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('invalid', { status: 404 })));

    await expect(service.register(testData.oIAnalytics.registration.command)).rejects.toThrow(
      `Registration failed with status code 404 and message: Not Found`
    );
  });

  it('should edit registration connection settings', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.completed);

    await service.editConnectionSettings(testData.oIAnalytics.registration.command);

    expect(oIAnalyticsRegistrationRepository.update).toHaveBeenCalledWith(testData.oIAnalytics.registration.command);
  });

  it('should edit registration with proxy', async () => {
    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200/',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: 'user',
      proxyPassword: 'pass'
    };
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.completed);

    await service.editConnectionSettings(command);

    expect(oIAnalyticsRegistrationRepository.update).toHaveBeenCalledWith(command);
  });

  it('should unregister and not clear interval if it does not exist', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    service.unregister();

    expect(oIAnalyticsRegistrationRepository.unregister).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });

  it('should unregister and clear interval if it exists', () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.pending);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    service.start(); // start with pending registration to set interval
    service.unregister();

    expect(oIAnalyticsRegistrationRepository.unregister).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should stop and clear interval if it exists', () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.pending);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    service.start(); // start with pending registration to set interval
    service.stop();
    service.stop();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should check registration', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock)
      .mockReturnValueOnce(testData.oIAnalytics.registration.pending)
      .mockReturnValueOnce(testData.oIAnalytics.registration.pending);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const fetchResponse = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    service.start(); // start with pending registration to set interval
    await service.checkRegistration();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(encryptionService.encryptText).toHaveBeenCalledWith('access_token');
    expect(oIAnalyticsRegistrationRepository.activate).toHaveBeenCalledWith(testData.constants.dates.FAKE_NOW, 'access_token');
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should check registration and return because already checking', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.pending);
    const fetchResponse = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    service.checkRegistration();
    await service.checkRegistration();

    expect(logger.trace).toHaveBeenCalledWith('On going registration check');
    await flushPromises();
  });

  it('should check registration but fail because of return status', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.pending);
    const fetchResponse = { status: 'DECLINED', expired: true, accessToken: 'access_token' };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    await service.checkRegistration();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(`Registration not completed. Status: DECLINED`);
  });

  it('should check registration but fail because of fetch response', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.pending);
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('invalid', { status: 404 })));

    await service.checkRegistration();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(`Error 404 while checking registration status on `));
  });

  it('should check registration and fail when registration check url not set', async () => {
    const specificRegistration: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.oIAnalytics.registration.pending));
    specificRegistration.checkUrl = '';
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(specificRegistration);

    await service.checkRegistration();

    expect(logger.error).toHaveBeenCalledWith('Error while checking registration status: could not retrieve check URL');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should check registration and fail on fetch error', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.pending);
    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });

    await service.checkRegistration();

    expect(logger.error).toHaveBeenCalledWith(`Error while checking registration status: Error: error`);
  });
});
