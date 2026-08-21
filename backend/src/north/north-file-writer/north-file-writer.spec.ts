import { describe, it, before, after, beforeEach, afterEach, mock } from 'node:test';
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
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
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

    north = new NorthFileWriter(configuration, cacheService);
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
    north = new NorthFileWriter(configuration, cacheService);

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
    const writeFileMock = mock.method(fs, 'writeFile', async () => undefined);
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);
    mock.method(fs, 'readdir', async () => ['file1.txt', 'file2.csv', 'file3.json'] as unknown as Array<string>);

    const testResult = await north.testConnection();

    const outputFolder = path.resolve(configuration.settings.outputFolder);
    assert.strictEqual(writeFileMock.mock.calls.length, 1);
    assert.strictEqual(unlinkMock.mock.calls.length, 1);
    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Output Folder', value: outputFolder },
        { key: 'Files', value: '3' }
      ]
    });
  });

  it('should handle folder not existing (Test Connection)', async () => {
    const outputFolder = path.resolve(configuration.settings.outputFolder);
    const errorMessage = 'ENOENT: no such file or directory';

    mock.method(fs, 'writeFile', async () => {
      throw new Error(errorMessage);
    });

    await assert.rejects(
      async () => {
        await north.testConnection();
      },
      new Error(`Write access error on "${outputFolder}": ${errorMessage}`)
    );
  });

  it('should handle not having write access on folder (Test Connection)', async () => {
    const outputFolder = path.resolve(configuration.settings.outputFolder);
    const errorMessage = 'EPERM: operation not permitted';

    mock.method(fs, 'writeFile', async () => {
      throw new Error(errorMessage);
    });

    await assert.rejects(
      async () => {
        await north.testConnection();
      },
      new Error(`Write access error on "${outputFolder}": ${errorMessage}`)
    );
  });

  describe('connect and disconnect (SMB)', () => {
    afterEach(async () => {
      await north.stop().catch(_e => undefined);
      logger.trace.mock.resetCalls();
    });

    describe('on non-windows', () => {
      // These tests assert the "not on Windows" branch specifically, so force the platform
      // instead of relying on the ambient OS running the test (which is win32 on Windows CI).
      const originalPlatform = process.platform;

      before(() => {
        Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      });

      after(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      });

      it('should log trace and skip SMB session authentication on non-Windows platforms', async () => {
        configuration.settings.username = 'user';
        configuration.settings.outputFolder = '\\\\server\\share\\out';
        north = new NorthFileWriter(configuration, cacheService);
        logger.trace.mock.resetCalls();
        type Private = Record<string, (...args: Array<unknown>) => Promise<void>>;
        await (north as unknown as Private)['mountNetworkShare']('\\\\server\\share\\out');
        assert.ok(logger.trace.mock.calls.some(c => (c.arguments[0] as string).includes('Skipping SMB session authentication')));
      });

      it('should log trace and skip SMB session removal on non-Windows platforms', async () => {
        configuration.settings.username = 'user';
        configuration.settings.outputFolder = '\\\\server\\share\\out';
        north = new NorthFileWriter(configuration, cacheService);
        logger.trace.mock.resetCalls();
        type Private = Record<string, (...args: Array<unknown>) => Promise<void>>;
        await (north as unknown as Private)['unmountNetworkShare']('\\\\server\\share\\out');
        assert.ok(logger.trace.mock.calls.some(c => (c.arguments[0] as string).includes('Skipping SMB session removal')));
      });
    });

    it('should skip SMB mount when username is empty', async () => {
      configuration.settings.username = null;
      configuration.settings.outputFolder = '\\\\server\\share\\out';
      await assert.doesNotReject(north.connect());
    });

    it('should skip SMB mount when outputFolder is not a UNC path', async () => {
      configuration.settings.username = 'user';
      configuration.settings.password = 'pass';
      configuration.settings.outputFolder = 'C:\\local\\output';
      await assert.doesNotReject(north.connect());
    });

    describe(
      'on windows',
      {
        // These tests simulate win32 and rely on `net` (as invoked here) being ABSENT so execFile
        // rejects with ENOENT — on an actual Windows runner `net` is a real command, so skip there
        // instead of shelling out to it for real (slow/non-deterministic, and can leak into other tests).
        skip: process.platform === 'win32' ? '`net` is a real command on Windows; nothing to simulate here' : false
      },
      () => {
        const originalPlatform = process.platform;
        type Private = Record<string, (...args: Array<unknown>) => Promise<void>>;

        before(() => {
          Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
        });

        after(() => {
          Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
        });

        // `net` does not exist on the (non-Windows) test runner, so execFile rejects with
        // ENOENT — which drives the catch branch (logger.error + rethrow) of mountNetworkShare.
        it('should throw and log an error when mountNetworkShare execFile fails', async () => {
          configuration.settings.username = 'user';
          configuration.settings.domain = 'DOMAIN';
          configuration.settings.outputFolder = '\\\\server\\share\\out';
          north = new NorthFileWriter(configuration, cacheService);

          await assert.rejects(async () => (north as unknown as Private)['mountNetworkShare']('\\\\server\\share\\out'));
          assert.ok(logger.error.mock.calls.some(c => (c.arguments[0] as string).includes('Failed to authenticate SMB session')));
        });

        it('should skip mountNetworkShare when username is empty on windows', async () => {
          configuration.settings.username = null;
          configuration.settings.outputFolder = '\\\\server\\share\\out';
          north = new NorthFileWriter(configuration, cacheService);

          await (north as unknown as Private)['mountNetworkShare']('\\\\server\\share\\out');
        });

        it('should skip mountNetworkShare when outputFolder is not a UNC path on windows', async () => {
          configuration.settings.username = 'user';
          configuration.settings.outputFolder = 'C:\\local\\output';
          north = new NorthFileWriter(configuration, cacheService);

          await (north as unknown as Private)['mountNetworkShare']('C:\\local\\output');
        });

        it('should skip unmountNetworkShare when username is empty on windows', async () => {
          configuration.settings.username = null;
          configuration.settings.outputFolder = '\\\\server\\share\\out';
          north = new NorthFileWriter(configuration, cacheService);

          await (north as unknown as Private)['unmountNetworkShare']('\\\\server\\share\\out');
        });

        it('should skip unmountNetworkShare when outputFolder is not a UNC path on windows', async () => {
          configuration.settings.username = 'user';
          configuration.settings.outputFolder = 'C:\\local\\output';
          north = new NorthFileWriter(configuration, cacheService);

          await (north as unknown as Private)['unmountNetworkShare']('C:\\local\\output');
        });

        // unmountNetworkShare swallows execFile failures (ENOENT here), so it resolves —
        // covering its try + catch branch.
        it('should silently ignore unmountNetworkShare execFile failures', async () => {
          configuration.settings.username = 'user';
          configuration.settings.outputFolder = '\\\\server\\share\\out';
          north = new NorthFileWriter(configuration, cacheService);

          await assert.doesNotReject(async () => (north as unknown as Private)['unmountNetworkShare']('\\\\server\\share\\out'));
        });

        // testConnection mounts the share first; on the test runner `net` is missing so the
        // mount rejects and testConnection propagates the failure.
        it('should propagate SMB mount failure from testConnection', async () => {
          configuration.settings.username = 'user';
          configuration.settings.outputFolder = '\\\\server\\share\\out';
          north = new NorthFileWriter(configuration, cacheService);

          await assert.rejects(async () => north.testConnection());
        });

        // Windows refuses to add a session for a server that already has one under a different
        // identity (system error 1219). Clearing any existing session first, unconditionally,
        // before adding the new one makes mounting self-healing regardless of what left a
        // previous session dangling (unclean shutdown, a prior failed attempt, a leftover test).
        it('should clear any existing session before authenticating a new one', async () => {
          configuration.settings.username = 'user';
          configuration.settings.outputFolder = '\\\\server\\share\\out';
          north = new NorthFileWriter(configuration, cacheService);
          const deleteSpy = mock.method(north as unknown as Private, 'deleteNetworkSession', async () => undefined);

          // `net` is missing on the test runner, so the add still rejects with ENOENT — that's
          // enough to confirm deleteNetworkSession always runs first, before the add is attempted.
          await assert.rejects(async () => (north as unknown as Private)['mountNetworkShare']('\\\\server\\share\\out'));
          assert.strictEqual(deleteSpy.mock.calls.length, 1);
          assert.deepStrictEqual(deleteSpy.mock.calls[0].arguments, ['\\\\server\\share']);
        });

        // testConnection() is a one-off diagnostic call, not paired with disconnect() — without
        // tearing its session down itself, it would stay open (and could conflict with the next
        // mount attempt, see the 1219 error above) until something else happened to clean it up.
        it('should tear down the SMB session after a successful testConnection', async () => {
          configuration.settings.username = 'user';
          configuration.settings.outputFolder = '\\\\server\\share\\out';
          north = new NorthFileWriter(configuration, cacheService);
          mock.method(north as unknown as Private, 'mountNetworkShare', async () => undefined);
          const unmountSpy = mock.method(north as unknown as Private, 'unmountNetworkShare', async () => undefined);
          mock.method(fs, 'writeFile', async () => undefined);
          mock.method(fs, 'unlink', async () => undefined);
          mock.method(fs, 'readdir', async () => [] as unknown as Array<string>);

          await north.testConnection();

          assert.strictEqual(unmountSpy.mock.calls.length, 1);
        });

        it('should tear down the SMB session after a failed testConnection', async () => {
          configuration.settings.username = 'user';
          configuration.settings.outputFolder = '\\\\server\\share\\out';
          north = new NorthFileWriter(configuration, cacheService);
          mock.method(north as unknown as Private, 'mountNetworkShare', async () => undefined);
          const unmountSpy = mock.method(north as unknown as Private, 'unmountNetworkShare', async () => undefined);
          mock.method(fs, 'writeFile', async () => {
            throw new Error('EACCES');
          });

          await assert.rejects(async () => north.testConnection());

          assert.strictEqual(unmountSpy.mock.calls.length, 1);
        });
      }
    );
  });
});
