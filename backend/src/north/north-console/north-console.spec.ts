import fs from 'node:fs/promises';

import NorthConsole from './north-console';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthConsoleSettings } from '../../../shared/model/north-settings.model';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import testData from '../../tests/utils/test-data';
import { mockBaseFolders } from '../../tests/utils/test-utils';
import CacheService from '../../service/cache/cache.service';
import TransformerService, { createTransformer } from '../../service/transformer.service';
import TransformerServiceMock from '../../tests/__mocks__/service/transformer-service.mock';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';

jest.mock('node:fs/promises');
jest.mock('../../service/transformer.service');
// Spy on console table and info
jest.spyOn(global.console, 'table').mockImplementation(() => ({}));
jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

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

const timeValues: Array<OIBusTimeValue> = [
  {
    pointId: 'pointId',
    timestamp: testData.constants.dates.FAKE_NOW,
    data: { value: '666', quality: 'good' }
  }
];

let configuration: NorthConnectorEntity<NorthConsoleSettings>;
let north: NorthConsole;

describe('NorthConsole with verbose mode', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      verbose: true
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);

    north = new NorthConsole(
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

  it('should properly handle values in verbose mode', async () => {
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
    expect(fs.readFile).toHaveBeenCalledWith('/path/to/file/example-123.json', { encoding: 'utf-8' });

    expect(console.table).toHaveBeenCalledWith(timeValues, ['pointId', 'timestamp', 'data']);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it('should properly handle values in verbose mode', async () => {
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any',
      source: 'south',
      options: {}
    });
    expect(fs.stat).toHaveBeenCalledWith('path/to/file/example.file');
    expect(console.table).toHaveBeenCalledWith([{ filePath: 'path/to/file/example.file', fileSize: 666 }]);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });
});

describe('NorthConsole without verbose mode', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      verbose: false
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);

    north = new NorthConsole(
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

  it('should properly handle values in non verbose mode', async () => {
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
    expect(fs.readFile).toHaveBeenCalledWith('/path/to/file/example-123.json', { encoding: 'utf-8' });

    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 values.\r\n');
    expect(console.table).not.toHaveBeenCalled();
  });

  it('should properly handle file in non verbose mode', async () => {
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any',
      source: 'south',
      options: {}
    });

    expect(fs.stat).not.toHaveBeenCalled();
    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 file.\r\n');
    expect(console.table).not.toHaveBeenCalled();
  });

  it('should be able to write test data to output', async () => {
    await expect(north.testConnection()).resolves.not.toThrow();

    expect(process.stdout.write).toHaveBeenCalledWith('North Console output test.\r\n');
    expect(console.table).toHaveBeenCalledWith([{ data: 'foo' }, { data: 'bar' }]);
  });

  it('should not be able to write to output when stdout is not writable', async () => {
    // Override the process.stdout.writable property
    Object.defineProperty(process.stdout, 'writable', { value: false, configurable: true });

    const error = new Error('The process.stdout stream has been destroyed, errored or ended');
    await expect(north.testConnection()).rejects.toThrow(error);

    expect(process.stdout.write).not.toHaveBeenCalled();
    expect(console.table).not.toHaveBeenCalled();

    Object.defineProperty(process.stdout, 'writable', { value: true, configurable: true });
  });

  it('should not be able to write to output when stdout.write throws error', async () => {
    const error = new Error('Cannot write to stdout');
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error(`Node process is unable to write to STDOUT. ${error}`));
    expect(process.stdout.write).toHaveBeenCalled();
    expect(console.table).not.toHaveBeenCalled();
  });

  it('should ignore data if bad content type', async () => {
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'bad-type',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(`Unsupported data type: bad-type (file path/to/file/example-123456789.file)`);
  });
});
