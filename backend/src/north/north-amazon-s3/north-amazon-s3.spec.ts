import { ReadStream } from 'node:fs';
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { HttpsProxyAgent } from 'https-proxy-agent';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import NorthAmazonS3 from './north-amazon-s3';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthAmazonS3Settings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { buildNorthConfiguration } from '../../tests/utils/test-utils';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    // Mock the constructor to return our object with the mockSend function
    S3Client: jest.fn().mockImplementation(() => {
      return {
        send: mockSend
      };
    }),
    // Mock the command to return the input params so we can verify them in the 'send' check
    PutObjectCommand: jest.fn().mockImplementation(args => {
      return { _isMockCommand: true, args };
    }),
    HeadBucketCommand: jest.fn().mockImplementation(args => ({ _isMockCommand: true, args }))
  };
});
jest.mock('@smithy/node-http-handler', () => ({ NodeHttpHandler: jest.fn() }));
jest.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: jest.fn().mockImplementation(args => {
    return { _isMockCommand: true, args };
  })
}));
jest.mock('../../service/transformer.service');
jest.mock('../../service/utils');
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const logger: pino.Logger = new PinoLogger();
const cacheService: CacheService = new CacheServiceMock();
const oiBusTransformer: OIBusTransformer = new OIBusTransformerMock() as unknown as OIBusTransformer;

jest.mock(
  '../../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
    }
);

let north: NorthAmazonS3;
let configuration: NorthConnectorEntity<NorthAmazonS3Settings>;

describe('NorthAmazonS3', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = buildNorthConfiguration<NorthAmazonS3Settings>('aws-s3', {
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
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);

    north = new NorthAmazonS3(configuration, logger, cacheService);
  });

  afterEach(() => {
    jest.useRealTimers();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should retrieve supported types', () => {
    expect(north.supportedTypes()).toEqual(['any']);
  });

  it('should properly start', async () => {
    north.prepareConnection = jest.fn();
    await north.start();
    expect(north.prepareConnection).toHaveBeenCalledWith(configuration.settings);
  });

  it('should properly test connection', async () => {
    north.prepareConnection = jest.fn();
    north['s3'] = { send: mockSend } as unknown as S3Client;

    const testResult = await north.testConnection();

    expect(north.prepareConnection).toHaveBeenCalledWith(configuration.settings);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(HeadBucketCommand).toHaveBeenCalledWith({
      Bucket: 'oibus'
    });
    expect(logger.info).toHaveBeenCalledWith(`Access to bucket "${configuration.settings.bucket}" allowed`);
    expect(testResult).toEqual({
      items: [
        { key: 'Bucket', value: configuration.settings.bucket },
        { key: 'Region', value: configuration.settings.region }
      ]
    });
  });

  it('should properly manage error on test connection', async () => {
    north.prepareConnection = jest.fn();
    north['s3'] = { send: mockSend } as unknown as S3Client;
    const expectedError = 'AWS error';
    mockSend.mockRejectedValueOnce(new Error(expectedError));

    await expect(north.testConnection()).rejects.toThrow(`Error testing Amazon S3 connection: ${expectedError}`);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(HeadBucketCommand).toHaveBeenCalledWith({
      Bucket: 'oibus'
    });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should properly prepare connection with proxy', async () => {
    await north.prepareConnection(configuration.settings);
    expect(HttpsProxyAgent).toHaveBeenCalledWith('http://proxy-user:proxy-password@localhost/');
    expect(S3Client).toHaveBeenCalledWith({
      credentials: {
        accessKeyId: 'access-key',
        secretAccessKey: 'secret-key'
      },
      region: 'eu-west-1',
      requestHandler: expect.anything()
    });
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
    expect(HttpsProxyAgent).toHaveBeenCalledWith('http://localhost');
    expect(S3Client).toHaveBeenCalledWith({
      credentials: {
        accessKeyId: 'access-key',
        secretAccessKey: 'secret-key'
      },
      region: 'eu-west-1',
      requestHandler: expect.anything()
    });
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
    expect(S3Client).toHaveBeenCalledWith({
      credentials: {
        accessKeyId: 'access-key',
        secretAccessKey: 'secret-key'
      },
      region: 'eu-west-1'
    });
    expect(HttpsProxyAgent).not.toHaveBeenCalled();
  });

  it('should properly handle content', async () => {
    const readStream = {} as ReadStream;
    north['s3'] = { send: mockSend } as unknown as S3Client;
    await north.handleContent(readStream, {
      contentFile: 'file-789.csv',
      contentSize: 1234,
      numberOfElement: 0,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'oibus',
      Key: 'myFolder/file-789.csv', // Adjust based on how your logic constructs the path
      Body: readStream
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
