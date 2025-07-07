import { createReadStream, ReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { S3Client } from '@aws-sdk/client-s3';
import NorthAmazonS3 from './north-amazon-s3';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthAmazonS3Settings } from '../../../shared/model/north-settings.model';
import csv from 'papaparse';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import testData from '../../tests/utils/test-data';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { mockBaseFolders } from '../../tests/utils/test-utils';
import CacheService from '../../service/cache/cache.service';
import TransformerService, { createTransformer } from '../../service/transformer.service';
import TransformerServiceMock from '../../tests/__mocks__/service/transformer-service.mock';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { getFilenameWithoutRandomId } from '../../service/utils';

const s3client = { send: jest.fn() };
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => s3client),
  PutObjectCommand: jest.fn().mockImplementation(() => ({})),
  HeadBucketCommand: jest.fn().mockImplementation(() => ({}))
}));
jest.mock('@smithy/node-http-handler', () => ({ NodeHttpHandler: jest.fn() }));
jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('papaparse');
jest.mock('../../service/transformer.service');
jest.mock('../../service/utils');
(fs.stat as jest.Mock).mockReturnValue({ size: 123 });
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const logger: pino.Logger = new PinoLogger();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const cacheService: CacheService = new CacheServiceMock();
const transformerService: TransformerService = new TransformerServiceMock();
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
  describe('with proxy', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
      configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
      configuration.settings = {
        region: 'eu-west-1',
        bucket: 'oibus',
        folder: 'myFolder',
        accessKey: 'access-key',
        secretKey: 'secret-key',
        useProxy: true,
        proxyUrl: 'http://localhost',
        proxyUsername: 'proxy-user',
        proxyPassword: 'proxy-password'
      };
      (csv.unparse as jest.Mock).mockReturnValue('csv content');
      (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
      (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
      (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
      (getFilenameWithoutRandomId as jest.Mock).mockReturnValue('example.file');

      north = new NorthAmazonS3(
        configuration,
        transformerService,
        northConnectorRepository,
        scanModeRepository,
        logger,
        mockBaseFolders(testData.north.list[0].id)
      );
    });

    afterEach(() => {
      cacheService.cacheSizeEventEmitter.removeAllListeners();
    });

    it('should properly start', async () => {
      await north.start();
      expect(S3Client).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: 'access-key',
          secretAccessKey: 'secret-key'
        },
        region: 'eu-west-1',
        requestHandler: {}
      });
    });

    it('should properly handle file', async () => {
      (createReadStream as jest.Mock).mockImplementation(() => ({}) as ReadStream);

      await north.start();
      await north.handleContent({
        contentFile: '/csv/test/file-789.csv',
        contentSize: 1234,
        numberOfElement: 0,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any',
        source: 'south',
        options: {}
      });

      expect(createReadStream).toHaveBeenCalledWith('/csv/test/file-789.csv');
    });

    it('should ignore data if bad content type', async () => {
      await expect(
        north.handleContent({
          contentFile: 'path/to/file/example-123456789.file',
          contentSize: 1234,
          numberOfElement: 1,
          createdAt: '2020-02-02T02:02:02.222Z',
          contentType: 'time-values',
          source: 'south',
          options: {}
        })
      ).rejects.toThrow(`Unsupported data type: time-values (file path/to/file/example-123456789.file)`);
    });
  });

  describe('with proxy but without proxy password', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      jest.useFakeTimers();

      configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
      configuration.settings = {
        region: 'eu-west-1',
        bucket: 'oibus',
        folder: 'myFolder',
        accessKey: 'access-key',
        secretKey: 'secret-key',
        useProxy: true,
        proxyUrl: 'http://localhost',
        proxyUsername: '',
        proxyPassword: ''
      };

      (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
      (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
      (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
      (getFilenameWithoutRandomId as jest.Mock).mockReturnValue('example.file');

      north = new NorthAmazonS3(
        configuration,
        transformerService,
        northConnectorRepository,
        scanModeRepository,
        logger,
        mockBaseFolders(testData.north.list[0].id)
      );
    });

    afterEach(() => {
      cacheService.cacheSizeEventEmitter.removeAllListeners();
    });

    it('should properly start', async () => {
      await north.start();
      expect(S3Client).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: 'access-key',
          secretAccessKey: 'secret-key'
        },
        region: 'eu-west-1',
        requestHandler: {}
      });
    });
  });

  describe('without proxy', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      jest.useFakeTimers();

      configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
      configuration.settings = {
        region: 'eu-west-1',
        bucket: 'oibus',
        folder: 'myFolder',
        accessKey: 'access-key',
        secretKey: '',
        useProxy: false
      };

      (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
      (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
      (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
      (getFilenameWithoutRandomId as jest.Mock).mockReturnValue('example.file');

      north = new NorthAmazonS3(
        configuration,
        transformerService,
        northConnectorRepository,
        scanModeRepository,
        logger,
        mockBaseFolders(testData.north.list[0].id)
      );
    });

    afterEach(() => {
      cacheService.cacheSizeEventEmitter.removeAllListeners();
    });

    it('should properly start', async () => {
      await north.start();
      expect(S3Client).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: 'access-key',
          secretAccessKey: ''
        },
        region: 'eu-west-1',
        requestHandler: undefined
      });
    });

    it('should test connection and success', async () => {
      s3client.send.mockReturnValueOnce({ result: 'ok' });
      await north.testConnection();
      expect(s3client.send).toHaveBeenCalledTimes(1);
    });

    it('should test connection and fail', async () => {
      const error = new Error('connection error');
      s3client.send.mockImplementationOnce(() => {
        throw error;
      });

      await expect(north.testConnection()).rejects.toThrow(new Error(`Error testing Amazon S3 connection. ${error}`));
    });
  });
});
