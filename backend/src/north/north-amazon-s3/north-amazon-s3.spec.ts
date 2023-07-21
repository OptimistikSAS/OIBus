import fs, { ReadStream } from 'node:fs';

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
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';

const sendMock = jest.fn();
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/node-http-handler', () => ({ NodeHttpHandler: jest.fn() }));
jest.mock('node:fs/promises');
jest.mock('node:fs');

jest.mock('../../service/cache/archive.service');
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

const configuration: NorthConnectorDTO = {
  id: 'id',
  name: 'north',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  settings: {
    region: 'eu-west-1',
    bucket: 'oibus',
    folder: 'myFolder',
    authentication: {
      type: 'api-key',
      key: 'key',
      secret: 'secret'
    }
  },
  caching: {
    scanModeId: 'id1',
    retryInterval: 5000,
    groupCount: 10000,
    maxSendCount: 10000,
    retryCount: 2,
    sendFileImmediately: true,
    maxSize: 30000
  },
  archive: {
    enabled: true,
    retentionDuration: 720
  }
};
let north: NorthAmazonS3;

describe('NorthAmazonS3', () => {
  describe('with proxy', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.useFakeTimers();

      (S3Client as jest.Mock).mockImplementation(() => ({
        send: sendMock
      }));

      north = new NorthAmazonS3(configuration, encryptionService, repositoryService, logger, 'baseFolder');
      await north.start();
    });

    it('should properly handle file', async () => {
      const filePath = '/csv/test/file-789.csv';
      jest.spyOn(fs, 'createReadStream').mockImplementation(() => ({} as ReadStream));

      await north.start();
      await north.handleFile(filePath);

      expect(fs.createReadStream).toHaveBeenCalledWith(filePath);
    });

    it('should properly catch handle file error', async () => {
      const filePath = '/csv/test/file-789.csv';
      jest.spyOn(fs, 'createReadStream').mockImplementation(() => ({} as ReadStream));

      sendMock.mockImplementationOnce(() => {
        throw new Error('test');
      });
      await north.start();

      await expect(north.handleFile(filePath)).rejects.toThrowError('test');
    });
  });
});
