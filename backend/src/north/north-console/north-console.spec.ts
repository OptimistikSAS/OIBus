import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ReadStream } from 'node:fs';
import testData from '../../tests/utils/test-data';
import {mockModule, reloadModule, buildNorthEntity} from '../../tests/utils/test-utils';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import type { NorthConsoleSettings } from '../../../shared/model/north-settings.model';
import type { OIBusSetpoint, OIBusTimeValue } from '../../../shared/model/engine.model';
import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type NorthConsoleClass from './north-console';

const nodeRequire = createRequire(import.meta.url);

describe('NorthConsole', () => {
  let NorthConsole: typeof NorthConsoleClass;
  let north: NorthConsoleClass;

  const logger = new PinoLogger();
  const cacheService = new CacheServiceMock();
  const oiBusTransformer = new OIBusTransformerMock();

  const transformerExports = {
    createTransformer: mock.fn(() => oiBusTransformer)
  };

  const utilsExports = {
    streamToString: mock.fn(async () => '[]'),
    checkAge: mock.fn(() => true),
    compress: mock.fn(async () => undefined),
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => []),
    groupItemsByGroup: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' }))
  };

  const timeValues: Array<OIBusTimeValue> = [
    {
      pointId: 'pointId',
      timestamp: testData.constants.dates.FAKE_NOW,
      data: { value: '666', quality: 'good' }
    }
  ];

  const setpoints: Array<OIBusSetpoint> = [{ reference: 'reference', value: '123456' }];

  let configuration: NorthConnectorEntity<NorthConsoleSettings>;

  before(() => {
    mockModule(nodeRequire, '../../service/transformer.service', transformerExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/cache/cache.service', {
      __esModule: true,
      default: function () {
        return cacheService;
      }
    });
    NorthConsole = reloadModule<{ default: typeof NorthConsoleClass }>(nodeRequire, './north-console').default;
  });

  beforeEach(() => {
    transformerExports.createTransformer.mock.resetCalls();
    utilsExports.streamToString.mock.resetCalls();
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();

    configuration = buildNorthEntity<NorthConsoleSettings>('console', {
      verbose: true
    });

    north = new NorthConsole(configuration, logger, cacheService);
  });

  afterEach(() => {
    mock.restoreAll();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should retrieve supported types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['any', 'time-values', 'setpoint']);
  });

  it('should properly handle values in verbose mode', async () => {
    utilsExports.streamToString.mock.mockImplementation(async () => JSON.stringify(timeValues));
    const readStream = {} as ReadStream;
    const consoleTableMock = mock.method(console, 'table', () => undefined);
    const stdoutWriteMock = mock.method(process.stdout, 'write', () => true);

    await north.handleContent(readStream, {
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values'
    });

    assert.strictEqual(utilsExports.streamToString.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.streamToString.mock.calls[0].arguments, [readStream]);
    assert.strictEqual(consoleTableMock.mock.calls.length, 1);
    assert.deepStrictEqual(consoleTableMock.mock.calls[0].arguments, [timeValues, ['pointId', 'timestamp', 'data']]);
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 0);
  });

  it('should properly handle setpoints in verbose mode', async () => {
    utilsExports.streamToString.mock.mockImplementation(async () => JSON.stringify(setpoints));
    const readStream = {} as ReadStream;
    const consoleTableMock = mock.method(console, 'table', () => undefined);
    const stdoutWriteMock = mock.method(process.stdout, 'write', () => true);

    await north.handleContent(readStream, {
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'setpoint'
    });

    assert.strictEqual(utilsExports.streamToString.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.streamToString.mock.calls[0].arguments, [readStream]);
    assert.strictEqual(consoleTableMock.mock.calls.length, 1);
    assert.deepStrictEqual(consoleTableMock.mock.calls[0].arguments, [setpoints, ['reference', 'value']]);
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 0);
  });

  it('should properly handle files in verbose mode', async () => {
    const readStream = {} as ReadStream;
    const consoleTableMock = mock.method(console, 'table', () => undefined);
    const stdoutWriteMock = mock.method(process.stdout, 'write', () => true);

    await north.handleContent(readStream, {
      contentFile: 'path/to/file/example.file',
      contentSize: 666,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    // Handle File does not read the stream in NorthConsole, it just logs metadata
    assert.strictEqual(utilsExports.streamToString.mock.calls.length, 0);
    assert.strictEqual(consoleTableMock.mock.calls.length, 1);
    assert.deepStrictEqual(consoleTableMock.mock.calls[0].arguments, [[{ filename: 'path/to/file/example.file', fileSize: 666 }]]);
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 0);
  });

  it('should properly handle values in non verbose mode', async () => {
    utilsExports.streamToString.mock.mockImplementation(async () => JSON.stringify(timeValues));
    const readStream = {} as ReadStream;
    north.connectorConfiguration = buildNorthEntity<NorthConsoleSettings>('console', {
      verbose: false
    });
    const consoleTableMock = mock.method(console, 'table', () => undefined);
    const stdoutWriteMock = mock.method(process.stdout, 'write', () => true);

    await north.handleContent(readStream, {
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values'
    });

    assert.strictEqual(utilsExports.streamToString.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.streamToString.mock.calls[0].arguments, [readStream]);
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 1);
    assert.deepStrictEqual(stdoutWriteMock.mock.calls[0].arguments, ['North Console sent 1 values.\r\n']);
    assert.strictEqual(consoleTableMock.mock.calls.length, 0);
  });

  it('should properly handle setpoints in non verbose mode', async () => {
    utilsExports.streamToString.mock.mockImplementation(async () => JSON.stringify(setpoints));
    const readStream = {} as ReadStream;
    north.connectorConfiguration = buildNorthEntity<NorthConsoleSettings>('console', {
      verbose: false
    });
    const consoleTableMock = mock.method(console, 'table', () => undefined);
    const stdoutWriteMock = mock.method(process.stdout, 'write', () => true);

    await north.handleContent(readStream, {
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'setpoint'
    });

    assert.strictEqual(utilsExports.streamToString.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.streamToString.mock.calls[0].arguments, [readStream]);
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 1);
    assert.deepStrictEqual(stdoutWriteMock.mock.calls[0].arguments, ['North Console sent 1 setpoint.\r\n']);
    assert.strictEqual(consoleTableMock.mock.calls.length, 0);
  });

  it('should properly handle file in non verbose mode', async () => {
    const readStream = {} as ReadStream;
    north.connectorConfiguration = buildNorthEntity<NorthConsoleSettings>('console', {
      verbose: false
    });
    const consoleTableMock = mock.method(console, 'table', () => undefined);
    const stdoutWriteMock = mock.method(process.stdout, 'write', () => true);

    await north.handleContent(readStream, {
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    assert.strictEqual(utilsExports.streamToString.mock.calls.length, 0);
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 1);
    assert.deepStrictEqual(stdoutWriteMock.mock.calls[0].arguments, ['North Console sent 1 file.\r\n']);
    assert.strictEqual(consoleTableMock.mock.calls.length, 0);
  });

  it('should be able to write test data to output', async () => {
    const consoleTableMock = mock.method(console, 'table', () => undefined);
    const stdoutWriteMock = mock.method(process.stdout, 'write', () => true);

    await north.testConnection();

    assert.strictEqual(stdoutWriteMock.mock.calls.length, 1);
    assert.deepStrictEqual(stdoutWriteMock.mock.calls[0].arguments, ['North Console output test.\r\n']);
    assert.strictEqual(consoleTableMock.mock.calls.length, 1);
    assert.deepStrictEqual(consoleTableMock.mock.calls[0].arguments, [[{ data: 'foo' }, { data: 'bar' }]]);
  });

  it('should not be able to write to output when stdout is not writable', async () => {
    mock.method(console, 'table', () => undefined);
    mock.method(process.stdout, 'write', () => true);

    // Temporarily override writable property
    const originalWritable = process.stdout.writable;
    Object.defineProperty(process.stdout, 'writable', { value: false, configurable: true });

    try {
      await assert.rejects(async () => {
        await north.testConnection();
      }, /The process\.stdout stream has been destroyed, errored or ended/);
    } finally {
      // Restore writable property
      Object.defineProperty(process.stdout, 'writable', { value: originalWritable, configurable: true });
    }
  });

  it('should not be able to write to output when stdout.write throws error', async () => {
    mock.method(console, 'table', () => undefined);
    const error = new Error('Cannot write to stdout');
    const stdoutWriteMock = mock.method(process.stdout, 'write', () => {
      throw error;
    });

    await assert.rejects(
      async () => {
        await north.testConnection();
      },
      new Error(`Node process is unable to write to STDOUT. ${error}`)
    );
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 1);
  });
});
