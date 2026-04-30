import { describe, it, beforeEach, afterEach, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import testData from '../../tests/utils/test-data';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import { mockModule, reloadModule, assertContains } from '../../tests/utils/test-utils';
import type OIAnalyticsClientType from './oianalytics-client.service';

const nodeRequire = createRequire(import.meta.url);

// Mocked module exports — mutated in-place between tests
let mockHttpRequest: Record<string, ReturnType<typeof mock.fn>>;
let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let mockUtilsOianalytics: Record<string, ReturnType<typeof mock.fn>>;

// Default mocked HTTP Options
const mockHttpOptions = {
  headers: { 'Existing-Header': 'value' },
  auth: { type: 'bearer', token: 'mock-token' },
  timeout: 10000
};

let OIAnalyticsClient: new () => InstanceType<typeof OIAnalyticsClientType>;

before(() => {
  mockHttpRequest = {
    HTTPRequest: mock.fn(async () => createMockResponse(200))
  };
  mockUtils = {
    generateRandomId: mock.fn(() => '123ABC')
  };
  mockUtilsOianalytics = {
    buildHttpOptions: mock.fn(async (method: string) => ({ ...mockHttpOptions, method })),
    getHeaders: mock.fn(async () => ({})),
    getProxyOptions: mock.fn(() => ({ acceptUnauthorized: false, proxy: undefined })),
    getUrl: mock.fn((endpoint: string, host: string) => new URL(endpoint, host))
  };

  mockModule(nodeRequire, '../http-request.utils', mockHttpRequest);
  mockModule(nodeRequire, '../utils', mockUtils);
  mockModule(nodeRequire, '../utils-oianalytics', mockUtilsOianalytics);

  const mod = reloadModule<{ default: new () => InstanceType<typeof OIAnalyticsClientType> }>(nodeRequire, './oianalytics-client.service');
  OIAnalyticsClient = mod.default;
});

describe('OIAnalytics Client', () => {
  let service: InstanceType<typeof OIAnalyticsClientType>;

  beforeEach(() => {
    // Reset all mock functions in-place so the SUT picks up the fresh fns
    mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(200));
    mockUtils.generateRandomId = mock.fn(() => '123ABC');
    mockUtilsOianalytics.buildHttpOptions = mock.fn(async (method: string) => ({ ...mockHttpOptions, method }));
    mockUtilsOianalytics.getHeaders = mock.fn(async () => ({}));
    mockUtilsOianalytics.getProxyOptions = mock.fn(() => ({ acceptUnauthorized: false, proxy: undefined }));
    mockUtilsOianalytics.getUrl = mock.fn((endpoint: string, host: string) => new URL(endpoint, host));

    mock.method(fs, 'writeFile', async () => undefined);

    service = new OIAnalyticsClient();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('updateCommandStatus', () => {
    it('should call PUT endpoint with correct options', async () => {
      await service.updateCommandStatus(testData.oIAnalytics.registration.completed, 'payload');

      assert.strictEqual(mockUtilsOianalytics.buildHttpOptions.mock.calls.length, 1);
      assert.deepStrictEqual(mockUtilsOianalytics.buildHttpOptions.mock.calls[0].arguments, [
        'PUT',
        true,
        testData.oIAnalytics.registration.completed,
        null,
        30_000,
        null
      ]);

      assert.strictEqual(mockHttpRequest.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = mockHttpRequest.HTTPRequest.mock.calls[0].arguments as [URL, Record<string, unknown>];
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/commands/status'));
      assert.strictEqual(calledOptions.body, 'payload');
      assertContains(calledOptions.headers as Record<string, unknown>, { 'Content-Type': 'application/json', 'Existing-Header': 'value' });
    });

    it('should throw on error response', async () => {
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(400, 'Bad Request'));
      await assert.rejects(() => service.updateCommandStatus(testData.oIAnalytics.registration.completed, 'payload'), /400 - Bad Request/);
    });
  });

  describe('retrieveCancelledCommands', () => {
    const commands = [testData.oIAnalytics.commands.oIBusList[0]];

    it('should call GET endpoint with query params', async () => {
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(200, []));

      const result = await service.retrieveCancelledCommands(testData.oIAnalytics.registration.completed, commands);

      assert.deepStrictEqual(result, []);
      assert.strictEqual(mockHttpRequest.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = mockHttpRequest.HTTPRequest.mock.calls[0].arguments as [URL, Record<string, unknown>];
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/commands/list-by-ids'));
      assert.deepStrictEqual(calledOptions.query, { ids: ['commandId1'] });
    });

    it('should throw on error response', async () => {
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(400, 'Bad Request'));
      await assert.rejects(
        () => service.retrieveCancelledCommands(testData.oIAnalytics.registration.completed, commands),
        /400 - Bad Request/
      );
    });
  });

  describe('retrievePendingCommands', () => {
    it('should call GET endpoint', async () => {
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(200, []));

      const result = await service.retrievePendingCommands(testData.oIAnalytics.registration.completed);

      assert.deepStrictEqual(result, []);
      assert.strictEqual(mockHttpRequest.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = mockHttpRequest.HTTPRequest.mock.calls[0].arguments as [URL, Record<string, unknown>];
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/commands/pending'));
      assert.deepStrictEqual(calledOptions, { ...mockHttpOptions, method: 'GET' });
    });

    it('should throw on error response', async () => {
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(400, 'Bad Request'));
      await assert.rejects(() => service.retrievePendingCommands(testData.oIAnalytics.registration.completed), /400 - Bad Request/);
    });
  });

  describe('register', () => {
    it('should post payload', async () => {
      const mockResponse = { redirectUrl: 'url', expirationDate: 'date', activationCode: '123ABC' };
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(200, mockResponse));

      const result = await service.register(testData.oIAnalytics.registration.completed, testData.engine.oIBusInfo, 'public key');

      assert.strictEqual(mockHttpRequest.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = mockHttpRequest.HTTPRequest.mock.calls[0].arguments as [URL, Record<string, unknown>];
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/registration'));
      assert.strictEqual(
        calledOptions.body,
        JSON.stringify({
          activationCode: '123ABC',
          oibusId: testData.engine.oIBusInfo.oibusId,
          oibusName: testData.engine.oIBusInfo.oibusName,
          oibusVersion: testData.engine.oIBusInfo.version,
          oibusOs: testData.engine.oIBusInfo.operatingSystem,
          oibusArch: testData.engine.oIBusInfo.architecture,
          publicKey: 'public key'
        })
      );
      assert.deepStrictEqual(result, mockResponse);
    });

    it('should throw on error response', async () => {
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(400, 'Bad Request'));
      await assert.rejects(
        () => service.register(testData.oIAnalytics.registration.completed, testData.engine.oIBusInfo, 'public key'),
        /400 - Bad Request/
      );
    });
  });

  describe('checkRegistration', () => {
    it('should call checkUrl', async () => {
      const mockResponse = { status: 'REGISTERED', expired: false, accessToken: 'token' };
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(200, mockResponse));

      const result = await service.checkRegistration(testData.oIAnalytics.registration.completed);

      assert.strictEqual(mockHttpRequest.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = mockHttpRequest.HTTPRequest.mock.calls[0].arguments as [URL, Record<string, unknown>];
      assert.ok(calledUrl.href.includes(testData.oIAnalytics.registration.completed.checkUrl!));
      assert.deepStrictEqual(calledOptions, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        acceptUnauthorized: false,
        proxy: undefined,
        timeout: 30000
      });
      assert.deepStrictEqual(result, mockResponse);
    });

    it('should throw if checkUrl is missing', async () => {
      await assert.rejects(
        () => service.checkRegistration({ ...testData.oIAnalytics.registration.completed, checkUrl: null }),
        /No check url specified/
      );
    });

    it('should throw on error response', async () => {
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(400, 'Bad Request'));
      await assert.rejects(() => service.checkRegistration(testData.oIAnalytics.registration.completed), /400 - Bad Request/);
    });
  });

  describe('sendConfiguration', () => {
    it('should call PUT endpoint', async () => {
      await service.sendConfiguration(testData.oIAnalytics.registration.completed, 'config-payload');

      assert.strictEqual(mockHttpRequest.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = mockHttpRequest.HTTPRequest.mock.calls[0].arguments as [URL, Record<string, unknown>];
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/configuration'));
      assert.strictEqual(calledOptions.method, 'PUT');
      assert.strictEqual(calledOptions.body, 'config-payload');
    });

    it('should throw on error response', async () => {
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(400, 'Bad Request'));
      await assert.rejects(
        () => service.sendConfiguration(testData.oIAnalytics.registration.completed, 'config-payload'),
        /400 - Bad Request/
      );
    });
  });

  describe('sendHistoryQuery', () => {
    it('should call PUT endpoint', async () => {
      await service.sendHistoryQuery(testData.oIAnalytics.registration.completed, 'history-payload');

      assert.strictEqual(mockHttpRequest.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = mockHttpRequest.HTTPRequest.mock.calls[0].arguments as [URL, Record<string, unknown>];
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/configuration/history-query'));
      assert.strictEqual(calledOptions.method, 'PUT');
      assert.strictEqual(calledOptions.body, 'history-payload');
    });

    it('should throw on error response', async () => {
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(400, 'Bad Request'));
      await assert.rejects(
        () => service.sendHistoryQuery(testData.oIAnalytics.registration.completed, 'history-payload'),
        /400 - Bad Request/
      );
    });
  });

  describe('deleteHistoryQuery', () => {
    it('should call DELETE endpoint with query param', async () => {
      await service.deleteHistoryQuery(testData.oIAnalytics.registration.completed, 'hist-1');

      assert.strictEqual(mockUtilsOianalytics.buildHttpOptions.mock.calls.length, 1);
      assert.deepStrictEqual(mockUtilsOianalytics.buildHttpOptions.mock.calls[0].arguments, [
        'DELETE',
        true,
        testData.oIAnalytics.registration.completed,
        null,
        30000,
        null
      ]);

      assert.strictEqual(mockHttpRequest.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = mockHttpRequest.HTTPRequest.mock.calls[0].arguments as [URL, Record<string, unknown>];
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/configuration/history-query'));
      assert.deepStrictEqual(calledOptions.query, { historyId: 'hist-1' });
    });

    it('should throw on error response', async () => {
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(400, 'Bad Request'));
      await assert.rejects(() => service.deleteHistoryQuery(testData.oIAnalytics.registration.completed, 'hist-1'), /400 - Bad Request/);
    });
  });

  describe('downloadFile', () => {
    it('should download and write file to disk', async () => {
      const mockBuffer = Buffer.from('file-content');
      const mockResponse = createMockResponse(200, mockBuffer.buffer as ArrayBuffer);
      mockHttpRequest.HTTPRequest = mock.fn(async () => mockResponse);

      await service.downloadFile(testData.oIAnalytics.registration.completed, 'asset-1', 'target.zip');

      assert.strictEqual(mockUtilsOianalytics.buildHttpOptions.mock.calls.length, 1);
      assert.deepStrictEqual(mockUtilsOianalytics.buildHttpOptions.mock.calls[0].arguments, [
        'GET',
        true,
        testData.oIAnalytics.registration.completed,
        null,
        900_000,
        null
      ]);

      assert.strictEqual(mockHttpRequest.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = mockHttpRequest.HTTPRequest.mock.calls[0].arguments as [URL, Record<string, unknown>];
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/upgrade/asset'));
      assert.deepStrictEqual(calledOptions.query, { assetId: 'asset-1' });

      assert.strictEqual((fs.writeFile as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((fs.writeFile as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
        'target.zip',
        Buffer.from((await mockResponse.body.arrayBuffer()) as ArrayBuffer)
      ]);
    });

    it('should throw on error response', async () => {
      mockHttpRequest.HTTPRequest = mock.fn(async () => createMockResponse(400, 'Bad Request'));
      await assert.rejects(
        () => service.downloadFile(testData.oIAnalytics.registration.completed, 'asset-1', 'target.zip'),
        /400 - Bad Request/
      );
    });
  });
});
