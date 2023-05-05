import fs from 'node:fs/promises';
import path from 'node:path';

import NorthFileWriter from './north-file-writer';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';

jest.mock('node:fs/promises');

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);

jest.mock('../../service/cache/value-cache.service');
jest.mock('../../service/cache/file-cache.service');
jest.mock('../../service/cache/archive.service');

jest.mock(
  '../../service/cache.service',
  () =>
    function () {
      return {
        updateMetrics: jest.fn(),
        metrics: {
          numberOfValues: 1,
          numberOfFiles: 1
        }
      };
    }
);

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

    north = new NorthFileWriter(configuration, encryptionService, proxyService, repositoryService, logger, 'baseFolder');
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
