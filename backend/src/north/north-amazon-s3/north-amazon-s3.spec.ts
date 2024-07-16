import { createReadStream, ReadStream } from 'node:fs';
import fs from 'node:fs/promises';

import { S3Client } from '@aws-sdk/client-s3';

import NorthAmazonS3 from './north-amazon-s3';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ValueCacheServiceMock from '../../tests/__mocks__/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/file-cache-service.mock';
import { NorthCacheSettingsDTO, NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import ArchiveServiceMock from '../../tests/__mocks__/archive-service.mock';
import { NorthAmazonS3Settings } from '../../../../shared/model/north-settings.model';
import csv from 'papaparse';

const sendMock = jest.fn();
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/node-http-handler', () => ({ NodeHttpHandler: jest.fn() }));
jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('papaparse');
(fs.stat as jest.Mock).mockReturnValue({ size: 123 });
jest.mock('../../service/utils');
jest.mock(
  '../../service/cache/archive.service',
  () =>
    function () {
      return new ArchiveServiceMock();
    }
);
jest.mock(
  '../../service/cache/value-cache.service',
  () =>
    function () {
      return new ValueCacheServiceMock();
    }
);
jest.mock(
  '../../service/cache/file-cache.service',
  () =>
    function () {
      return new FileCacheServiceMock();
    }
);
const resetMetrics = jest.fn();
jest.mock(
  '../../service/north-connector-metrics.service',
  () =>
    function () {
      return {
        initMetrics: jest.fn(),
        updateMetrics: jest.fn(),
        get stream() {
          return { stream: 'myStream' };
        },
        resetMetrics,
        metrics: {
          numberOfValuesSent: 1,
          numberOfFilesSent: 1
        }
      };
    }
);

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();

let north: NorthAmazonS3;
const nowDateString = '2020-02-02T02:02:02.222Z';

describe('NorthAmazonS3', () => {
  describe('with proxy', () => {
    const configuration: NorthConnectorDTO<NorthAmazonS3Settings> = {
      id: 'id',
      name: 'north',
      type: 'test',
      description: 'my test connector',
      enabled: true,
      settings: {
        region: 'eu-west-1',
        bucket: 'oibus',
        folder: 'myFolder',
        accessKey: 'access-key',
        secretKey: 'secret-key',
        useProxy: true,
        proxyUrl: 'http://localhost',
        proxyUsername: 'proxy-user',
        proxyPassword: 'proxy-password'
      },
      caching: {
        scanModeId: 'id1',
        oibusTimeValues: {},
        rawFiles: {
          archive: {}
        }
      } as NorthCacheSettingsDTO
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      jest.useFakeTimers().setSystemTime(new Date(nowDateString));
      (csv.unparse as jest.Mock).mockReturnValue('csv content');

      repositoryService.northConnectorRepository.getNorthConnector = jest.fn().mockReturnValue(configuration);

      (S3Client as jest.Mock).mockImplementation(() => ({
        send: sendMock
      }));

      north = new NorthAmazonS3(configuration, encryptionService, repositoryService, logger, 'baseFolder');
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
    const configuration: NorthConnectorDTO<NorthAmazonS3Settings> = {
      id: 'id',
      name: 'north',
      type: 'test',
      description: 'my test connector',
      enabled: true,
      settings: {
        region: 'eu-west-1',
        bucket: 'oibus',
        folder: 'myFolder',
        accessKey: 'access-key',
        secretKey: 'secret-key',
        useProxy: true,
        proxyUrl: 'http://localhost',
        proxyUsername: '',
        proxyPassword: ''
      },
      caching: {
        scanModeId: 'id1',
        oibusTimeValues: {},
        rawFiles: {
          archive: {}
        }
      } as NorthCacheSettingsDTO
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      repositoryService.northConnectorRepository.getNorthConnector = jest.fn().mockReturnValue(configuration);

      (S3Client as jest.Mock).mockImplementation(() => ({
        send: sendMock
      }));

      north = new NorthAmazonS3(configuration, encryptionService, repositoryService, logger, 'baseFolder');
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
    const configuration: NorthConnectorDTO<NorthAmazonS3Settings> = {
      id: 'id',
      name: 'north',
      type: 'test',
      description: 'my test connector',
      enabled: true,
      settings: {
        region: 'eu-west-1',
        bucket: 'oibus',
        folder: 'myFolder',
        accessKey: 'access-key',
        secretKey: '',
        useProxy: false
      },
      caching: {
        scanModeId: 'id1',
        oibusTimeValues: {},
        rawFiles: {
          archive: {}
        }
      } as NorthCacheSettingsDTO
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      repositoryService.northConnectorRepository.getNorthConnector = jest.fn().mockReturnValue(configuration);

      (S3Client as jest.Mock).mockImplementation(() => ({
        send: sendMock
      }));

      north = new NorthAmazonS3(configuration, encryptionService, repositoryService, logger, 'baseFolder');
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
