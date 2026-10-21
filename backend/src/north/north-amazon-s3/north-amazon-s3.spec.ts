import assert from 'node:assert/strict';
import type { ReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { S3Client } from '@aws-sdk/client-s3';

import type { NorthAmazonS3Settings } from '../../../shared/model/connector/north-settings.model';

import type * as Utils from '../../service/utils';
import { createCacheServiceMock } from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { buildNorthEntity, createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type NorthAmazonS3Class from './north-amazon-s3';

const nodeRequire = createRequire(import.meta.url);

// The commands only keep their input, so that the test can compare what is sent
class PutObjectCommand {
  constructor(readonly input: unknown) {}
}
class HeadBucketCommand {
  constructor(readonly input: unknown) {}
}

const buildSettings = (settings: Partial<NorthAmazonS3Settings> = {}): NorthAmazonS3Settings => ({
  region: 'eu-west-1',
  bucket: 'oibus',
  folder: 'myFolder',
  accessKey: 'access-key',
  secretKey: 'secret-key',
  useProxy: true,
  proxyUrl: 'http://localhost',
  proxyUsername: 'proxy-user',
  proxyPassword: 'proxy-password',
  ...settings
});

describe('NorthAmazonS3', () => {
  let NorthAmazonS3: typeof NorthAmazonS3Class;
  let north: NorthAmazonS3Class;
  let logger: PinoLogger;
  let s3: Mocked<S3Client>;
  let HttpsProxyAgent: Mock<(...args: Array<unknown>) => object>;

  const httpsProxyAgentExports: Record<string, unknown> = {};
  const utilsExports: typeof Utils = { ...nodeRequire('../../service/utils') };

  before(() => {
    mockModule(nodeRequire, '@aws-sdk/client-s3', { S3Client: class {}, PutObjectCommand, HeadBucketCommand });
    mockModule(nodeRequire, '@smithy/node-http-handler', { NodeHttpHandler: class {} });
    mockModule(nodeRequire, 'https-proxy-agent', httpsProxyAgentExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: { decryptText: async (text: string) => text }
    });
    // No transformation here: don't pay for loading every transformer
    mockModule(nodeRequire, '../../service/transformer.service', {});
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    NorthAmazonS3 = reloadModule<{ default: typeof NorthAmazonS3Class }>(nodeRequire, './north-amazon-s3').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    s3 = createMock<S3Client>();
    // A regular function: it is called with `new`
    HttpsProxyAgent = mock.fn(function (..._args: Array<unknown>) {
      return {};
    });
    httpsProxyAgentExports.HttpsProxyAgent = HttpsProxyAgent;
    // start() waits for runMinDelay before checking the cache
    Object.assign(utilsExports, { delay: async () => undefined });
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    north = new NorthAmazonS3(buildNorthEntity<NorthAmazonS3Settings>('aws-s3', buildSettings()), createCacheServiceMock());
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should retrieve supported types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['any']);
  });

  it('should properly start', async () => {
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    await north.start();
    assert.strictEqual(prepareConnectionMock.mock.calls.length, 1);
    assert.deepStrictEqual(prepareConnectionMock.mock.calls[0].arguments, [north.connectorConfiguration.settings]);
  });

  it('should properly test connection', async () => {
    const prepareConnectionMock = mock.method(north, 'prepareConnection', async () => undefined);
    north['s3'] = s3;

    const testResult = await north.testConnection();

    assert.strictEqual(prepareConnectionMock.mock.calls.length, 1);
    assert.deepStrictEqual(prepareConnectionMock.mock.calls[0].arguments, [north.connectorConfiguration.settings]);
    assert.strictEqual(s3.send.mock.calls.length, 1);
    assert.deepStrictEqual(s3.send.mock.calls[0].arguments[0], new HeadBucketCommand({ Bucket: 'oibus' }));
    assert.strictEqual(logger.info.mock.calls.length, 1);
    assert.deepStrictEqual(logger.info.mock.calls[0].arguments, ['Access to bucket "oibus" allowed']);
    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Bucket', value: 'oibus' },
        { key: 'Region', value: 'eu-west-1' }
      ]
    });
  });

  it('should properly manage error on test connection', async () => {
    mock.method(north, 'prepareConnection', async () => undefined);
    s3.send.mock.mockImplementationOnce(async () => {
      throw new Error('AWS error');
    });
    north['s3'] = s3;

    await assert.rejects(north.testConnection(), new Error('Error testing Amazon S3 connection: AWS error'));

    assert.strictEqual(s3.send.mock.calls.length, 1);
    assert.strictEqual(logger.info.mock.calls.length, 0);
  });

  it('should properly prepare connection with proxy', async () => {
    await north.prepareConnection(north.connectorConfiguration.settings);

    assert.strictEqual(HttpsProxyAgent.mock.calls.length, 1);
    assert.deepStrictEqual(HttpsProxyAgent.mock.calls[0].arguments, ['http://proxy-user:proxy-password@localhost/']);
  });

  it('should properly prepare connection with proxy without credentials', async () => {
    await north.prepareConnection(buildSettings({ proxyUsername: '', proxyPassword: '' }));

    assert.strictEqual(HttpsProxyAgent.mock.calls.length, 1);
    assert.deepStrictEqual(HttpsProxyAgent.mock.calls[0].arguments, ['http://localhost']);
  });

  it('should properly prepare connection without proxy', async () => {
    await north.prepareConnection(buildSettings({ useProxy: false }));

    assert.strictEqual(HttpsProxyAgent.mock.calls.length, 0);
  });

  it('should properly handle content', async () => {
    const readStream = {} as ReadStream;
    north['s3'] = s3;

    await north.handleContent(readStream, {
      contentFile: 'file-789.csv',
      contentSize: 1234,
      numberOfElement: 0,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    assert.strictEqual(s3.send.mock.calls.length, 1);
    assert.deepStrictEqual(
      s3.send.mock.calls[0].arguments[0],
      new PutObjectCommand({ Bucket: 'oibus', Key: 'myFolder/file-789.csv', Body: readStream })
    );
  });
});
