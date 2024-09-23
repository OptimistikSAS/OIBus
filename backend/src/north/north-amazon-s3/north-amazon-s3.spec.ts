import { createReadStream, ReadStream } from 'node:fs';
import fs from 'node:fs/promises';

import { S3Client } from '@aws-sdk/client-s3';
import NorthAmazonS3 from './north-amazon-s3';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import ValueCacheServiceMock from '../../tests/__mocks__/service/cache/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/service/cache/file-cache-service.mock';
import ArchiveServiceMock from '../../tests/__mocks__/service/cache/archive-service.mock';
import { NorthAmazonS3Settings } from '../../../../shared/model/north-settings.model';
import csv from 'papaparse';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import NorthConnectorMetricsRepository from '../../repository/logs/north-connector-metrics.repository';
import NorthMetricsRepositoryMock from '../../tests/__mocks__/repository/log/north-metrics-repository.mock';
import NorthConnectorMetricsServiceMock from '../../tests/__mocks__/service/north-connector-metrics-service.mock';
import testData from '../../tests/utils/test-data';
import { NorthConnectorEntity } from '../../model/north-connector.model';

const sendMock = jest.fn();
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/node-http-handler', () => ({ NodeHttpHandler: jest.fn() }));
jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('papaparse');
jest.mock('../../service/utils');
(fs.stat as jest.Mock).mockReturnValue({ size: 123 });

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const northMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const valueCacheService = new ValueCacheServiceMock();
const fileCacheService = new FileCacheServiceMock();
const archiveService = new ArchiveServiceMock();
const northConnectorMetricsService = new NorthConnectorMetricsServiceMock();
jest.mock(
  '../../service/cache/value-cache.service',
  () =>
    function () {
      return valueCacheService;
    }
);
jest.mock(
  '../../service/cache/file-cache.service',
  () =>
    function () {
      return fileCacheService;
    }
);
jest.mock(
  '../../service/cache/archive.service',
  () =>
    function () {
      return archiveService;
    }
);
jest.mock(
  '../../service/north-connector-metrics.service',
  () =>
    function () {
      return northConnectorMetricsService;
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
      (S3Client as jest.Mock).mockImplementation(() => ({
        send: sendMock
      }));

      north = new NorthAmazonS3(
        configuration,
        encryptionService,
        northConnectorRepository,
        scanModeRepository,
        northMetricsRepository,
        logger,
        'baseFolder'
      );
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
      await north.handleContent({ type: 'raw', filePath });

      expect(createReadStream).toHaveBeenCalledWith(filePath);
    });

    it('should properly handle values', async () => {
      (createReadStream as jest.Mock).mockImplementation(() => ({}) as ReadStream);

      await north.start();
      await north.handleValues([{ pointId: 'pointId', timestamp: '2020-02-02T02:02:02.222Z', data: { value: '123' } }]);
    });

    it('should properly catch handle file error', async () => {
      const filePath = '/csv/test/file-789.csv';
      (createReadStream as jest.Mock).mockImplementation(() => ({}) as ReadStream);

      sendMock.mockImplementationOnce(() => {
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

      (S3Client as jest.Mock).mockImplementation(() => ({
        send: sendMock
      }));

      north = new NorthAmazonS3(
        configuration,
        encryptionService,
        northConnectorRepository,
        scanModeRepository,
        northMetricsRepository,
        logger,
        'baseFolder'
      );
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

      sendMock.mockImplementationOnce(() => {
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

      (S3Client as jest.Mock).mockImplementation(() => ({
        send: sendMock
      }));

      north = new NorthAmazonS3(
        configuration,
        encryptionService,
        northConnectorRepository,
        scanModeRepository,
        northMetricsRepository,
        logger,
        'baseFolder'
      );
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
      sendMock.mockReturnValueOnce({ result: 'ok' });
      await north.testConnection();
      expect(sendMock).toHaveBeenCalledTimes(1);
    });

    it('should test connection and fail', async () => {
      const error = new Error('connection error');
      sendMock.mockImplementationOnce(() => {
        throw error;
      });

      await expect(north.testConnection()).rejects.toThrow(new Error(`Error testing Amazon S3 connection. ${error}`));
    });

    it('should throw error on handle values', async () => {
      await expect(north.handleContent({ type: 'time-values', content: [] })).rejects.toThrow(new Error(`Can not manage time values`));
    });
  });
});
