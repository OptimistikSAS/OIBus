import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ReadStream } from 'node:fs';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, buildNorthEntity } from '../../tests/utils/test-utils';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import type { NorthAmazonS3Settings } from '../../../shared/model/north-settings.model';
import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type NorthAmazonS3Class from './north-amazon-s3';

const nodeRequire = createRequire(import.meta.url);

describe('NorthAmazonS3', () => {
  let NorthAmazonS3: typeof NorthAmazonS3Class;
  let north: NorthAmazonS3Class;

  const logger = new PinoLogger();
  const cacheService = new CacheServiceMock();
  const oiBusTransformer = new OIBusTransformerMock();

  const mockSend = mock.fn(async () => undefined);

  const s3ClientExports = {
    S3Client: function (this: { send: typeof mockSend }) {
      this.send = mockSend;
    },
    PutObjectCommand: function (this: { _isMockCommand: boolean; args: unknown }, args: unknown) {
      this._isMockCommand = true;
      this.args = args;
    },
    HeadBucketCommand: function (this: { _isMockCommand: boolean; args: unknown }, args: unknown) {
      this._isMockCommand = true;
      this.args = args;
    }
  };

  const smithyExports = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    NodeHttpHandler: function () {}
  };

  const httpsProxyAgentExports = {
    HttpsProxyAgent: mock.fn(function (this: { _isMockCommand: boolean; args: unknown }, args: unknown) {
      this._isMockCommand = true;
      this.args = args;
    })
  };

  const transformerExports = {
    createTransformer: mock.fn(() => oiBusTransformer)
  };

  const utilsExports = {
    checkAge: mock.fn(() => true),
    compress: mock.fn(async () => undefined),
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => []),
    groupItemsByGroup: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' }))
  };

  const encryptionExports = {
    __esModule: true,
    encryptionService: {
      decryptText: mock.fn(async (text: string) => text)
    }
  };

  let configuration: NorthConnectorEntity<NorthAmazonS3Settings>;

  before(() => {
    mockModule(nodeRequire, '@aws-sdk/client-s3', s3ClientExports);
    mockModule(nodeRequire, '@smithy/node-http-handler', smithyExports);
    mockModule(nodeRequire, 'https-proxy-agent', httpsProxyAgentExports);
    mockModule(nodeRequire, '../../service/transformer.service', transformerExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/encryption.service', encryptionExports);
    mockModule(nodeRequire, '../../service/cache/cache.service', {
      __esModule: true,
      default: function () {
        return cacheService;
      }
    });
    NorthAmazonS3 = reloadModule<{ default: typeof NorthAmazonS3Class }>(nodeRequire, './north-amazon-s3').default;
  });

  beforeEach(() => {
    transformerExports.createTransformer.mock.resetCalls();
    httpsProxyAgentExports.HttpsProxyAgent.mock.resetCalls();
    mockSend.mock.resetCalls();
    encryptionExports.encryptionService.decryptText.mock.resetCalls();
    encryptionExports.encryptionService.decryptText.mock.mockImplementation(async (text: string) => text);
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();

    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });

    configuration = buildNorthEntity<NorthAmazonS3Settings>('aws-s3', {
      region: 'eu-west-1',
      bucket: 'oibus',
      folder: 'myFolder',
      accessKey: 'access-key',
      secretKey: 'secret-key',
      useProxy: true,
      proxyUrl: 'http://localhost',
      proxyUsername: 'proxy-user',
      proxyPassword: 'proxy-password'
    });

    north = new NorthAmazonS3(configuration, logger, cacheService);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should retrieve supported types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['any']);
  });

  it('should properly start', async () => {
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    await north.start();
    assert.strictEqual(prepareConnectionMock.mock.calls.length, 1);
    assert.deepStrictEqual(prepareConnectionMock.mock.calls[0].arguments, [configuration.settings]);
  });

  it('should properly test connection', async () => {
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    // inject a mock s3 client
    (north as unknown as { s3: { send: typeof mockSend } })['s3'] = { send: mockSend };

    const testResult = await north.testConnection();

    assert.strictEqual(prepareConnectionMock.mock.calls.length, 1);
    assert.deepStrictEqual(prepareConnectionMock.mock.calls[0].arguments, [configuration.settings]);
    assert.strictEqual(mockSend.mock.calls.length, 1);
    assert.strictEqual(logger.info.mock.calls.length, 1);
    assert.deepStrictEqual(logger.info.mock.calls[0].arguments, [`Access to bucket "${configuration.settings.bucket}" allowed`]);
    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Bucket', value: configuration.settings.bucket },
        { key: 'Region', value: configuration.settings.region }
      ]
    });
  });

  it('should properly manage error on test connection', async () => {
    mock.method(north, 'prepareConnection', async () => undefined);
    const expectedError = 'AWS error';
    mockSend.mock.mockImplementationOnce(async () => {
      throw new Error(expectedError);
    });
    (north as unknown as { s3: { send: typeof mockSend } })['s3'] = { send: mockSend };

    await assert.rejects(
      async () => {
        await north.testConnection();
      },
      new Error(`Error testing Amazon S3 connection: ${expectedError}`)
    );

    assert.strictEqual(mockSend.mock.calls.length, 1);
    assert.strictEqual(logger.info.mock.calls.length, 0);
  });

  it('should properly prepare connection with proxy', async () => {
    await north.prepareConnection(configuration.settings);

    assert.strictEqual(httpsProxyAgentExports.HttpsProxyAgent.mock.calls.length, 1);
    assert.deepStrictEqual(httpsProxyAgentExports.HttpsProxyAgent.mock.calls[0].arguments, ['http://proxy-user:proxy-password@localhost/']);
  });

  it('should properly prepare connection with proxy without credentials', async () => {
    await north.prepareConnection({
      region: 'eu-west-1',
      bucket: 'oibus',
      folder: 'myFolder',
      accessKey: 'access-key',
      secretKey: 'secret-key',
      useProxy: true,
      proxyUrl: 'http://localhost',
      proxyUsername: '',
      proxyPassword: ''
    });

    assert.strictEqual(httpsProxyAgentExports.HttpsProxyAgent.mock.calls.length, 1);
    assert.deepStrictEqual(httpsProxyAgentExports.HttpsProxyAgent.mock.calls[0].arguments, ['http://localhost']);
  });

  it('should properly prepare connection without proxy', async () => {
    await north.prepareConnection({
      region: 'eu-west-1',
      bucket: 'oibus',
      folder: 'myFolder',
      accessKey: 'access-key',
      secretKey: 'secret-key',
      useProxy: false,
      proxyUrl: 'http://localhost',
      proxyUsername: 'proxy-user',
      proxyPassword: 'proxy-password'
    });

    assert.strictEqual(httpsProxyAgentExports.HttpsProxyAgent.mock.calls.length, 0);
  });

  it('should properly handle content', async () => {
    const readStream = {} as ReadStream;
    (north as unknown as { s3: { send: typeof mockSend } })['s3'] = { send: mockSend };

    await north.handleContent(readStream, {
      contentFile: 'file-789.csv',
      contentSize: 1234,
      numberOfElement: 0,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    assert.strictEqual(mockSend.mock.calls.length, 1);
    // Verify the PutObjectCommand was called with the right body
    const sentCommand = mockSend.mock.calls[0].arguments[0] as { args: { Bucket: string; Key: string; Body: ReadStream } };
    assert.deepStrictEqual(sentCommand.args, {
      Bucket: 'oibus',
      Key: 'myFolder/file-789.csv',
      Body: readStream
    });
  });
});
