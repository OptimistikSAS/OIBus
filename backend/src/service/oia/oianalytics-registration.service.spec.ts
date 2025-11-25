import { RegistrationSettingsCommandDTO } from '../../../shared/model/engine.model';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { encryptionService } from '../encryption.service';
import pino from 'pino';
import crypto from 'node:crypto';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { getOIBusInfo } from '../utils';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import OianalyticsRegistrationRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import EngineRepository from '../../repository/config/engine.repository';
import EngineRepositoryMock from '../../tests/__mocks__/repository/config/engine-repository.mock';
import testData from '../../tests/utils/test-data';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { flushPromises } from '../../tests/utils/test-utils';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';
import OIAnalyticsClient from './oianalytics-client.service';
import OianalyticsClientMock from '../../tests/__mocks__/service/oia/oianalytics-client.mock';
import { NotFoundError } from '../../model/types';
import OIAnalyticsRegistrationService, { toOIAnalyticsRegistrationDTO } from './oianalytics-registration.service';

jest.mock('node:fs/promises');
jest.mock('../../web-server/controllers/validators/joi.validator');
jest.mock('../utils');
jest.mock('../utils-oianalytics');

jest.mock('../encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const validator = new JoiValidator();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OianalyticsRegistrationRepositoryMock();
const engineRepository: EngineRepository = new EngineRepositoryMock();
const oIAnalyticsClient: OIAnalyticsClient = new OianalyticsClientMock();

const logger: pino.Logger = new PinoLogger();

let service: OIAnalyticsRegistrationService;
describe('OIAnalytics Registration Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (getOIBusInfo as jest.Mock).mockReturnValue(testData.engine.oIBusInfo);
    (engineRepository.get as jest.Mock).mockReturnValue(testData.engine.settings);

    service = new OIAnalyticsRegistrationService(validator, oIAnalyticsClient, oIAnalyticsRegistrationRepository, engineRepository, logger);
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
    expect(oIAnalyticsRegistrationRepository.get).toHaveBeenCalled();
  });

  it('should not get registration settings if not found', () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.getRegistrationSettings()).toThrow(new NotFoundError('Registration settings not found'));
    expect(oIAnalyticsRegistrationRepository.get).toHaveBeenCalled();
  });

  it('should register', async () => {
    const generateKeyPairSyncMocked = jest.spyOn(crypto, 'generateKeyPairSync');
    (oIAnalyticsRegistrationRepository.get as jest.Mock)
      .mockReturnValueOnce(testData.oIAnalytics.registration.completed)
      .mockReturnValueOnce(testData.oIAnalytics.registration.completed);
    (getOIBusInfo as jest.Mock).mockReturnValueOnce(testData.engine.oIBusInfo).mockReturnValueOnce(testData.engine.oIBusInfo);
    const result = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: testData.constants.dates.FAKE_NOW,
      activationCode: '123ABC'
    };
    (oIAnalyticsClient.register as jest.Mock).mockReturnValueOnce(result).mockReturnValueOnce(result);
    (generateKeyPairSyncMocked as jest.Mock)
      .mockReturnValueOnce({ publicKey: 'public key', privateKey: 'private key' })
      .mockReturnValueOnce({ publicKey: 'public key', privateKey: 'private key' });

    service.checkRegistration = jest.fn();

    await service.register(testData.oIAnalytics.registration.command);

    expect(encryptionService.encryptText).toHaveBeenCalledTimes(1);
    expect(engineRepository.get).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsClient.register).toHaveBeenCalledTimes(1);
    expect(getOIBusInfo).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsRegistrationRepository.register).toHaveBeenCalledWith(
      testData.oIAnalytics.registration.command,
      result.activationCode,
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      testData.constants.dates.FAKE_NOW,
      'public key',
      'private key'
    );

    jest.advanceTimersByTime(10_000);
    expect(service.checkRegistration).toHaveBeenCalledTimes(1);
    await service.register(testData.oIAnalytics.registration.command);
    jest.advanceTimersByTime(10_000);
    expect(service.checkRegistration).toHaveBeenCalledTimes(2);
  });

  it('should register with proxy', async () => {
    const command: Omit<OIAnalyticsRegistration, 'id' | 'status' | 'activationDate'> = {
      host: 'http://localhost:4200/',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: 'user',
      proxyPassword: 'pass',
      useApiGateway: true,
      apiGatewayHeaderKey: 'headerKey',
      apiGatewayHeaderValue: 'headerValue',
      activationCode: null,
      token: null,
      publicCipherKey: null,
      privateCipherKey: null,
      checkUrl: null,
      commandRefreshInterval: 10,
      commandRetryInterval: 5,
      messageRetryInterval: 5,
      commandPermissions: {
        updateVersion: true,
        restartEngine: true,
        regenerateCipherKeys: true,
        updateEngineSettings: true,
        updateRegistrationSettings: true,
        createScanMode: true,
        updateScanMode: true,
        deleteScanMode: true,
        createIpFilter: true,
        updateIpFilter: true,
        deleteIpFilter: true,
        createCertificate: true,
        updateCertificate: true,
        deleteCertificate: true,
        createHistoryQuery: true,
        updateHistoryQuery: true,
        deleteHistoryQuery: true,
        createOrUpdateHistoryItemsFromCsv: true,
        testHistoryNorthConnection: true,
        testHistorySouthConnection: true,
        testHistorySouthItem: true,
        createSouth: true,
        updateSouth: true,
        deleteSouth: true,
        createOrUpdateSouthItemsFromCsv: true,
        testSouthConnection: true,
        testSouthItem: true,
        createNorth: true,
        updateNorth: true,
        deleteNorth: true,
        testNorthConnection: true,
        setpoint: true
      }
    };
    const result = {
      redirectUrl: 'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      expirationDate: testData.constants.dates.FAKE_NOW,
      activationCode: '123ABC'
    };
    (crypto.generateKeyPairSync as jest.Mock).mockReturnValueOnce({ publicKey: 'public key', privateKey: 'private key' });
    (oIAnalyticsClient.register as jest.Mock).mockReturnValueOnce(result);

    await service.register(command);
    expect(encryptionService.encryptText).toHaveBeenCalledTimes(3);
    expect(oIAnalyticsClient.register).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsRegistrationRepository.register).toHaveBeenCalledWith(
      command,
      result.activationCode,
      'http://localhost:4200/api/oianalytics/oibus/check-registration?id=id',
      testData.constants.dates.FAKE_NOW,
      'public key',
      'private key'
    );
  });

  it('should edit registration connection settings', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.completed);

    await service.editRegistrationSettings(testData.oIAnalytics.registration.command);

    expect(oIAnalyticsRegistrationRepository.update).toHaveBeenCalledWith(testData.oIAnalytics.registration.command);
  });

  it('should update keys', async () => {
    await service.updateKeys('private key', 'public key');

    expect(encryptionService.encryptText).toHaveBeenCalledTimes(1);
    expect(encryptionService.encryptText).toHaveBeenCalledWith('private key');
    expect(oIAnalyticsRegistrationRepository.updateKeys).toHaveBeenCalledWith('private key', 'public key');
  });

  it('should edit registration with proxy', async () => {
    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200/',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:3128',
      proxyUsername: 'user',
      proxyPassword: 'pass',
      useApiGateway: true,
      apiGatewayHeaderKey: 'headerKey',
      apiGatewayHeaderValue: 'headerValue',
      commandRefreshInterval: 10,
      commandRetryInterval: 5,
      messageRetryInterval: 5,
      commandPermissions: {
        updateVersion: true,
        restartEngine: true,
        regenerateCipherKeys: true,
        updateEngineSettings: true,
        updateRegistrationSettings: true,
        createScanMode: true,
        updateScanMode: true,
        deleteScanMode: true,
        createIpFilter: true,
        updateIpFilter: true,
        deleteIpFilter: true,
        createCertificate: true,
        updateCertificate: true,
        deleteCertificate: true,
        createHistoryQuery: true,
        updateHistoryQuery: true,
        deleteHistoryQuery: true,
        createOrUpdateHistoryItemsFromCsv: true,
        testHistoryNorthConnection: true,
        testHistorySouthConnection: true,
        testHistorySouthItem: true,
        createSouth: true,
        updateSouth: true,
        deleteSouth: true,
        createOrUpdateSouthItemsFromCsv: true,
        testSouthConnection: true,
        testSouthItem: true,
        createNorth: true,
        updateNorth: true,
        deleteNorth: true,
        testNorthConnection: true,
        setpoint: true
      }
    };
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.completed);

    await service.editRegistrationSettings(command);

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
    const result = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    (oIAnalyticsClient.checkRegistration as jest.Mock).mockReturnValueOnce(result);

    service.start(); // start with pending registration to a set interval
    await service.checkRegistration();

    expect(oIAnalyticsClient.checkRegistration).toHaveBeenCalledTimes(1);
    expect(encryptionService.encryptText).toHaveBeenCalledWith('access_token');
    expect(oIAnalyticsRegistrationRepository.activate).toHaveBeenCalledWith(testData.constants.dates.FAKE_NOW, 'access_token');
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should check registration and return because already checking', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.pending);
    const result = { status: 'COMPLETED', expired: true, accessToken: 'access_token' };
    (oIAnalyticsClient.checkRegistration as jest.Mock).mockReturnValueOnce(result);

    service.checkRegistration();
    await service.checkRegistration();

    expect(logger.trace).toHaveBeenCalledWith('On going registration check');
    await flushPromises();
  });

  it('should check registration but fail because of return status', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.pending);
    const result = { status: 'DECLINED', expired: true, accessToken: 'access_token' };
    (oIAnalyticsClient.checkRegistration as jest.Mock).mockReturnValueOnce(result);

    await service.checkRegistration();

    expect(oIAnalyticsClient.checkRegistration).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(`Registration not completed. Status: DECLINED`);
  });

  it('should check registration but fail because of client error', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.pending);
    (oIAnalyticsClient.checkRegistration as jest.Mock).mockImplementationOnce(() => {
      throw new Error('error');
    });

    await service.checkRegistration();

    expect(oIAnalyticsClient.checkRegistration).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`Error while checking registration: error`);
  });

  it('should properly convert to DTO', () => {
    const registration = testData.oIAnalytics.registration.completed;
    expect(toOIAnalyticsRegistrationDTO(registration)).toEqual({
      id: registration.id,
      host: registration.host,
      activationCode: registration.activationCode,
      status: registration.status,
      activationDate: registration.activationDate,
      activationExpirationDate: registration.activationExpirationDate,
      checkUrl: registration.checkUrl,
      useProxy: registration.useProxy,
      proxyUrl: registration.proxyUrl,
      proxyUsername: registration.proxyUsername,
      useApiGateway: registration.useApiGateway,
      apiGatewayHeaderKey: registration.apiGatewayHeaderKey,
      acceptUnauthorized: registration.acceptUnauthorized,
      commandRefreshInterval: registration.commandRefreshInterval,
      commandRetryInterval: registration.commandRetryInterval,
      messageRetryInterval: registration.messageRetryInterval,
      commandPermissions: registration.commandPermissions
    });
  });
});
