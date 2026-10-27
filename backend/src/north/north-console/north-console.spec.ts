import assert from 'node:assert/strict';
import { ReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { OIBusPointRecord, OIBusRecord } from '../../../shared/model/common/content.model';
import type { NorthConsoleSettings } from '../../../shared/model/connector/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/domain/engine.model';

import type * as Utils from '../../service/utils';
import { createCacheServiceMock } from '../../tests/__mocks__/service/cache/cache-service.mock';
import testData from '../../tests/utils/test-data';
import { buildNorthEntity, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type NorthConsoleClass from './north-console';

const nodeRequire = createRequire(import.meta.url);

const timeValues: Array<OIBusPointRecord> = [
  {
    pointId: 'pointId',
    timestamp: testData.constants.dates.FAKE_NOW,
    value: '666',
    quality: 'good'
  }
];
// The setpoints sent by OIAnalytics
const setpoints: Array<OIBusRecord> = [{ reference: 'reference', value: '123456' }];
const readStream = {} as ReadStream;

const metadata = (contentType: string, contentFile = '/path/to/file/example-123.json', contentSize = 1234): CacheMetadata => ({
  contentFile,
  contentSize,
  numberOfElement: 1,
  createdAt: '2020-02-02T02:02:02.222Z',
  contentType
});

describe('NorthConsole', () => {
  let NorthConsole: typeof NorthConsoleClass;
  let north: NorthConsoleClass;
  let consoleTableMock: Mock<typeof console.table>;
  let stdoutWriteMock: Mock<typeof process.stdout.write>;

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({ streamToString: mock.fn(async (_stream: ReadStream) => '[]') });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    // No transformation here: don't pay for loading every transformer
    mockModule(nodeRequire, '../../service/transformer.service', {});
    NorthConsole = reloadModule<{ default: typeof NorthConsoleClass }>(nodeRequire, './north-console').default;
  });

  beforeEach(() => {
    Object.assign(utilsExports, createUtilsMocks());
    consoleTableMock = mock.method(console, 'table', () => undefined);
    stdoutWriteMock = mock.method(process.stdout, 'write', () => true);

    north = new NorthConsole(buildNorthEntity<NorthConsoleSettings>('console', { verbose: true }), createCacheServiceMock());
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should retrieve supported types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['file', 'record-list']);
  });

  it('should properly handle values in verbose mode', async () => {
    utilsExports.streamToString.mock.mockImplementation(async () => JSON.stringify(timeValues));

    await north.handleContent(readStream, metadata('record-list'));

    assert.strictEqual(utilsExports.streamToString.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.streamToString.mock.calls[0].arguments, [readStream]);
    assert.strictEqual(consoleTableMock.mock.calls.length, 1);
    assert.deepStrictEqual(consoleTableMock.mock.calls[0].arguments, [timeValues]);
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 0);
  });

  it('should properly handle setpoints, as records, in verbose mode', async () => {
    utilsExports.streamToString.mock.mockImplementation(async () => JSON.stringify(setpoints));

    await north.handleContent(readStream, metadata('record-list'));

    assert.strictEqual(utilsExports.streamToString.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.streamToString.mock.calls[0].arguments, [readStream]);
    assert.strictEqual(consoleTableMock.mock.calls.length, 1);
    assert.deepStrictEqual(consoleTableMock.mock.calls[0].arguments, [setpoints]);
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 0);
  });

  it('should properly handle files in verbose mode', async () => {
    await north.handleContent(readStream, metadata('file', 'path/to/file/example.file', 666));

    // Handle File does not read the stream in NorthConsole, it just logs metadata
    assert.strictEqual(utilsExports.streamToString.mock.calls.length, 0);
    assert.strictEqual(consoleTableMock.mock.calls.length, 1);
    assert.deepStrictEqual(consoleTableMock.mock.calls[0].arguments, [[{ filename: 'path/to/file/example.file', fileSize: 666 }]]);
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 0);
  });

  it('should properly handle values in non verbose mode', async () => {
    utilsExports.streamToString.mock.mockImplementation(async () => JSON.stringify(timeValues));
    north.connectorConfiguration = buildNorthEntity<NorthConsoleSettings>('console', { verbose: false });

    await north.handleContent(readStream, metadata('record-list'));

    assert.strictEqual(utilsExports.streamToString.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.streamToString.mock.calls[0].arguments, [readStream]);
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 1);
    assert.deepStrictEqual(stdoutWriteMock.mock.calls[0].arguments, ['North Console sent 1 values.\r\n']);
    assert.strictEqual(consoleTableMock.mock.calls.length, 0);
  });

  it('should properly handle file in non verbose mode', async () => {
    north.connectorConfiguration = buildNorthEntity<NorthConsoleSettings>('console', { verbose: false });

    await north.handleContent(readStream, metadata('file', 'path/to/file/example.file'));

    assert.strictEqual(utilsExports.streamToString.mock.calls.length, 0);
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 1);
    assert.deepStrictEqual(stdoutWriteMock.mock.calls[0].arguments, ['North Console sent 1 file.\r\n']);
    assert.strictEqual(consoleTableMock.mock.calls.length, 0);
  });

  it('should be able to write test data to output', async () => {
    await north.testConnection();

    assert.strictEqual(stdoutWriteMock.mock.calls.length, 1);
    assert.deepStrictEqual(stdoutWriteMock.mock.calls[0].arguments, ['North Console output test.\r\n']);
    assert.strictEqual(consoleTableMock.mock.calls.length, 1);
    assert.deepStrictEqual(consoleTableMock.mock.calls[0].arguments, [[{ data: 'foo' }, { data: 'bar' }]]);
  });

  it('should not be able to write to output when stdout is not writable', async () => {
    // Temporarily override writable property
    const originalWritable = process.stdout.writable;
    Object.defineProperty(process.stdout, 'writable', { value: false, configurable: true });

    try {
      await assert.rejects(north.testConnection(), /The process\.stdout stream has been destroyed, errored or ended/);
    } finally {
      Object.defineProperty(process.stdout, 'writable', { value: originalWritable, configurable: true });
    }
  });

  it('should not be able to write to output when stdout.write throws error', async () => {
    const error = new Error('Cannot write to stdout');
    stdoutWriteMock.mock.mockImplementation(() => {
      throw error;
    });

    await assert.rejects(north.testConnection(), new Error(`Node process is unable to write to STDOUT. ${error}`));
    assert.strictEqual(stdoutWriteMock.mock.calls.length, 1);
  });
});
