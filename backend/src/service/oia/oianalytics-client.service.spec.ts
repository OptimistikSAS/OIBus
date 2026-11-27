import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import { createRequire } from 'node:module';
import { PassThrough, Readable } from 'node:stream';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import * as forge from 'node-forge';

import { RegistrationSettingsCommandDTO } from '../../../shared/model/api/engine.model';
import { ServerIdentity } from '../../../shared/model/domain/server-identity.model';

import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import testData from '../../tests/utils/test-data';
import { assertContains, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type { ReqOptions, ReqResponse } from '../http-request.utils';
import type * as UtilsTls from '../utils-tls';
import type OIAnalyticsClientType from './oianalytics-client.service';
import type {
  OIAnalyticsInvalidGrantError as OIAnalyticsInvalidGrantErrorType,
  OIAnalyticsTokenRefreshUnsupportedError as OIAnalyticsTokenRefreshUnsupportedErrorType
} from './oianalytics-client.service';

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
  ...nodeRequire('../utils-oianalytics'),
  buildHttpOptions: mock.fn(async (method: string) => ({ ...mockHttpOptions, method })),
  getHeaders: mock.fn(() => ({})),
  getProxyOptions: mock.fn(() => undefined),
  getUrl: mock.fn((endpoint: string, host: string) => new URL(endpoint, host))
});
const createEncryptionMocks = () => ({
  encryptionService: { decryptText: mock.fn((text: string) => `decrypted ${text}`) }
});
// The identity OIAnalytics presents when its certificate is read: the probe is not run
const presentedIdentity: ServerIdentity = { type: 'x509', fingerprint: 'AB:CD', details: { keyType: 'rsa' } };
const createUtilsTlsMocks = () => {
  const real: typeof UtilsTls = nodeRequire('../utils-tls');
  return {
    ...real,
    TlsServerTrust: class extends real.TlsServerTrust {
      override async retrieveServerIdentity(): Promise<ServerIdentity | null> {
        return presentedIdentity;
      }
    }
  };
};
const httpRequestExports = createHttpRequestMocks();
const utilsTlsExports = createUtilsTlsMocks();
const encryptionExports = createEncryptionMocks();
const utilsExports = createUtilsMocks();
const utilsOIAnalyticsExports = createUtilsOIAnalyticsMocks();

let OIAnalyticsClient: typeof OIAnalyticsClientType;
let OIAnalyticsInvalidGrantError: typeof OIAnalyticsInvalidGrantErrorType;
let OIAnalyticsTokenRefreshUnsupportedError: typeof OIAnalyticsTokenRefreshUnsupportedErrorType;

before(() => {
  mockModule(nodeRequire, '../encryption.service', encryptionExports);
  mockModule(nodeRequire, '../http-request.utils', httpRequestExports);
  mockModule(nodeRequire, '../utils', utilsExports);
  mockModule(nodeRequire, '../utils-oianalytics', utilsOIAnalyticsExports);
  mockModule(nodeRequire, '../utils-tls', utilsTlsExports);

  const clientModule = reloadModule<{
    default: typeof OIAnalyticsClientType;
    OIAnalyticsInvalidGrantError: typeof OIAnalyticsInvalidGrantErrorType;
    OIAnalyticsTokenRefreshUnsupportedError: typeof OIAnalyticsTokenRefreshUnsupportedErrorType;
  }>(nodeRequire, './oianalytics-client.service');
  OIAnalyticsClient = clientModule.default;
  OIAnalyticsInvalidGrantError = clientModule.OIAnalyticsInvalidGrantError;
  OIAnalyticsTokenRefreshUnsupportedError = clientModule.OIAnalyticsTokenRefreshUnsupportedError;
});

