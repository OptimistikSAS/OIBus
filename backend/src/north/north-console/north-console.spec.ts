import { ReadStream } from 'node:fs';
import NorthConsole from './north-console';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthConsoleSettings } from '../../../shared/model/north-settings.model';
import { OIBusSetpoint, OIBusTimeValue } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import testData from '../../tests/utils/test-data';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { streamToString } from '../../service/utils';
import { buildNorthConfiguration } from '../../tests/utils/test-utils';

// Mock dependencies
jest.mock('../../service/transformer.service');
jest.mock('../../service/utils');

// Spy on console table and process.stdout
jest.spyOn(global.console, 'table').mockImplementation(() => ({}));
jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

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

// Test Data
const timeValues: Array<OIBusTimeValue> = [
  {
    pointId: 'pointId',
    timestamp: testData.constants.dates.FAKE_NOW,
    data: { value: '666', quality: 'good' }
  }
];

const setpoints: Array<OIBusSetpoint> = [{ reference: 'reference', value: '123456' }];

let configuration: NorthConnectorEntity<NorthConsoleSettings>;
let north: NorthConsole;

describe('NorthConsole', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    configuration = buildNorthConfiguration<NorthConsoleSettings>('console', {
      verbose: true
    });
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);

    north = new NorthConsole(configuration, logger, cacheService);
  });

  afterEach(() => {
    jest.useRealTimers();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should retrieve supported types', () => {
    expect(north.supportedTypes()).toEqual(['any', 'time-values', 'setpoint']);
  });

  it('should properly handle values in verbose mode', async () => {
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(timeValues));
    const readStream = {} as ReadStream;

    await north.handleContent(readStream, {
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values'
    });

    expect(streamToString).toHaveBeenCalledWith(readStream);
    expect(console.table).toHaveBeenCalledWith(timeValues, ['pointId', 'timestamp', 'data']);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it('should properly handle setpoints in verbose mode', async () => {
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(setpoints));
    const readStream = {} as ReadStream;

    await north.handleContent(readStream, {
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'setpoint'
    });

    expect(streamToString).toHaveBeenCalledWith(readStream);
    expect(console.table).toHaveBeenCalledWith(setpoints, ['reference', 'value']);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it('should properly handle files in verbose mode', async () => {
    const readStream = {} as ReadStream;

    await north.handleContent(readStream, {
      contentFile: 'path/to/file/example.file',
      contentSize: 666,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    // Handle File does not read the stream in NorthConsole, it just logs metadata
    expect(streamToString).not.toHaveBeenCalled();
    expect(console.table).toHaveBeenCalledWith([{ filename: 'path/to/file/example.file', fileSize: 666 }]);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it('should properly handle values in non verbose mode', async () => {
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(timeValues));
    const readStream = {} as ReadStream;
    north.connectorConfiguration = buildNorthConfiguration<NorthConsoleSettings>('console', {
      verbose: false
    });

    await north.handleContent(readStream, {
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values'
    });

    expect(streamToString).toHaveBeenCalledWith(readStream);
    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 values.\r\n');
    expect(console.table).not.toHaveBeenCalled();
  });

  it('should properly handle setpoints in non verbose mode', async () => {
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(setpoints));
    const readStream = {} as ReadStream;
    north.connectorConfiguration = buildNorthConfiguration<NorthConsoleSettings>('console', {
      verbose: false
    });

    await north.handleContent(readStream, {
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'setpoint'
    });

    expect(streamToString).toHaveBeenCalledWith(readStream);
    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 setpoint.\r\n');
    expect(console.table).not.toHaveBeenCalled();
  });

  it('should properly handle file in non verbose mode', async () => {
    const readStream = {} as ReadStream;
    north.connectorConfiguration = buildNorthConfiguration<NorthConsoleSettings>('console', {
      verbose: false
    });

    await north.handleContent(readStream, {
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    expect(streamToString).not.toHaveBeenCalled();
    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 file.\r\n');
    expect(console.table).not.toHaveBeenCalled();
  });

  it('should be able to write test data to output', async () => {
    await expect(north.testConnection()).resolves.not.toThrow();

    expect(process.stdout.write).toHaveBeenCalledWith('North Console output test.\r\n');
    expect(console.table).toHaveBeenCalledWith([{ data: 'foo' }, { data: 'bar' }]);
  });

  it('should not be able to write to output when stdout is not writable', async () => {
    // Temporarily override writable property
    const originalWritable = process.stdout.writable;
    Object.defineProperty(process.stdout, 'writable', { value: false, configurable: true });

    try {
      const error = new Error('The process.stdout stream has been destroyed, errored or ended');
      await expect(north.testConnection()).rejects.toThrow(error);

      expect(process.stdout.write).not.toHaveBeenCalled();
      expect(console.table).not.toHaveBeenCalled();
    } finally {
      // Restore writable property
      Object.defineProperty(process.stdout, 'writable', { value: originalWritable, configurable: true });
    }
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
});
