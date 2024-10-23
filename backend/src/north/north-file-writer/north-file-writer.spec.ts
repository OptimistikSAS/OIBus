import fs from 'node:fs/promises';
import path from 'node:path';

import NorthFileWriter from './north-file-writer';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import ValueCacheServiceMock from '../../tests/__mocks__/service/cache/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/service/cache/file-cache-service.mock';
import ArchiveServiceMock from '../../tests/__mocks__/service/cache/archive-service.mock';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import csv from 'papaparse';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthFileWriterSettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';

jest.mock('node:fs/promises');

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const valueCacheService = new ValueCacheServiceMock();
const fileCacheService = new FileCacheServiceMock();
const archiveService = new ArchiveServiceMock();

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

jest.mock('../../service/utils');
jest.mock('papaparse');

let configuration: NorthConnectorEntity<NorthFileWriterSettings>;
let north: NorthFileWriter;

describe('NorthFileWriter', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      outputFolder: 'outputFolder',
      prefix: 'prefix',
      suffix: 'suffix'
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    north = new NorthFileWriter(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');
    await north.start();
  });

  it('should properly handle values', async () => {
    const values: Array<OIBusTimeValue> = [
      {
        timestamp: '2021-07-29T12:13:31.883Z',
        data: { value: '666', quality: 'good' },
        pointId: 'pointId'
      }
    ];
    await north.handleContent({ type: 'time-values', content: values });

    const expectedFileName = `${configuration.settings.prefix}${new Date().getTime()}${configuration.settings.suffix}.csv`;
    const expectedOutputFolder = path.resolve(configuration.settings.outputFolder);
    const expectedPath = path.join(expectedOutputFolder, expectedFileName);
    expect(fs.writeFile).toHaveBeenCalledWith(expectedPath, 'csv content');
  });

  it('should properly catch handle values error', async () => {
    const values: Array<OIBusTimeValue> = [
      {
        timestamp: '2021-07-29T12:13:31.883Z',
        data: { value: '666', quality: 'good' },
        pointId: 'pointId'
      }
    ];
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(() => {
      throw new Error('Error handling values');
    });
    await expect(north.handleValues(values)).rejects.toThrow('Error handling values');
  });

  it('should properly handle files', async () => {
    (fs.stat as jest.Mock).mockReturnValue({ size: 666 });
    const filePath = '/path/to/file/example-123456.file';
    const expectedFileName = `${configuration.settings.prefix}example${configuration.settings.suffix}.file`;
    const expectedOutputFolder = path.resolve(configuration.settings.outputFolder);
    await north.handleContent({ type: 'raw', filePath });
    expect(fs.copyFile).toHaveBeenCalledWith(filePath, path.join(expectedOutputFolder, expectedFileName));
  });

  it('should properly catch handle file error', async () => {
    (fs.stat as jest.Mock).mockReturnValue({ size: 666 });
    (fs.copyFile as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Error handling files');
    });
    const filePath = '/path/to/file/example-123456.file';
    await expect(north.handleFile(filePath)).rejects.toThrow('Error handling files');
  });
});

describe('NorthFileWriter without suffix or prefix', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      outputFolder: 'outputFolder',
      prefix: '',
      suffix: ''
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    north = new NorthFileWriter(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, 'baseFolder');
  });

  it('should properly handle values', async () => {
    const values: Array<OIBusTimeValue> = [
      {
        timestamp: '2021-07-29T12:13:31.883Z',
        data: { value: '666', quality: 'good' },
        pointId: 'pointId'
      }
    ];
    await north.handleValues(values);
    const expectedFileName = `${new Date().getTime()}.csv`;
    const expectedOutputFolder = path.resolve(configuration.settings.outputFolder);
    const expectedPath = path.join(expectedOutputFolder, expectedFileName);
    expect(fs.writeFile).toHaveBeenCalledWith(expectedPath, 'csv content');
  });

  it('should properly handle files', async () => {
    (fs.stat as jest.Mock).mockReturnValue({ size: 666 });
    const filePath = '/path/to/file/example-123456.file';
    const expectedOutputFolder = path.resolve(configuration.settings.outputFolder);
    await north.handleFile(filePath);
    expect(fs.copyFile).toHaveBeenCalledWith(filePath, path.join(expectedOutputFolder, 'example.file'));
  });

  it('should have access to output folder', async () => {
    (fs.access as jest.Mock).mockImplementation(() => Promise.resolve());

    await expect(north.testConnection()).resolves.not.toThrow();
  });

  it('should handle folder not existing', async () => {
    const outputFolder = path.resolve(configuration.settings.outputFolder);

    const errorMessage = 'Folder does not exist';
    (fs.access as jest.Mock).mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });

    await expect(north.testConnection()).rejects.toThrow(`Access error on "${outputFolder}": ${errorMessage}`);
  });

  it('should handle not having write access on folder', async () => {
    const outputFolder = path.resolve(configuration.settings.outputFolder);

    const errorMessage = 'No write access';
    (fs.access as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error(errorMessage);
      });

    await expect(north.testConnection()).rejects.toThrow(`Access error on "${outputFolder}": ${errorMessage}`);
  });
});
