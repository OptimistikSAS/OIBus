import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';

import EncryptionService from '../encryption.service';
import testData from '../../tests/utils/test-data';
import OIAnalyticsClient from './oianalytics-client.service';
import { createProxyAgent } from '../proxy-agent';
import fetch from 'node-fetch';
import { generateRandomId } from '../utils';

jest.mock('node:fs/promises');
jest.mock('node-fetch');
jest.mock('../proxy-agent');
jest.mock('../utils');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

let service: OIAnalyticsClient;
describe('OIAnalytics Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (createProxyAgent as jest.Mock).mockReturnValue(null);
    service = new OIAnalyticsClient(encryptionService);
  });

  it('should update command status', async () => {
    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          status: 200
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'error'
        })
      );

    await service.updateCommandStatus(testData.oIAnalytics.registration.completed, 'payload');
    expect(fetch).toHaveBeenCalledWith(`${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/commands/status`, {
      method: 'PUT',
      body: 'payload',
      headers: {
        authorization: `Bearer ${testData.oIAnalytics.registration.completed.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10_000,
      agent: null
    });
    await expect(service.updateCommandStatus(testData.oIAnalytics.registration.completed, 'payload')).rejects.toThrow('400 - error');
  });

  it('should retrieve cancelled commands', async () => {
    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          status: 200,
          json: jest.fn().mockReturnValue([])
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'error'
        })
      );

    const result = await service.retrieveCancelledCommands(
      testData.oIAnalytics.registration.completed,
      testData.oIAnalytics.commands.oIBusList
    );
    expect(result).toEqual([]);
    expect(fetch).toHaveBeenCalledWith(
      `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/commands/list-by-ids?ids=commandId1&ids=commandId2&ids=commandId3&ids=commandId4&ids=commandId5&ids=commandId6&ids=commandId7&ids=commandId8&ids=commandId9&ids=commandId10&ids=commandId11&ids=commandId12`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${testData.oIAnalytics.registration.completed.token}`
        },
        timeout: 10_000,
        agent: null
      }
    );
    await expect(
      service.retrieveCancelledCommands(testData.oIAnalytics.registration.completed, testData.oIAnalytics.commands.oIBusList)
    ).rejects.toThrow('400 - error');
  });

  it('should retrieve pending commands', async () => {
    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          status: 200,
          json: jest.fn().mockReturnValue([])
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'error'
        })
      );

    const result = await service.retrievePendingCommands(testData.oIAnalytics.registration.completed);
    expect(result).toEqual([]);
    expect(fetch).toHaveBeenCalledWith(`${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/commands/pending`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${testData.oIAnalytics.registration.completed.token}`
      },
      timeout: 10_000,
      agent: null
    });
    await expect(service.retrievePendingCommands(testData.oIAnalytics.registration.completed)).rejects.toThrow('400 - error');
  });

  it('should register', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('123ABC');

    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          status: 200,
          json: jest
            .fn()
            .mockReturnValue({ redirectUrl: 'redirect/url', expirationDate: testData.constants.dates.FAKE_NOW, activationCode: '123ABC' })
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'error'
        })
      );

    const result = await service.register(testData.oIAnalytics.registration.completed, testData.engine.oIBusInfo, 'public key');
    expect(result).toEqual({ redirectUrl: 'redirect/url', expirationDate: testData.constants.dates.FAKE_NOW, activationCode: '123ABC' });
    expect(fetch).toHaveBeenCalledWith(`${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/registration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        activationCode: '123ABC',
        oibusVersion: testData.engine.oIBusInfo.version,
        oibusArch: testData.engine.oIBusInfo.architecture,
        oibusOs: testData.engine.oIBusInfo.operatingSystem,
        oibusId: testData.engine.oIBusInfo.oibusId,
        oibusName: testData.engine.oIBusInfo.oibusName,
        publicKey: 'public key'
      }),
      timeout: 10_000,
      agent: null
    });
    await expect(service.register(testData.oIAnalytics.registration.completed, testData.engine.oIBusInfo, 'public key')).rejects.toThrow(
      '400 - error'
    );
  });

  it('should check registration', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('123ABC');

    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          status: 200,
          json: jest.fn().mockReturnValue({ status: 'REGISTERED', expired: true, accessToken: 'access token' })
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'error'
        })
      );

    const result = await service.checkRegistration(testData.oIAnalytics.registration.completed);
    expect(result).toEqual({ status: 'REGISTERED', expired: true, accessToken: 'access token' });
    expect(fetch).toHaveBeenCalledWith(`${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/registration`, {
      method: 'GET',
      timeout: 10_000,
      agent: null
    });
    await expect(service.checkRegistration(testData.oIAnalytics.registration.completed)).rejects.toThrow('400 - error');
  });

  it('should send configuration', async () => {
    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          status: 200,
          json: jest.fn().mockReturnValue({ status: 'REGISTERED', expired: true, accessToken: 'access token' })
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'error'
        })
      );

    await service.sendConfiguration(testData.oIAnalytics.registration.completed, 'payload');
    expect(fetch).toHaveBeenCalledWith(`${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/configuration`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${testData.oIAnalytics.registration.completed.token}`,
        'Content-Type': 'application/json'
      },
      body: 'payload',
      timeout: 10_000,
      agent: null
    });
    await expect(service.sendConfiguration(testData.oIAnalytics.registration.completed, 'payload')).rejects.toThrow('400 - error');
  });

  it('should download file', async () => {
    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          status: 200,
          buffer: () => Buffer.from('buffer')
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'error'
        })
      );

    await service.downloadFile(
      {
        ...testData.oIAnalytics.registration.completed,
        host: `${testData.oIAnalytics.registration.completed.host}/`,
        proxyPassword: 'proxy password',
        useProxy: true
      },
      'assetId',
      'filename.zip'
    );
    expect(fetch).toHaveBeenCalledWith(
      `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/upgrade/asset?assetId=assetId`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${testData.oIAnalytics.registration.completed.token}`
        },
        timeout: 900_000,
        agent: null
      }
    );
    await expect(
      service.downloadFile(
        {
          ...testData.oIAnalytics.registration.completed,
          proxyPassword: '',
          useProxy: true
        },
        'assetId',
        'filename.zip'
      )
    ).rejects.toThrow('400 - error');
  });
});
