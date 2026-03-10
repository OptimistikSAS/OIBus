import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream, ReadStream } from 'node:fs';
import NorthFileWriter from './north-file-writer';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthFileWriterSettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { DateTime } from 'luxon';
import { buildNorthConfiguration } from '../../tests/utils/test-utils';

// Mock Node modules
jest.mock('node:fs/promises');
jest.mock('node:stream/promises');
jest.mock('node:fs', () => {
  const originalModule = jest.requireActual('node:fs');
  return {
    ...originalModule,
    createWriteStream: jest.fn(),
    ReadStream: jest.fn()
  };
});
jest.mock('../../service/transformer.service');

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

let configuration: NorthConnectorEntity<NorthFileWriterSettings>;
let north: NorthFileWriter;
const mockWriteStream = { write: jest.fn(), end: jest.fn() };

describe('NorthFileWriter', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    configuration = buildNorthConfiguration<NorthFileWriterSettings>('file-writer', {
      outputFolder: 'outputFolder',
      prefix: 'prefix_',
      suffix: '_suffix'
    });
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);
    (pipeline as jest.Mock).mockResolvedValue(undefined);

    north = new NorthFileWriter(configuration, logger, cacheService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should retrieve supported types', () => {
    expect(north.supportedTypes()).toEqual(['any', 'setpoint', 'time-values']);
  });

  it('should properly handle files with prefix and suffix', async () => {
    const readStream = {} as ReadStream;
    const metadata = {
      contentFile: 'file-123456789.txt',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    };

    const expectedFilename = `prefix_file-123456789_suffix.txt`;
    const expectedOutputFolder = path.resolve(configuration.settings.outputFolder);
    const expectedPath = path.join(expectedOutputFolder, expectedFilename);

    await north.handleContent(readStream, metadata);

    expect(createWriteStream).toHaveBeenCalledWith(expectedPath);
    expect(pipeline).toHaveBeenCalledWith(readStream, mockWriteStream);
  });

  it('should properly handle files with dynamic replacements in prefix/suffix', async () => {
    configuration.settings.prefix = 'pre_@ConnectorName_';
    configuration.settings.suffix = '_@CurrentDate_suf';
    north = new NorthFileWriter(configuration, logger, cacheService);

    const readStream = {} as ReadStream;
    const metadata = {
      contentFile: 'data.csv',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    };

    const nowDate = DateTime.fromJSDate(new Date(testData.constants.dates.FAKE_NOW)).toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS');

    // Simplified verification based on exact logic reconstruction
    const p = `pre_${configuration.name}_`;
    const s = `_${nowDate}_suf`;
    const finalName = `${p}data${s}.csv`;
    const expectedPath = path.join(path.resolve(configuration.settings.outputFolder), finalName);

    await north.handleContent(readStream, metadata);

    expect(createWriteStream).toHaveBeenCalledWith(expectedPath);
    expect(pipeline).toHaveBeenCalledWith(readStream, mockWriteStream);
  });

  it('should properly catch handle file error (pipeline failure)', async () => {
    const error = new Error('Pipeline failed');
    (pipeline as jest.Mock).mockRejectedValue(error);
    const readStream = {} as ReadStream;

    await expect(
      north.handleContent(readStream, {
        contentFile: 'example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any'
      })
    ).rejects.toThrow('Pipeline failed');
  });

  it('should properly handle files (direct naming)', async () => {
    const readStream = {} as ReadStream;
    const metadata = {
      contentFile: 'example-123.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    };

    north.connectorConfiguration = buildNorthConfiguration<NorthFileWriterSettings>('file-writer', {
      outputFolder: 'outputFolder',
      prefix: '',
      suffix: ''
    });

    const expectedOutputFolder = path.resolve(configuration.settings.outputFolder);
    // Logic: '' + 'example-123' + '' + '.file'
    const expectedPath = path.join(expectedOutputFolder, 'example-123.file');

    await north.handleContent(readStream, metadata);

    expect(createWriteStream).toHaveBeenCalledWith(expectedPath);
    expect(pipeline).toHaveBeenCalledWith(readStream, mockWriteStream);
  });

  it('should have access to output folder (Test Connection)', async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue(['file1.txt', 'file2.csv', 'file3.json']);

    const testResult = await north.testConnection();

    const outputFolder = path.resolve(configuration.settings.outputFolder);
    expect(fs.access).toHaveBeenCalledWith(outputFolder, expect.anything());
    expect(testResult).toEqual({
      items: [
        { key: 'Output Folder', value: outputFolder },
        { key: 'Files', value: '3' }
      ]
    });
  });

  it('should handle folder not existing (Test Connection)', async () => {
    const outputFolder = path.resolve(configuration.settings.outputFolder);

    const errorMessage = 'Folder does not exist';
    (fs.access as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    await expect(north.testConnection()).rejects.toThrow(`Access error on "${outputFolder}": ${errorMessage}`);
  });

  it('should handle not having write access on folder (Test Connection)', async () => {
    const outputFolder = path.resolve(configuration.settings.outputFolder);

    const errorMessage = 'No write access';
    (fs.access as jest.Mock)
      .mockResolvedValueOnce(undefined) // F_OK success
      .mockRejectedValueOnce(new Error(errorMessage)); // W_OK fail

    await expect(north.testConnection()).rejects.toThrow(`Access error on "${outputFolder}": ${errorMessage}`);
  });
});
