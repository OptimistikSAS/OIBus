import testData from '../../tests/utils/test-data';
import OIAnalyticsClient from './oianalytics-client.service';
import { generateRandomId } from '../utils';
import { HTTPRequest } from '../http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';

jest.mock('node:fs/promises');
jest.mock('../http-request.utils');
jest.mock('../proxy-agent');
jest.mock('../utils');

let service: OIAnalyticsClient;
describe('OIAnalytics Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200));
    service = new OIAnalyticsClient();
  });

  it('should update command status', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200)).mockResolvedValueOnce(createMockResponse(400, 'error'));

    await service.updateCommandStatus(testData.oIAnalytics.registration.completed, 'payload');
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/commands/status` }),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'payload',
        auth: { type: 'bearer', token: testData.oIAnalytics.registration.completed.token },
        proxy: undefined,
        timeout: 10_000
      }
    );
    await expect(service.updateCommandStatus(testData.oIAnalytics.registration.completed, 'payload')).rejects.toThrow('400 - "error"');
  });

  it('should not update command status without registration token', async () => {
    await expect(service.updateCommandStatus({ ...testData.oIAnalytics.registration.completed, token: null }, 'payload')).rejects.toThrow(
      new Error('No registration token')
    );
  });

  it('should retrieve cancelled commands', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, [])).mockResolvedValueOnce(createMockResponse(400, 'error'));

    const result = await service.retrieveCancelledCommands(testData.oIAnalytics.registration.completed, [
      testData.oIAnalytics.commands.oIBusList[0],
      testData.oIAnalytics.commands.oIBusList[1]
    ]);
    expect(result).toEqual([]);
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/commands/list-by-ids` }),
      {
        method: 'GET',
        query: { ids: ['commandId1', 'commandId2'] },
        auth: { type: 'bearer', token: testData.oIAnalytics.registration.completed.token },
        proxy: undefined,
        timeout: 10_000
      }
    );
    await expect(
      service.retrieveCancelledCommands(testData.oIAnalytics.registration.completed, testData.oIAnalytics.commands.oIBusList)
    ).rejects.toThrow('400 - "error"');
  });

  it('should not retrieve cancelled commands without registration token', async () => {
    await expect(
      service.retrieveCancelledCommands(
        { ...testData.oIAnalytics.registration.completed, token: null },
        testData.oIAnalytics.commands.oIBusList
      )
    ).rejects.toThrow(new Error('No registration token'));
  });

  it('should retrieve pending commands', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, [])).mockResolvedValueOnce(createMockResponse(400, 'error'));

    const result = await service.retrievePendingCommands(testData.oIAnalytics.registration.completed);
    expect(result).toEqual([]);
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/commands/pending` }),
      {
        method: 'GET',
        auth: { type: 'bearer', token: testData.oIAnalytics.registration.completed.token },
        proxy: undefined,
        timeout: 10_000
      }
    );
    await expect(service.retrievePendingCommands(testData.oIAnalytics.registration.completed)).rejects.toThrow('400 - "error"');
  });

  it('should not retrieve pending commands without registration token', async () => {
    await expect(service.retrievePendingCommands({ ...testData.oIAnalytics.registration.completed, token: null })).rejects.toThrow(
      new Error('No registration token')
    );
  });

  it('should register', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('123ABC');

    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(
        createMockResponse(200, {
          redirectUrl: 'redirect/url',
          expirationDate: testData.constants.dates.FAKE_NOW,
          activationCode: '123ABC'
        })
      )
      .mockResolvedValueOnce(createMockResponse(400, 'error'));

    const result = await service.register(testData.oIAnalytics.registration.completed, testData.engine.oIBusInfo, 'public key');
    expect(result).toEqual({ redirectUrl: 'redirect/url', expirationDate: testData.constants.dates.FAKE_NOW, activationCode: '123ABC' });
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/registration` }),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activationCode: '123ABC',
          oibusId: testData.engine.oIBusInfo.oibusId,
          oibusName: testData.engine.oIBusInfo.oibusName,
          oibusVersion: testData.engine.oIBusInfo.version,
          oibusOs: testData.engine.oIBusInfo.operatingSystem,
          oibusArch: testData.engine.oIBusInfo.architecture,
          publicKey: 'public key'
        }),
        proxy: undefined,
        timeout: 10_000
      }
    );
    await expect(service.register(testData.oIAnalytics.registration.completed, testData.engine.oIBusInfo, 'public key')).rejects.toThrow(
      '400 - "error"'
    );
  });

  it('should check registration', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('123ABC');

    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(createMockResponse(200, { status: 'REGISTERED', expired: true, accessToken: 'access token' }))
      .mockResolvedValueOnce(createMockResponse(400, 'error'));

    const result = await service.checkRegistration(testData.oIAnalytics.registration.completed);
    expect(result).toEqual({ status: 'REGISTERED', expired: true, accessToken: 'access token' });
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        href: `${testData.oIAnalytics.registration.completed.host}${testData.oIAnalytics.registration.completed.checkUrl}/`
      }),
      {
        method: 'GET',
        proxy: undefined,
        timeout: 10_000
      }
    );
    await expect(service.checkRegistration(testData.oIAnalytics.registration.completed)).rejects.toThrow('400 - "error"');
  });

  it('should not check registration without check url', async () => {
    await expect(service.checkRegistration({ ...testData.oIAnalytics.registration.completed, checkUrl: null })).rejects.toThrow(
      new Error('No check url specified')
    );
  });

  it('should send configuration', async () => {
    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(createMockResponse(200, { status: 'REGISTERED', expired: true, accessToken: 'access token' }))
      .mockResolvedValueOnce(createMockResponse(400, 'error'));

    await service.sendConfiguration(testData.oIAnalytics.registration.completed, 'payload');
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/configuration` }),
      {
        method: 'PUT',
        auth: { type: 'bearer', token: testData.oIAnalytics.registration.completed.token },
        headers: { 'Content-Type': 'application/json' },
        body: 'payload',
        proxy: undefined,
        timeout: 10_000
      }
    );
    await expect(service.sendConfiguration(testData.oIAnalytics.registration.completed, 'payload')).rejects.toThrow('400 - "error"');
  });

  it('should not send configuration without registration token', async () => {
    await expect(service.sendConfiguration({ ...testData.oIAnalytics.registration.completed, token: null }, 'payload')).rejects.toThrow(
      new Error('No registration token')
    );
  });

  it('should send save history query', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200)).mockResolvedValueOnce(createMockResponse(400, 'error'));

    await service.sendHistoryQuery(testData.oIAnalytics.registration.completed, 'payload');
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/configuration/history-query`
      }),
      {
        method: 'PUT',
        auth: { type: 'bearer', token: testData.oIAnalytics.registration.completed.token },
        headers: { 'Content-Type': 'application/json' },
        body: 'payload',
        proxy: undefined,
        timeout: 10_000
      }
    );
    await expect(service.sendHistoryQuery(testData.oIAnalytics.registration.completed, 'payload')).rejects.toThrow('400 - "error"');
  });

  it('should not send save history query without registration token', async () => {
    await expect(service.sendHistoryQuery({ ...testData.oIAnalytics.registration.completed, token: null }, 'payload')).rejects.toThrow(
      new Error('No registration token')
    );
  });

  it('should send delete history query', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200)).mockResolvedValueOnce(createMockResponse(400, 'error'));

    await service.deleteHistoryQuery(testData.oIAnalytics.registration.completed, 'historyId');
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/configuration/history-query`
      }),
      {
        method: 'DELETE',
        query: { historyId: 'historyId' },
        auth: { type: 'bearer', token: testData.oIAnalytics.registration.completed.token },
        headers: { 'Content-Type': 'application/json' },
        proxy: undefined,
        timeout: 10_000
      }
    );
    await expect(service.deleteHistoryQuery(testData.oIAnalytics.registration.completed, 'historyId')).rejects.toThrow('400 - "error"');
  });

  it('should not send delete history query without registration token', async () => {
    await expect(service.deleteHistoryQuery({ ...testData.oIAnalytics.registration.completed, token: null }, 'historyId')).rejects.toThrow(
      new Error('No registration token')
    );
  });

  it('should download file', async () => {
    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(createMockResponse(200, Buffer.from('buffer').buffer))
      .mockResolvedValueOnce(createMockResponse(400, 'error'));

    await service.downloadFile(
      {
        ...testData.oIAnalytics.registration.completed,
        host: `${testData.oIAnalytics.registration.completed.host}/`,
        proxyUrl: 'http://localhost:3128',
        proxyUsername: 'proxy user',
        proxyPassword: 'proxy password',
        useProxy: true
      },
      'assetId',
      'filename.zip'
    );
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/upgrade/asset`
      }),
      {
        method: 'GET',
        query: { assetId: 'assetId' },
        auth: { type: 'bearer', token: testData.oIAnalytics.registration.completed.token },
        proxy: {
          url: 'http://localhost:3128',
          auth: {
            type: 'url',
            username: 'proxy user',
            password: 'proxy password'
          }
        },
        timeout: 900_000
      }
    );
    await expect(
      service.downloadFile(
        {
          ...testData.oIAnalytics.registration.completed,
          proxyUrl: 'http://localhost:3128',
          proxyUsername: 'proxy user',
          useProxy: true
        },
        'assetId',
        'filename.zip'
      )
    ).rejects.toThrow('400 - "error"');
  });

  it('should not dowload file without registration token', async () => {
    await expect(
      service.downloadFile(
        {
          ...testData.oIAnalytics.registration.completed,
          token: null
        },
        'assetId',
        'filename.zip'
      )
    ).rejects.toThrow(new Error('No registration token'));
  });

  it('should not get proxy options without proxy url', () => {
    try {
      service['getProxyOptions']({
        ...testData.oIAnalytics.registration.completed,
        useProxy: true
      });
    } catch (error) {
      expect(error).toEqual(new Error('Proxy URL not specified'));
    }
  });
});