describe('OIAnalytics Client', () => {
  let service: OIAnalyticsClientType;

  const respondWith = (statusCode: number, body?: Parameters<typeof createMockResponse>[1]) =>
    httpRequestExports.HTTPRequest.mock.mockImplementation(async () => createMockResponse(statusCode, body));
  const sentRequest = () => httpRequestExports.HTTPRequest.mock.calls[0].arguments;

  beforeEach(() => {
    Object.assign(httpRequestExports, createHttpRequestMocks());
    Object.assign(encryptionExports, createEncryptionMocks());
    Object.assign(utilsExports, createUtilsMocks());
    Object.assign(utilsOIAnalyticsExports, createUtilsOIAnalyticsMocks());

    service = new OIAnalyticsClient(certificateId => ({ certificate: `certificate ${certificateId}` }));
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
      assert.deepStrictEqual(calledOptions, { ...mockHttpOptions, method: 'GET', tls: {} });
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
          publicKey: 'public key',
          tokenRefresh: true
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
      const mockResponse = {
        status: 'COMPLETED',
        expired: false,
        accessToken: 'token',
        accessTokenExpiresIn: 3600,
        refreshToken: 'refresh',
        refreshTokenExpiresIn: 7_776_000
      };
      respondWith(200, mockResponse);

      const result = await service.checkRegistration(testData.oIAnalytics.registration.completed);

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.includes(testData.oIAnalytics.registration.completed.checkUrl!));
      assert.deepStrictEqual(calledOptions, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        proxy: undefined,
        timeout: 30000,
        tls: {}
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

  describe('refreshToken', () => {
    const tokens = { accessToken: 'access', accessTokenExpiresIn: 3600, refreshToken: 'refresh', refreshTokenExpiresIn: 7_776_000 };

    it('should post the decrypted refresh token and the public key without bearer authentication', async () => {
      respondWith(200, tokens);

      const result = await service.refreshToken(testData.oIAnalytics.registration.completed);

      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.endsWith('/api/oianalytics/oibus/registration/token'));
      assert.deepStrictEqual(calledOptions, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'decrypted refresh token', publicKey: 'public key' }),
        proxy: undefined,
        timeout: 30000,
        tls: {}
      });
      assert.deepStrictEqual(result, tokens);
    });

    it('should throw an invalid grant error when OIAnalytics refuses the refresh token', async () => {
      respondWith(401, { error: 'invalid_grant' });
      await assert.rejects(() => service.refreshToken(testData.oIAnalytics.registration.completed), OIAnalyticsInvalidGrantError);
    });

    for (const [statusCode, body] of [
      [401, 'Unauthorized'],
      [401, { error: 'invalid_token' }],
      [400, { error: 'invalid_grant' }],
      [502, 'Bad Gateway']
    ] as const) {
      it(`should throw a transient error on ${statusCode} - ${JSON.stringify(body)}`, async () => {
        respondWith(statusCode, body);
        const error = await service.refreshToken(testData.oIAnalytics.registration.completed).catch((e: unknown) => e);
        assert.ok(error instanceof Error);
        assert.ok(!(error instanceof OIAnalyticsInvalidGrantError));
        assert.ok(error.message.startsWith(`${statusCode} - `));
      });
    }
  });

  describe('exchangeToken', () => {
    const tokens = { accessToken: 'access', accessTokenExpiresIn: 3600, refreshToken: 'refresh', refreshTokenExpiresIn: 7_776_000 };

    it('should post with the long-lived token as bearer', async () => {
      respondWith(200, tokens);

      const result = await service.exchangeToken(testData.oIAnalytics.registration.completed);

      assert.deepStrictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls[0].arguments, [
        'POST',
        true,
        testData.oIAnalytics.registration.completed,
        null,
        30_000,
        null
      ]);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.endsWith('/api/oianalytics/oibus/token/exchange'));
      assert.strictEqual(calledOptions.method, 'POST');
      assert.deepStrictEqual(result, tokens);
    });

    it('should throw an invalid grant error when OIAnalytics refuses the long-lived token', async () => {
      respondWith(401, { error: 'invalid_grant' });
      await assert.rejects(() => service.exchangeToken(testData.oIAnalytics.registration.completed), OIAnalyticsInvalidGrantError);
    });

    it('should throw an unsupported error when OIAnalytics does not know the endpoint yet', async () => {
      respondWith(404, 'Not Found');
      await assert.rejects(
        () => service.exchangeToken(testData.oIAnalytics.registration.completed),
        OIAnalyticsTokenRefreshUnsupportedError
      );
    });

    it('should throw a transient error otherwise', async () => {
      respondWith(503, 'Service Unavailable');
      await assert.rejects(() => service.exchangeToken(testData.oIAnalytics.registration.completed), /503 - Service Unavailable/);
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

  describe('sendSyncMetadata', () => {
    it('should call PUT endpoint', async () => {
      await service.sendSyncMetadata(testData.oIAnalytics.registration.completed, 'sync-metadata-payload');

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.includes('/api/oianalytics/oibus/sync-metadata'));
      assert.strictEqual(calledOptions.method, 'PUT');
      assert.strictEqual(calledOptions.body, 'sync-metadata-payload');
    });

    it('should throw on error response', async () => {
      respondWith(400, 'Bad Request');
      await assert.rejects(
        () => service.sendSyncMetadata(testData.oIAnalytics.registration.completed, 'sync-metadata-payload'),
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

  describe('interactive sessions', () => {
    const registration = testData.oIAnalytics.registration.completed;

    it('should retrieve the requests of a session', async () => {
      const requests = [{ id: 'request1', type: 'BROWSE', content: { exploreId: 'explore1', parentId: null }, creationDate: '' }];
      respondWith(200, requests);

      const result = await service.retrieveSessionRequests(registration, 'session 1');

      assert.deepStrictEqual(result, requests);
      assert.deepStrictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls[0].arguments, [
        'GET',
        true,
        registration,
        null,
        30_000,
        null
      ]);
      assert.ok(sentRequest()[0].href.endsWith('/api/oianalytics/oibus/sessions/session%201/requests'));
    });

    it('should throw the status of a session that does not exist anymore', async () => {
      respondWith(404, 'Not Found');

      await assert.rejects(() => service.retrieveSessionRequests(registration, 'session1'), /^Error: 404 - Not Found$/);
    });

    it('should complete a request', async () => {
      await service.completeSessionRequest(registration, 'session1', 'request 1', { status: 'COMPLETED', result: { entries: [] } });

      assert.deepStrictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls[0].arguments, [
        'PUT',
        true,
        registration,
        null,
        30_000,
        null
      ]);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.endsWith('/api/oianalytics/oibus/sessions/session1/requests/request%201'));
      assert.strictEqual((calledOptions.headers as Record<string, string>)['Content-Type'], 'application/json');
      assert.strictEqual(calledOptions.body, JSON.stringify({ status: 'COMPLETED', result: { entries: [] } }));
    });

    it('should throw when a request cannot be completed', async () => {
      respondWith(400, 'Bad Request');

      await assert.rejects(
        () => service.completeSessionRequest(registration, 'session1', 'request1', { status: 'ERRORED', result: 'error' }),
        /400 - Bad Request/
      );
    });

    it('should upload the result file of a request as multipart', async () => {
      const createReadStreamMock = mock.method(fsSync, 'createReadStream', () => Readable.from([Buffer.from('[]')]));

      await service.uploadSessionRequestFile(registration, 'session1', 'request1', 'path/result.json', 'result.json');

      assert.deepStrictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls[0].arguments, [
        'POST',
        true,
        registration,
        null,
        900_000,
        null
      ]);
      assert.deepStrictEqual(createReadStreamMock.mock.calls[0].arguments, ['path/result.json']);
      const [calledUrl, calledOptions] = sentRequest();
      assert.ok(calledUrl.href.endsWith('/api/oianalytics/oibus/sessions/session1/requests/request1/file'));
      const boundary = (calledOptions.headers as Record<string, string>)['content-type'].replace('multipart/form-data; boundary=', '');
      const chunks: Array<Buffer> = [];
      for await (const chunk of calledOptions.body as Readable) {
        chunks.push(chunk);
      }
      assert.strictEqual(
        Buffer.concat(chunks).toString(),
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="result.json"\r\nContent-Type: application/json\r\n\r\n` +
          `[]\r\n--${boundary}--\r\n`
      );
    });

    it('should throw when the result file cannot be uploaded', async () => {
      respondWith(413, 'Payload Too Large');
      mock.method(fsSync, 'createReadStream', () => Readable.from([]));

      await assert.rejects(
        () => service.uploadSessionRequestFile(registration, 'session1', 'request1', 'path/result.json', 'result.json'),
        /413 - Payload Too Large/
      );
    });

    it('should close a session', async () => {
      await service.closeSession(registration, 'session1');

      assert.deepStrictEqual(utilsOIAnalyticsExports.buildHttpOptions.mock.calls[0].arguments, [
        'DELETE',
        true,
        registration,
        null,
        30_000,
        null
      ]);
      assert.ok(sentRequest()[0].href.endsWith('/api/oianalytics/oibus/sessions/session1'));
    });

    it('should throw when a session cannot be closed', async () => {
      respondWith(404, 'Not Found');

      await assert.rejects(() => service.closeSession(registration, 'session1'), /404 - Not Found/);
    });
  });

  describe('certificate of OIAnalytics', () => {
    const certificationAuthority = (): string => {
      const keys = forge.pki.rsa.generateKeyPair(1024);
      const certificate = forge.pki.createCertificate();
      certificate.publicKey = keys.publicKey;
      certificate.setSubject([{ shortName: 'CN', value: 'CA' }]);
      certificate.setIssuer([{ shortName: 'CN', value: 'CA' }]);
      certificate.setExtensions([{ name: 'basicConstraints', cA: true }]);
      certificate.sign(keys.privateKey, forge.md.sha256.create());
      return forge.pki.certificateToPem(certificate);
    };
    const certificateError = () =>
      new Error('fetch failed', { cause: Object.assign(new Error('self-signed certificate'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }) });
    const registration = { ...testData.oIAnalytics.registration.completed, host: 'https://oia.example.com' };

    it('should validate the certificate of OIAnalytics against the trusted certificate of the registration', async () => {
      const pem = certificationAuthority();
      service = new OIAnalyticsClient(() => ({ certificate: pem }));

      await service.sendConfiguration({ ...registration, certificateValidation: 'trusted', trustedCertificateId: 'ca' }, 'payload');

      assert.deepStrictEqual(sentRequest()[1].tls, { ca: [pem] });
    });

    it('should keep the identity of OIAnalytics refused as pending, until a request succeeds', async () => {
      httpRequestExports.HTTPRequest.mock.mockImplementation(async () => {
        throw certificateError();
      });

      await assert.rejects(service.sendConfiguration(registration, 'payload'), /review the identity of OIAnalytics from the registration/);
      assert.deepStrictEqual(service.pendingServerIdentity, { identity: presentedIdentity, status: 'unknown' });

      respondWith(204);
      await service.sendConfiguration(registration, 'payload');
      assert.strictEqual(service.pendingServerIdentity, null);
    });

    it('should not keep the identity refused when testing settings with an identity trusted in their form', async () => {
      httpRequestExports.HTTPRequest.mock.mockImplementation(async () => {
        throw certificateError();
      });
      const command: RegistrationSettingsCommandDTO = {
        ...registration,
        serverTrust: { identity: presentedIdentity, trustOnFirstUse: false }
      };

      await assert.rejects(service.testConnection(command, true), /review the identity of OIAnalytics from the registration/);
      assert.strictEqual(service.pendingServerIdentity, null);
    });

    it('should retrieve the identity OIAnalytics presents', async () => {
      assert.deepStrictEqual(await service.retrieveServerIdentity(registration), { identity: presentedIdentity, status: 'unknown' });
    });
  });
});
