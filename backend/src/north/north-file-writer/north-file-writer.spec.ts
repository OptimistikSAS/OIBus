import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, buildNorthEntity } from '../../tests/utils/test-utils';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type { NorthFileWriterSettings } from '../../../shared/model/north-settings.model';
import type { ReadStream } from 'node:fs';
import { DateTime } from 'luxon';
import type NorthFileWriterClass from './north-file-writer';

const nodeRequire = createRequire(import.meta.url);

// Load these via CJS require so we can use mock.method on the shared module objects
const streamPromises = nodeRequire('node:stream/promises') as { pipeline: (...args: Array<unknown>) => Promise<void> };
const nodeFs = nodeRequire('node:fs') as { createWriteStream: (...args: Array<unknown>) => unknown };

describe('NorthFileWriter', () => {
  let NorthFileWriter: typeof NorthFileWriterClass;
  let north: NorthFileWriterClass;

  const logger = new PinoLogger();
  const cacheService = new CacheServiceMock();
  const oiBusTransformer = new OIBusTransformerMock();

  const mockWriteStream = { write: mock.fn(), end: mock.fn() };

  const transformerExports = {
    createTransformer: mock.fn(() => oiBusTransformer)
  };

  before(() => {
    mockModule(nodeRequire, '../../service/transformer.service', transformerExports);
    mockModule(nodeRequire, '../../service/cache/cache.service', {
      __esModule: true,
      default: function () {
        return cacheService;
      }
    });
    NorthFileWriter = reloadModule<{ default: typeof NorthFileWriterClass }>(nodeRequire, './north-file-writer').default;
  });

  let configuration: NorthConnectorEntity<NorthFileWriterSettings>;

  beforeEach(() => {
    transformerExports.createTransformer.mock.resetCalls();
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();

    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    configuration = buildNorthEntity<NorthFileWriterSettings>('file-writer', {
      outputFolder: 'outputFolder',
      prefix: 'prefix_',
      suffix: '_suffix'
    });

    north = new NorthFileWriter(configuration, logger, cacheService);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should retrieve supported types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['any', 'setpoint', 'time-values']);
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

    const createWriteStreamMock = mock.method(nodeFs, 'createWriteStream', () => mockWriteStream);
    const pipelineMock = mock.method(streamPromises, 'pipeline', async () => undefined);

    await north.handleContent(readStream, metadata);

    assert.strictEqual(createWriteStreamMock.mock.calls.length, 1);
    assert.deepStrictEqual(createWriteStreamMock.mock.calls[0].arguments, [expectedPath]);
    assert.strictEqual(pipelineMock.mock.calls.length, 1);
    assert.deepStrictEqual(pipelineMock.mock.calls[0].arguments, [readStream, mockWriteStream]);
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

    const nowDate = DateTime.fromMillis(new Date(testData.constants.dates.FAKE_NOW).getTime()).toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS');

    const p = `pre_${configuration.name}_`;
    const s = `_${nowDate}_suf`;
    const finalName = `${p}data${s}.csv`;
    const expectedPath = path.join(path.resolve(configuration.settings.outputFolder), finalName);

    const createWriteStreamMock = mock.method(nodeFs, 'createWriteStream', () => mockWriteStream);
    const pipelineMock = mock.method(streamPromises, 'pipeline', async () => undefined);

    await north.handleContent(readStream, metadata);

    assert.strictEqual(createWriteStreamMock.mock.calls.length, 1);
    assert.deepStrictEqual(createWriteStreamMock.mock.calls[0].arguments, [expectedPath]);
    assert.strictEqual(pipelineMock.mock.calls.length, 1);
    assert.deepStrictEqual(pipelineMock.mock.calls[0].arguments, [readStream, mockWriteStream]);
  });

  it('should properly catch handle file error (pipeline failure)', async () => {
    const error = new Error('Pipeline failed');
    mock.method(nodeFs, 'createWriteStream', () => mockWriteStream);
    mock.method(streamPromises, 'pipeline', async () => {
      throw error;
    });
    const readStream = {} as ReadStream;

    await assert.rejects(async () => {
      await north.handleContent(readStream, {
        contentFile: 'example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any'
      });
    }, /Pipeline failed/);
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

    north.connectorConfiguration = buildNorthEntity<NorthFileWriterSettings>('file-writer', {
      outputFolder: 'outputFolder',
      prefix: '',
      suffix: ''
    });

    const expectedOutputFolder = path.resolve(configuration.settings.outputFolder);
    const expectedPath = path.join(expectedOutputFolder, 'example-123.file');

    const createWriteStreamMock = mock.method(nodeFs, 'createWriteStream', () => mockWriteStream);
    const pipelineMock = mock.method(streamPromises, 'pipeline', async () => undefined);

    await north.handleContent(readStream, metadata);

    assert.strictEqual(createWriteStreamMock.mock.calls.length, 1);
    assert.deepStrictEqual(createWriteStreamMock.mock.calls[0].arguments, [expectedPath]);
    assert.strictEqual(pipelineMock.mock.calls.length, 1);
    assert.deepStrictEqual(pipelineMock.mock.calls[0].arguments, [readStream, mockWriteStream]);
  });

  it('should have access to output folder (Test Connection)', async () => {
    const accessMock = mock.method(fs, 'access', async () => undefined);
    mock.method(fs, 'readdir', async () => ['file1.txt', 'file2.csv', 'file3.json'] as unknown as Array<string>);

    const testResult = await north.testConnection();

    const outputFolder = path.resolve(configuration.settings.outputFolder);
    assert.strictEqual(accessMock.mock.calls.length, 2);
    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Output Folder', value: outputFolder },
        { key: 'Files', value: '3' }
      ]
    });
  });

  it('should handle folder not existing (Test Connection)', async () => {
    const outputFolder = path.resolve(configuration.settings.outputFolder);
    const errorMessage = 'Folder does not exist';

    mock.method(fs, 'access', async () => {
      throw new Error(errorMessage);
    });

    await assert.rejects(
      async () => {
        await north.testConnection();
      },
      new Error(`Access error on "${outputFolder}": ${errorMessage}`)
    );
  });

  it('should handle not having write access on folder (Test Connection)', async () => {
    const outputFolder = path.resolve(configuration.settings.outputFolder);
    const errorMessage = 'No write access';
    let callCount = 0;

    mock.method(fs, 'access', async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error(errorMessage);
      }
    });

    await assert.rejects(
      async () => {
        await north.testConnection();
      },
      new Error(`Access error on "${outputFolder}": ${errorMessage}`)
    );
  });
});
