import fs from 'node:fs/promises';
import path from 'node:path';

import NorthFileWriter from './north-file-writer';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import ValueCacheServiceMock from '../../tests/__mocks__/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/file-cache-service.mock';
import ArchiveServiceMock from '../../tests/__mocks__/archive-service.mock';

jest.mock('node:fs/promises');

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();

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
jest.mock('../../service/utils');

const nowDateString = '2020-02-02T02:02:02.222Z';
const configuration: NorthConnectorDTO = {
  id: 'id',
  name: 'north',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  settings: {
    outputFolder: 'outputFolder',
    prefix: 'prefix',
    suffix: 'suffix'
  },
  caching: {
    scanModeId: 'id1',
    retryInterval: 5000,
    groupCount: 10000,
    maxSendCount: 10000,
    retryCount: 2,
    sendFileImmediately: true,
    maxSize: 1000
  },
  archive: {
    enabled: true,
    retentionDuration: 720
  }
};
let north: NorthFileWriter;

describe('NorthFileWriter', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    north = new NorthFileWriter(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    await north.start();
  });

  it('should properly handle values', async () => {
    const values = [
      {
        timestamp: '2021-07-29T12:13:31.883Z',
        data: { value: 666, quality: 'good' },
        pointId: 'pointId'
      }
    ];
    await north.handleValues(values);
    const expectedData = JSON.stringify(values);
    const expectedFileName = `${configuration.settings.prefix}${new Date().getTime()}${configuration.settings.suffix}.json`;
    const expectedOutputFolder = path.resolve(configuration.settings.outputFolder);
    const expectedPath = path.join(expectedOutputFolder, expectedFileName);
    expect(fs.writeFile).toBeCalledWith(expectedPath, expectedData);
  });

  it('should properly catch handle values error', async () => {
    const values = [
      {
        timestamp: '2021-07-29T12:13:31.883Z',
        data: { value: 666, quality: 'good' },
        pointId: 'pointId'
      }
    ];
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(() => {
      throw new Error('Error handling values');
    });
    await expect(north.handleValues(values)).rejects.toThrowError('Error handling values');
  });

  it('should properly handle files', async () => {
    (fs.stat as jest.Mock).mockReturnValue({ size: 666 });
    const filePath = '/path/to/file/example.file';
    const extension = path.extname(filePath);
    let expectedFileName = path.basename(filePath, extension);
    expectedFileName = `${configuration.settings.prefix}${expectedFileName}${configuration.settings.suffix}${extension}`;
    const expectedOutputFolder = path.resolve(configuration.settings.outputFolder);
    await north.handleFile(filePath);
    expect(fs.copyFile).toBeCalledWith(filePath, path.join(expectedOutputFolder, expectedFileName));
  });

  it('should properly catch handle file error', async () => {
    (fs.stat as jest.Mock).mockReturnValue({ size: 666 });
    (fs.copyFile as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Error handling files');
    });
    const filePath = '/path/to/file/example.file';
    await expect(north.handleFile(filePath)).rejects.toThrowError('Error handling files');
  });
});

describe('NorthFileWriter test connection', () => {
  const outputFolder = path.resolve(configuration.settings.outputFolder);

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    north = new NorthFileWriter(configuration, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should have access to output folder', async () => {
    (fs.access as jest.Mock).mockImplementation(() => Promise.resolve());

    await expect(north.testConnection()).resolves.not.toThrow();

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenNthCalledWith(1, 'Testing North File Writer');
    expect(logger.info).toHaveBeenNthCalledWith(2, `Folder "${outputFolder}" exists and is reachable`);
  });

  it('should handle folder not existing', async () => {
    const errorMessage = 'Folder does not exist';
    (fs.access as jest.Mock).mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });

    await expect(north.testConnection()).rejects.toThrow(`Folder "${outputFolder}" does not exist`);

    expect(logger.info).toBeCalledWith('Testing North File Writer');
    expect(logger.error).toBeCalledWith(`Access error on "${outputFolder}": ${errorMessage}`);
  });

  it('should handle not having write access on folder', async () => {
    const errorMessage = 'No write access';
    (fs.access as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error(errorMessage);
      });

    await expect(north.testConnection()).rejects.toThrow('No write access on folder');

    expect(logger.info).toBeCalledWith('Testing North File Writer');
    expect(logger.error).toBeCalledWith(`Access error on "${outputFolder}": ${errorMessage}`);
  });
});
