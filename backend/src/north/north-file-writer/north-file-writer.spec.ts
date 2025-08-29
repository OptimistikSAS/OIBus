import fs from 'node:fs/promises';
import path from 'node:path';

import NorthFileWriter from './north-file-writer';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import csv from 'papaparse';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthFileWriterSettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import { mockBaseFolders } from '../../tests/utils/test-utils';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { getFilenameWithoutRandomId } from '../../service/utils';

jest.mock('node:fs/promises');

const logger: pino.Logger = new PinoLogger();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const cacheService: CacheService = new CacheServiceMock();
const oiBusTransformer: OIBusTransformer = new OIBusTransformerMock() as unknown as OIBusTransformer;

jest.mock(
  '../../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
    }
);
jest.mock('../../service/utils');
jest.mock('../../service/transformer.service');
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
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (getFilenameWithoutRandomId as jest.Mock).mockReturnValue('example.file');

    north = new NorthFileWriter(
      configuration,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
    await north.start();
  });

  it('should properly handle files', async () => {
    (fs.stat as jest.Mock).mockReturnValue({ size: 666 });
    const expectedFileName = `${configuration.settings.prefix}example${configuration.settings.suffix}.file`;
    const expectedOutputFolder = path.resolve(configuration.settings.outputFolder);
    await north.handleContent({
      contentFile: 'path/to/file/example-123456789.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any',
      source: 'south',
      options: {}
    });
    expect(fs.copyFile).toHaveBeenCalledWith('path/to/file/example-123456789.file', path.join(expectedOutputFolder, expectedFileName));
  });

  it('should properly catch handle file error', async () => {
    (fs.stat as jest.Mock).mockReturnValue({ size: 666 });
    (fs.copyFile as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Error handling files');
    });
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow('Error handling files');
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
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (getFilenameWithoutRandomId as jest.Mock).mockReturnValue('example.file');

    north = new NorthFileWriter(
      configuration,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
  });

  it('should properly handle files', async () => {
    (fs.stat as jest.Mock).mockReturnValue({ size: 666 });
    const expectedOutputFolder = path.resolve(configuration.settings.outputFolder);
    await north.handleContent({
      contentFile: 'path/to/file/example-123456789.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any',
      source: 'south',
      options: {}
    });
    expect(fs.copyFile).toHaveBeenCalledWith('path/to/file/example-123456789.file', path.join(expectedOutputFolder, 'example.file'));
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

  it('should ignore data if bad content type', async () => {
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'bad',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(`Unsupported data type: bad (file path/to/file/example-123456789.file)`);
  });
});
