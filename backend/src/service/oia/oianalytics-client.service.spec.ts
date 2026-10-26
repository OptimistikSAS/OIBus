import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import { createRequire } from 'node:module';
import { PassThrough, Readable } from 'node:stream';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import testData from '../../tests/utils/test-data';
import { assertContains, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type { ReqOptions, ReqResponse } from '../http-request.utils';
import type OIAnalyticsClientType from './oianalytics-client.service';

const nodeRequire = createRequire(import.meta.url);

// Default mocked HTTP Options
const mockHttpOptions = {
  headers: { 'Existing-Header': 'value' },
  auth: { type: 'bearer', token: 'mock-token' },
  timeout: 10000
};

// Mocked module exports: the SUT keeps a reference to these objects, so their functions are replaced in beforeEach
const createHttpRequestMocks = () => ({
  HTTPRequest: mock.fn(async (_url: URL, _options: ReqOptions): Promise<ReqResponse> => createMockResponse(200))
});
const createUtilsMocks = () => ({ generateRandomId: mock.fn(() => '123ABC') });
const createUtilsOIAnalyticsMocks = () => ({
  buildHttpOptions: mock.fn(async (method: string) => ({ ...mockHttpOptions, method })),
  getHeaders: mock.fn(async () => ({})),
  getProxyOptions: mock.fn(() => ({ acceptUnauthorized: false, proxy: undefined })),
  getUrl: mock.fn((endpoint: string, host: string) => new URL(endpoint, host))
});
const httpRequestExports = createHttpRequestMocks();
const utilsExports = createUtilsMocks();
const utilsOIAnalyticsExports = createUtilsOIAnalyticsMocks();

let OIAnalyticsClient: typeof OIAnalyticsClientType;

before(() => {
  mockModule(nodeRequire, '../http-request.utils', httpRequestExports);
  mockModule(nodeRequire, '../utils', utilsExports);
  mockModule(nodeRequire, '../utils-oianalytics', utilsOIAnalyticsExports);

  OIAnalyticsClient = reloadModule<{ default: typeof OIAnalyticsClientType }>(nodeRequire, './oianalytics-client.service').default;
});

describe('OIAnalytics Client', () => {
  let service: OIAnalyticsClientType;

  const respondWith = (statusCode: number, body?: Parameters<typeof createMockResponse>[1]) =>
    httpRequestExports.HTTPRequest.mock.mockImplementation(async () => createMockResponse(statusCode, body));
  const sentRequest = () => httpRequestExports.HTTPRequest.mock.calls[0].arguments;

  beforeEach(() => {
    Object.assign(httpRequestExports, createHttpRequestMocks());
    Object.assign(utilsExports, createUtilsMocks());
    Object.assign(utilsOIAnalyticsExports, createUtilsOIAnalyticsMocks());

    service = new OIAnalyticsClient();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('updateCommandStatus', () => {
    it('should call PUT endpoint with correct options', async () => {
      await service.updateCommandStatus(testData.oIAnalytics.registration.completed, 'payload');

      assert.strictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls.length, 1);
      assert.deepStrictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls[0].arguments, [
        'PUT',
        true,
        testData.oIAnalytics.registration.completed,
        null,
        30_000,
        null
      ]);

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/commands/status'));
      assert.strictEqual(calledOptions.body, 'payload');
      assertContains(calledOptions.headers as Record<string, unknown>, { 'Content-Type': 'application/json', 'Existing-Header': 'value' });
    });

    it('should throw on error response', async () => {
      respondWith(400, 'Bad Request');
      await assert.rejects(() => service.updateCommandStatus(testData.oIAnalytics.registration.completed, 'payload'), /400 - Bad Request/);
    });
  });

  describe('retrieveCancelledCommands', () => {
    const commands = [testData.oIAnalytics.commands.oIBusList[0]];

    it('should call GET endpoint with query params', async () => {
      respondWith(200, []);

      const result = await service.retrieveCancelledCommands(testData.oIAnalytics.registration.completed, commands);

      assert.deepStrictEqual(result, []);
      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/commands/list-by-ids'));
      assert.deepStrictEqual(calledOptions.query, { ids: ['commandId1'] });
    });

    it('should throw on error response', async () => {
      respondWith(400, 'Bad Request');
      await assert.rejects(
        () => service.retrieveCancelledCommands(testData.oIAnalytics.registration.completed, commands),
        /400 - Bad Request/
      );
    });
  });

  describe('retrievePendingCommands', () => {
    it('should call GET endpoint', async () => {
      respondWith(200, []);

      const result = await service.retrievePendingCommands(testData.oIAnalytics.registration.completed);

      assert.deepStrictEqual(result, []);
      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/commands/pending'));
      assert.deepStrictEqual(calledOptions, { ...mockHttpOptions, method: 'GET' });
    });

    it('should throw on error response', async () => {
      respondWith(400, 'Bad Request');
      await assert.rejects(() => service.retrievePendingCommands(testData.oIAnalytics.registration.completed), /400 - Bad Request/);
    });
  });

  describe('register', () => {
    it('should post payload', async () => {
      const mockResponse = { redirectUrl: 'url', expirationDate: 'date', activationCode: '123ABC' };
      respondWith(200, mockResponse);

      const result = await service.register(testData.oIAnalytics.registration.completed, testData.engine.oIBusInfo, 'public key');

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = sentRequest();
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
      respondWith(400, 'Bad Request');
      await assert.rejects(
        () => service.register(testData.oIAnalytics.registration.completed, testData.engine.oIBusInfo, 'public key'),
        /400 - Bad Request/
      );
    });
  });

  describe('checkRegistration', () => {
    it('should call checkUrl', async () => {
      const mockResponse = { status: 'REGISTERED', expired: false, accessToken: 'token' };
      respondWith(200, mockResponse);

      const result = await service.checkRegistration(testData.oIAnalytics.registration.completed);

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = sentRequest();
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
      respondWith(400, 'Bad Request');
      await assert.rejects(() => service.checkRegistration(testData.oIAnalytics.registration.completed), /400 - Bad Request/);
    });
  });

  describe('sendConfiguration', () => {
    it('should call PUT endpoint', async () => {
      await service.sendConfiguration(testData.oIAnalytics.registration.completed, 'config-payload');

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/configuration'));
      assert.strictEqual(calledOptions.method, 'PUT');
      assert.strictEqual(calledOptions.body, 'config-payload');
    });

    it('should throw on error response', async () => {
      respondWith(400, 'Bad Request');
      await assert.rejects(
        () => service.sendConfiguration(testData.oIAnalytics.registration.completed, 'config-payload'),
        /400 - Bad Request/
      );
    });
  });

  describe('sendHistoryQuery', () => {
    it('should call PUT endpoint', async () => {
      await service.sendHistoryQuery(testData.oIAnalytics.registration.completed, 'history-payload');

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/configuration/history-query'));
      assert.strictEqual(calledOptions.method, 'PUT');
      assert.strictEqual(calledOptions.body, 'history-payload');
    });

    it('should throw on error response', async () => {
      respondWith(400, 'Bad Request');
      await assert.rejects(
        () => service.sendHistoryQuery(testData.oIAnalytics.registration.completed, 'history-payload'),
        /400 - Bad Request/
      );
    });
  });

  describe('sendConfigurationWorkflowResult', () => {
    it('should call PUT endpoint', async () => {
      await service.sendConfigurationWorkflowResult(testData.oIAnalytics.registration.completed, 'workflow-result-payload');

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/configuration/configuration-workflow-result'));
      assert.strictEqual(calledOptions.method, 'PUT');
      assert.strictEqual(calledOptions.body, 'workflow-result-payload');
    });

    it('should throw on error response', async () => {
      respondWith(400, 'Bad Request');
      await assert.rejects(
        () => service.sendConfigurationWorkflowResult(testData.oIAnalytics.registration.completed, 'workflow-result-payload'),
        /400 - Bad Request/
      );
    });
  });

  describe('deleteHistoryQuery', () => {
    it('should call DELETE endpoint with query param', async () => {
      await service.deleteHistoryQuery(testData.oIAnalytics.registration.completed, 'hist-1');

      assert.strictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls.length, 1);
      assert.deepStrictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls[0].arguments, [
        'DELETE',
        true,
        testData.oIAnalytics.registration.completed,
        null,
        30000,
        null
      ]);

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/configuration/history-query'));
      assert.deepStrictEqual(calledOptions.query, { historyId: 'hist-1' });
    });

    it('should throw on error response', async () => {
      respondWith(400, 'Bad Request');
      await assert.rejects(() => service.deleteHistoryQuery(testData.oIAnalytics.registration.completed, 'hist-1'), /400 - Bad Request/);
    });
  });

  describe('downloadFile', () => {
    it('should stream the download directly to disk without buffering in memory', async () => {
      const mockBuffer = Buffer.from('file');
      // .buffer is the shared pool — slice to an isolated ArrayBuffer so only the
      // actual data is streamed, not the full 64 KB pool.
      const isolatedArrayBuffer = mockBuffer.buffer.slice(
        mockBuffer.byteOffset,
        mockBuffer.byteOffset + mockBuffer.byteLength
      ) as ArrayBuffer;
      respondWith(200, isolatedArrayBuffer);

      const writtenChunks: Array<Buffer> = [];
      const sink = new PassThrough();
      sink.on('data', (chunk: Buffer) => writtenChunks.push(chunk));
      const createWriteStreamMock = mock.method(fsSync, 'createWriteStream', () => sink);

      await service.downloadFile(testData.oIAnalytics.registration.completed, 'asset-1', 'target.zip');

      assert.strictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls.length, 1);
      assert.deepStrictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls[0].arguments, [
        'GET',
        true,
        testData.oIAnalytics.registration.completed,
        null,
        900_000,
        null
      ]);

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/upgrade/asset'));
      assert.deepStrictEqual(calledOptions.query, { assetId: 'asset-1' });

      assert.strictEqual(createWriteStreamMock.mock.calls.length, 1);
      assert.strictEqual(createWriteStreamMock.mock.calls[0].arguments[0], 'target.zip');
      assert.deepStrictEqual(Buffer.concat(writtenChunks), mockBuffer);
    });

    it('should throw on error response', async () => {
      respondWith(400, 'Bad Request');
      await assert.rejects(
        () => service.downloadFile(testData.oIAnalytics.registration.completed, 'asset-1', 'target.zip'),
        /400 - Bad Request/
      );
    });
  });

  describe('retrieveConfigurationFile', () => {
    it('should retrieve the content of a configuration file', async () => {
      respondWith(200, '{"oibusVersion":"3.10.0"}');

      const result = await service.retrieveConfigurationFile(testData.oIAnalytics.registration.completed, 'file-1');

      assert.strictEqual(result, '{"oibusVersion":"3.10.0"}');
      assert.deepStrictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls[0].arguments, [
        'GET',
        true,
        testData.oIAnalytics.registration.completed,
        null,
        900_000,
        null
      ]);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/commands/configuration-file'));
      assert.deepStrictEqual(calledOptions.query, { fileId: 'file-1' });
    });

    it('should throw on error response', async () => {
      respondWith(404, 'Not Found');
      await assert.rejects(
        () => service.retrieveConfigurationFile(testData.oIAnalytics.registration.completed, 'file-1'),
        /404 - Not Found/
      );
    });
  });

  describe('uploadCommandFile', () => {
    it('should upload the file of a command as multipart', async () => {
      respondWith(200, { fileId: 'file-1' });
      const createReadStreamMock = mock.method(fsSync, 'createReadStream', () => Readable.from([Buffer.from('zip content')]));

      const fileId = await service.uploadCommandFile(testData.oIAnalytics.registration.completed, 'command 1', 'path/file.zip', 'file.zip');

      assert.strictEqual(fileId, 'file-1');
      assert.deepStrictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls[0].arguments, [
        'POST',
        true,
        testData.oIAnalytics.registration.completed,
        null,
        900_000,
        null
      ]);
      assert.deepStrictEqual(createReadStreamMock.mock.calls[0].arguments, ['path/file.zip']);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/commands/command%201/file'));
      const contentType = (calledOptions.headers as Record<string, string>)['content-type'];
      const boundary = contentType.replace('multipart/form-data; boundary=', '');
      const chunks: Array<Buffer> = [];
      for await (const chunk of calledOptions.body as Readable) {
        chunks.push(chunk);
      }
      assert.strictEqual(
        Buffer.concat(chunks).toString(),
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="file.zip"\r\nContent-Type: application/zip\r\n\r\n` +
          `zip content\r\n--${boundary}--\r\n`
      );
    });

    it('should throw on error response', async () => {
      respondWith(413, 'Payload Too Large');
      mock.method(fsSync, 'createReadStream', () => Readable.from([]));
      await assert.rejects(
        () => service.uploadCommandFile(testData.oIAnalytics.registration.completed, 'command1', 'path/file.zip', 'file.zip'),
        /413 - Payload Too Large/
      );
    });
  });
});
