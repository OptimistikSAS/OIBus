import { createReadStream, ReadStream } from 'node:fs';
import fs from 'node:fs/promises';

import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import NorthAmazonS3 from './north-amazon-s3';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
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
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import TransformerService from '../../service/transformer.service';
import TransformerServiceMock from '../../tests/__mocks__/service/transformer-service.mock';

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
jest.mock('../../service/utils');
(fs.stat as jest.Mock).mockReturnValue({ size: 123 });

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const cacheService: CacheService = new CacheServiceMock();
const transformerService: TransformerService = new TransformerServiceMock();

jest.mock(
  '../../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
    }
);

const timeValues: Array<OIBusTimeValue> = [
  {
    pointId: 'pointId',
    timestamp: testData.constants.dates.FAKE_NOW,
    data: { value: '666', quality: 'good' }
  }
];

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

      north = new NorthAmazonS3(
        configuration,
        encryptionService,
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
        contentType: 'raw',
        source: 'south',
        options: {}
      });

      expect(createReadStream).toHaveBeenCalledWith('/csv/test/file-789.csv');
    });

    it('should properly handle values', async () => {
      (createReadStream as jest.Mock).mockImplementation(() => ({}) as ReadStream);

      await north.start();
      (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(timeValues));
      await north.handleContent({
        contentFile: '/path/to/file/example-123.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'time-values',
        source: 'south',
        options: {}
      });
    });

    it('should properly catch handle file error', async () => {
      const filePath = '/csv/test/file-789.csv';
      (createReadStream as jest.Mock).mockImplementation(() => ({}) as ReadStream);

      s3client.send.mockImplementationOnce(() => {
        throw new Error('test');
      });
      await north.start();

      await expect(north.handleFile(filePath)).rejects.toThrow('test');
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

      north = new NorthAmazonS3(
        configuration,
        encryptionService,
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
      const filePath = '/csv/test/file-789.csv';
      (createReadStream as jest.Mock).mockImplementation(() => ({}) as ReadStream);

      await north.start();
      await north.handleFile(filePath);

      expect(createReadStream).toHaveBeenCalledWith(filePath);
    });

    it('should properly catch handle file error', async () => {
      const filePath = '/csv/test/file-789.csv';
      (createReadStream as jest.Mock).mockImplementation(() => ({}) as ReadStream);

      s3client.send.mockImplementationOnce(() => {
        throw new Error('test');
      });
      await north.start();

      await expect(north.handleFile(filePath)).rejects.toThrow('test');
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

      north = new NorthAmazonS3(
        configuration,
        encryptionService,
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
