import testData from '../../tests/utils/test-data';
import OIAnalyticsClient from './oianalytics-client.service';
import { generateRandomId } from '../utils';
import { HTTPRequest } from '../http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import { buildHttpOptions, getHeaders, getProxyOptions } from '../utils-oianalytics';
import fs from 'node:fs/promises';

// Mock dependencies
jest.mock('node:fs/promises');
jest.mock('../http-request.utils');
jest.mock('../utils');
jest.mock('../utils-oianalytics');

describe('OIAnalytics Client', () => {
  let service: OIAnalyticsClient;

  // Default mocked HTTP Options
  const mockHttpOptions = {
    headers: { 'Existing-Header': 'value' },
    auth: { type: 'bearer', token: 'mock-token' },
    timeout: 10000
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    // Setup default mock returns
    (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200));
    (buildHttpOptions as jest.Mock).mockImplementation(method => ({ ...mockHttpOptions, method }));
    (generateRandomId as jest.Mock).mockReturnValue('123ABC');

    service = new OIAnalyticsClient();
  });

  describe('updateCommandStatus', () => {
    it('should call PUT endpoint with correct options', async () => {
      await service.updateCommandStatus(testData.oIAnalytics.registration.completed, 'payload');

      expect(buildHttpOptions).toHaveBeenCalledWith('PUT', true, testData.oIAnalytics.registration.completed, null, 30_000, null);

      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/commands/status`
        }),
        expect.objectContaining({
          body: 'payload',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Existing-Header': 'value'
          })
        })
      );
    });

    it('should throw on error response', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));
      await expect(service.updateCommandStatus(testData.oIAnalytics.registration.completed, 'payload')).rejects.toThrow(
        '400 - Bad Request'
      );
    });
  });

  describe('retrieveCancelledCommands', () => {
    const commands = [testData.oIAnalytics.commands.oIBusList[0]];

    it('should call GET endpoint with query params', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200, []));

      const result = await service.retrieveCancelledCommands(testData.oIAnalytics.registration.completed, commands);

      expect(result).toEqual([]);
      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/commands/list-by-ids`
        }),
        expect.objectContaining({
          query: { ids: ['commandId1'] }
        })
      );
    });

    it('should throw on error response', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));
      await expect(service.retrieveCancelledCommands(testData.oIAnalytics.registration.completed, commands)).rejects.toThrow(
        '400 - Bad Request'
      );
    });
  });

  describe('retrievePendingCommands', () => {
    it('should call GET endpoint', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200, []));

      const result = await service.retrievePendingCommands(testData.oIAnalytics.registration.completed);

      expect(result).toEqual([]);
      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/commands/pending`
        }),
        { ...mockHttpOptions, method: 'GET' }
      );
    });

    it('should throw on error response', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));
      await expect(service.retrievePendingCommands(testData.oIAnalytics.registration.completed)).rejects.toThrow('400 - Bad Request');
    });
  });

  describe('register', () => {
    it('should post payload', async () => {
      (getHeaders as jest.Mock).mockResolvedValue({});
      (getProxyOptions as jest.Mock).mockResolvedValue({ acceptUnauthorized: false, proxy: undefined });
      const mockResponse = { redirectUrl: 'url', expirationDate: 'date', activationCode: '123ABC' };
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200, mockResponse));
      const result = await service.register(testData.oIAnalytics.registration.completed, testData.engine.oIBusInfo, 'public key');

      // Verify HTTP Request body
      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/registration`
        }),
        expect.objectContaining({
          body: JSON.stringify({
            activationCode: '123ABC',
            oibusId: testData.engine.oIBusInfo.oibusId,
            oibusName: testData.engine.oIBusInfo.oibusName,
            oibusVersion: testData.engine.oIBusInfo.version,
            oibusOs: testData.engine.oIBusInfo.operatingSystem,
            oibusArch: testData.engine.oIBusInfo.architecture,
            publicKey: 'public key'
          })
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should throw on error response', async () => {
      (getHeaders as jest.Mock).mockResolvedValue({});
      (getProxyOptions as jest.Mock).mockReturnValue({ acceptUnauthorized: false, proxy: undefined });
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));
      await expect(service.register(testData.oIAnalytics.registration.completed, testData.engine.oIBusInfo, 'public key')).rejects.toThrow(
        '400 - Bad Request'
      );
    });
  });

  describe('checkRegistration', () => {
    it('should call checkUrl', async () => {
      (getHeaders as jest.Mock).mockResolvedValue({});
      (getProxyOptions as jest.Mock).mockReturnValue({ acceptUnauthorized: false, proxy: undefined });

      const mockResponse = { status: 'REGISTERED', expired: false, accessToken: 'token' };
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200, mockResponse));

      const result = await service.checkRegistration(testData.oIAnalytics.registration.completed);

      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `${testData.oIAnalytics.registration.completed.host}${testData.oIAnalytics.registration.completed.checkUrl}/`
        }),
        { method: 'GET', headers: { 'Content-Type': 'application/json' }, acceptUnauthorized: false, proxy: undefined, timeout: 30000 }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw if checkUrl is missing', async () => {
      await expect(service.checkRegistration({ ...testData.oIAnalytics.registration.completed, checkUrl: null })).rejects.toThrow(
        'No check url specified'
      );
    });

    it('should throw on error response', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));
      await expect(service.checkRegistration(testData.oIAnalytics.registration.completed)).rejects.toThrow('400 - Bad Request');
    });
  });

  describe('sendConfiguration', () => {
    it('should call PUT endpoint', async () => {
      await service.sendConfiguration(testData.oIAnalytics.registration.completed, 'config-payload');

      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/configuration`
        }),
        expect.objectContaining({
          method: 'PUT',
          body: 'config-payload'
        })
      );
    });

    it('should throw on error response', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));
      await expect(service.sendConfiguration(testData.oIAnalytics.registration.completed, 'config-payload')).rejects.toThrow(
        '400 - Bad Request'
      );
    });
  });

  describe('sendHistoryQuery', () => {
    it('should call PUT endpoint', async () => {
      await service.sendHistoryQuery(testData.oIAnalytics.registration.completed, 'history-payload');

      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/configuration/history-query`
        }),
        expect.objectContaining({
          method: 'PUT',
          body: 'history-payload'
        })
      );
    });

    it('should throw on error response', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));
      await expect(service.sendHistoryQuery(testData.oIAnalytics.registration.completed, 'history-payload')).rejects.toThrow(
        '400 - Bad Request'
      );
    });
  });

  describe('deleteHistoryQuery', () => {
    it('should call DELETE endpoint with query param', async () => {
      await service.deleteHistoryQuery(testData.oIAnalytics.registration.completed, 'hist-1');

      expect(buildHttpOptions).toHaveBeenCalledWith('DELETE', expect.anything(), expect.anything(), null, 30000, null);

      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/configuration/history-query`
        }),
        expect.objectContaining({
          query: { historyId: 'hist-1' }
        })
      );
    });

    it('should throw on error response', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));
      await expect(service.deleteHistoryQuery(testData.oIAnalytics.registration.completed, 'hist-1')).rejects.toThrow('400 - Bad Request');
    });
  });

  describe('downloadFile', () => {
    it('should download and write file to disk', async () => {
      const mockBuffer = Buffer.from('file-content');
      const mockResponse = createMockResponse(200, mockBuffer.buffer);
      (HTTPRequest as jest.Mock).mockResolvedValue(mockResponse);

      await service.downloadFile(testData.oIAnalytics.registration.completed, 'asset-1', 'target.zip');

      // Verify increased timeout
      expect(buildHttpOptions).toHaveBeenCalledWith('GET', true, expect.anything(), null, 900_000, null);

      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `${testData.oIAnalytics.registration.completed.host}/api/oianalytics/oibus/upgrade/asset`
        }),
        expect.objectContaining({
          query: { assetId: 'asset-1' }
        })
      );

      expect(fs.writeFile).toHaveBeenCalledWith('target.zip', Buffer.from(await mockResponse.body.arrayBuffer()));
    });

    it('should throw on error response', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));
      await expect(service.downloadFile(testData.oIAnalytics.registration.completed, 'asset-1', 'target.zip')).rejects.toThrow(
        '400 - Bad Request'
      );
    });
  });
});
