import assert from 'node:assert/strict';
import nodeFs, { type ReadStream, type WriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import streamPromises from 'node:stream/promises';
import { after, afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import { DateTime } from 'luxon';

import type { NorthFileWriterSettings } from '../../../shared/model/connector/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/domain/engine.model';

import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type CacheService from '../../service/cache/cache.service';
import { createCacheServiceMock } from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { buildNorthEntity, createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type NorthFileWriterClass from './north-file-writer';

const nodeRequire = createRequire(import.meta.url);

const readStream = {} as ReadStream;
const metadata = (contentFile: string, contentSize = 1234): CacheMetadata => ({
  contentFile,
  contentSize,
  numberOfElement: 1,
  createdAt: '2020-02-02T02:02:02.222Z',
  contentType: 'file'
});
const UNC_FOLDER = '\\\\server\\share\\out';

describe('NorthFileWriter', () => {
  let NorthFileWriter: typeof NorthFileWriterClass;
  let north: NorthFileWriterClass;

  let logger: PinoLogger;
  let cacheService: Mocked<CacheService>;
  let configuration: NorthConnectorEntity<NorthFileWriterSettings>;
  let writeStream: WriteStream;
  let createWriteStreamMock: Mock<typeof nodeFs.createWriteStream>;
  let pipelineMock: Mock<typeof streamPromises.pipeline>;

  before(() => {
    mockModule(nodeRequire, '../../service/encryption.service', { encryptionService: { decryptText: async () => 'decrypted-password' } });
    // No transformation here: don't pay for loading every transformer
    mockModule(nodeRequire, '../../service/transformer.service', {});
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    NorthFileWriter = reloadModule<{ default: typeof NorthFileWriterClass }>(nodeRequire, './north-file-writer').default;
  });

  /** Creates the connector with the given settings on top of the default ones */
  const createNorth = (settings: Partial<NorthFileWriterSettings> = {}) => {
    Object.assign(configuration.settings, settings);
    north = new NorthFileWriter(configuration, cacheService);
  };

  beforeEach(() => {
    logger = new PinoLogger();
    cacheService = createCacheServiceMock();
    writeStream = createMock<WriteStream>();
    createWriteStreamMock = mock.method(nodeFs, 'createWriteStream', () => writeStream);
    pipelineMock = mock.method(streamPromises, 'pipeline', async () => undefined);
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    configuration = buildNorthEntity<NorthFileWriterSettings>('file-writer', {
      outputFolder: 'outputFolder',
      prefix: 'prefix_',
      suffix: '_suffix'
    });
    createNorth();
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should retrieve supported types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['file', 'setpoint', 'record-list']);
  });

  it('should properly handle files with prefix and suffix', async () => {
    await north.handleContent(readStream, metadata('file-123456789.txt'));

    const expectedPath = path.join(path.resolve(configuration.settings.outputFolder), 'prefix_file-123456789_suffix.txt');
    assert.strictEqual(createWriteStreamMock.mock.calls.length, 1);
    assert.deepStrictEqual(createWriteStreamMock.mock.calls[0].arguments, [expectedPath]);
    assert.strictEqual(pipelineMock.mock.calls.length, 1);
    assert.deepStrictEqual(pipelineMock.mock.calls[0].arguments, [readStream, writeStream]);
  });

  it('should properly handle files with dynamic replacements in prefix/suffix', async () => {
    createNorth({ prefix: 'pre_@ConnectorName_', suffix: '_@CurrentDate_suf' });

    await north.handleContent(readStream, metadata('data.csv', 100));

    const nowDate = DateTime.fromMillis(new Date(testData.constants.dates.FAKE_NOW).getTime()).toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS');
    const expectedPath = path.join(path.resolve(configuration.settings.outputFolder), `pre_${configuration.name}_data_${nowDate}_suf.csv`);
    assert.strictEqual(createWriteStreamMock.mock.calls.length, 1);
    assert.deepStrictEqual(createWriteStreamMock.mock.calls[0].arguments, [expectedPath]);
    assert.strictEqual(pipelineMock.mock.calls.length, 1);
    assert.deepStrictEqual(pipelineMock.mock.calls[0].arguments, [readStream, writeStream]);
  });

  it('should properly catch handle file error (pipeline failure)', async () => {
    pipelineMock.mock.mockImplementation(async () => {
      throw new Error('Pipeline failed');
    });

    await assert.rejects(north.handleContent(readStream, metadata('example.file')), /Pipeline failed/);
  });

  it('should properly handle files (direct naming)', async () => {
    north.connectorConfiguration = buildNorthEntity<NorthFileWriterSettings>('file-writer', {
      outputFolder: 'outputFolder',
      prefix: '',
      suffix: ''
    });

    await north.handleContent(readStream, metadata('example-123.file'));

    const expectedPath = path.join(path.resolve(configuration.settings.outputFolder), 'example-123.file');
    assert.strictEqual(createWriteStreamMock.mock.calls.length, 1);
    assert.deepStrictEqual(createWriteStreamMock.mock.calls[0].arguments, [expectedPath]);
    assert.strictEqual(pipelineMock.mock.calls.length, 1);
    assert.deepStrictEqual(pipelineMock.mock.calls[0].arguments, [readStream, writeStream]);
  });

  it('should have access to output folder (Test Connection)', async () => {
    const writeFileMock = mock.method(fs, 'writeFile', async () => undefined);
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);
    mock.method(fs, 'readdir', async () => ['file1.txt', 'file2.csv', 'file3.json']);

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

  for (const [testCase, errorMessage] of [
    ['folder not existing', 'ENOENT: no such file or directory'],
    ['not having write access on folder', 'EPERM: operation not permitted']
  ]) {
    it(`should handle ${testCase} (Test Connection)`, async () => {
      mock.method(fs, 'writeFile', async () => {
        throw new Error(errorMessage);
      });

      const outputFolder = path.resolve(configuration.settings.outputFolder);
      await assert.rejects(north.testConnection(), new Error(`Write access error on "${outputFolder}": ${errorMessage}`));
    });
  }

  it('should ignore a readdir failure when counting files (Test Connection)', async () => {
    const writeFileMock = mock.method(fs, 'writeFile', async () => undefined);
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);
    mock.method(fs, 'readdir', async () => {
      throw new Error('EACCES: permission denied');
    });

    const testResult = await north.testConnection();

    const outputFolder = path.resolve(configuration.settings.outputFolder);
    assert.strictEqual(writeFileMock.mock.calls.length, 1);
    assert.strictEqual(unlinkMock.mock.calls.length, 1);
    // The file count is skipped, but the folder check still succeeds.
    assert.deepStrictEqual(testResult, { items: [{ key: 'Output Folder', value: outputFolder }] });
  });

  describe('connect and disconnect (SMB)', () => {
    afterEach(async () => {
      await north.stop().catch(_e => undefined);
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
        createNorth({ username: 'user', outputFolder: UNC_FOLDER });
        await north['mountNetworkShare'](UNC_FOLDER);
        assert.ok(logger.trace.mock.calls.some(c => (c.arguments[0] as string).includes('Skipping SMB session authentication')));
      });

      it('should log trace and skip SMB session removal on non-Windows platforms', async () => {
        createNorth({ username: 'user', outputFolder: UNC_FOLDER });
        await north['unmountNetworkShare'](UNC_FOLDER);
        assert.ok(logger.trace.mock.calls.some(c => (c.arguments[0] as string).includes('Skipping SMB session removal')));
      });
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

        before(() => {
          Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
        });

        after(() => {
          Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
        });

        // execFile rejects with ENOENT, which drives the catch branch (logger.error + rethrow) of mountNetworkShare.
        it('should throw and log an error when mountNetworkShare execFile fails', async () => {
          createNorth({ username: 'user', domain: 'DOMAIN', outputFolder: UNC_FOLDER });

          await assert.rejects(north['mountNetworkShare'](UNC_FOLDER));
          assert.ok(logger.error.mock.calls.some(c => (c.arguments[0] as string).includes('Failed to authenticate SMB session')));
        });

        // A spy replacing the private method running `net use … /delete`, the first step of both mount and unmount
        const spyOnDeleteNetworkSession = () => {
          const spy = mock.fn(async (_shareRoot: string) => undefined);
          north['deleteNetworkSession'] = spy;
          return spy;
        };

        it('should skip mountNetworkShare when username is empty on windows', async () => {
          createNorth({ username: null, outputFolder: UNC_FOLDER });
          const deleteSpy = spyOnDeleteNetworkSession();

          await north.connect();

          assert.strictEqual(deleteSpy.mock.calls.length, 0);
          assert.strictEqual(logger.error.mock.calls.length, 0);
        });

        it('should skip mountNetworkShare when outputFolder is not a UNC path on windows', async () => {
          createNorth({ username: 'user', password: 'pass', outputFolder: 'C:\\local\\output' });
          const deleteSpy = spyOnDeleteNetworkSession();

          await north.connect();

          assert.strictEqual(deleteSpy.mock.calls.length, 0);
          assert.strictEqual(logger.error.mock.calls.length, 0);
        });

        it('should skip unmountNetworkShare when username is empty on windows', async () => {
          createNorth({ username: null, outputFolder: UNC_FOLDER });
          const deleteSpy = spyOnDeleteNetworkSession();

          await north['unmountNetworkShare'](UNC_FOLDER);

          assert.strictEqual(deleteSpy.mock.calls.length, 0);
        });

        it('should skip unmountNetworkShare when outputFolder is not a UNC path on windows', async () => {
          createNorth({ username: 'user', outputFolder: 'C:\\local\\output' });
          const deleteSpy = spyOnDeleteNetworkSession();

          await north['unmountNetworkShare']('C:\\local\\output');

          assert.strictEqual(deleteSpy.mock.calls.length, 0);
        });

        // unmountNetworkShare swallows execFile failures (ENOENT here), so it resolves —
        // covering its try + catch branch.
        it('should silently ignore unmountNetworkShare execFile failures', async () => {
          createNorth({ username: 'user', outputFolder: UNC_FOLDER });

          await assert.doesNotReject(north['unmountNetworkShare'](UNC_FOLDER));
        });

        // testConnection mounts the share first; execFile fails so the mount rejects and testConnection propagates
        // the failure.
        it('should propagate SMB mount failure from testConnection', async () => {
          createNorth({ username: 'user', outputFolder: UNC_FOLDER });

          await assert.rejects(north.testConnection());
        });

        // Windows refuses to add a session for a server that already has one under a different
        // identity (system error 1219). Clearing any existing session first, unconditionally,
        // before adding the new one makes mounting self-healing regardless of what left a
        // previous session dangling (unclean shutdown, a prior failed attempt, a leftover test).
        it('should clear any existing session before authenticating a new one', async () => {
          createNorth({ username: 'user', outputFolder: UNC_FOLDER });
          const deleteSpy = mock.fn(async (_shareRoot: string) => undefined);
          north['deleteNetworkSession'] = deleteSpy;

          // The add still rejects with ENOENT — that's enough to confirm deleteNetworkSession always runs first,
          // before the add is attempted.
          await assert.rejects(north['mountNetworkShare'](UNC_FOLDER));
          assert.strictEqual(deleteSpy.mock.calls.length, 1);
          assert.deepStrictEqual(deleteSpy.mock.calls[0].arguments, ['\\\\server\\share']);
        });

        // testConnection() must NOT tear the SMB session down afterwards: it's a single shared
        // OS-level resource per share, not something testConnection() owns exclusively. If the
        // connector is already connected and actively running, unmounting here would rip the
        // session out from under it — breaking every write until the next connect/reconnect —
        // which is exactly what happened when this was tried (see commit history).
        it('should not tear down the SMB session after a successful testConnection', async () => {
          createNorth({ username: 'user', outputFolder: UNC_FOLDER });
          north['mountNetworkShare'] = mock.fn(async (_folderPath: string) => undefined);
          const unmountSpy = mock.fn(async (_folderPath: string) => undefined);
          north['unmountNetworkShare'] = unmountSpy;
          mock.method(fs, 'writeFile', async () => undefined);
          mock.method(fs, 'unlink', async () => undefined);
          mock.method(fs, 'readdir', async () => []);

          await north.testConnection();

          assert.strictEqual(unmountSpy.mock.calls.length, 0);
        });

        it('should not tear down the SMB session after a failed testConnection', async () => {
          createNorth({ username: 'user', outputFolder: UNC_FOLDER });
          north['mountNetworkShare'] = mock.fn(async (_folderPath: string) => undefined);
          const unmountSpy = mock.fn(async (_folderPath: string) => undefined);
          north['unmountNetworkShare'] = unmountSpy;
          mock.method(fs, 'writeFile', async () => {
            throw new Error('EACCES');
          });

          await assert.rejects(north.testConnection());

          assert.strictEqual(unmountSpy.mock.calls.length, 0);
        });

        // Re-authenticating before every write (rather than relying solely on the mount from
        // connect()) self-heals a session that dropped or was replaced in the meantime, instead
        // of failing every write until the connector fully reconnects.
        it('should re-authenticate the SMB session before every write in handleContent', async () => {
          createNorth({ username: 'user', outputFolder: UNC_FOLDER });
          const mountSpy = mock.fn(async (_folderPath: string) => undefined);
          north['mountNetworkShare'] = mountSpy;

          await north.handleContent(readStream, metadata('file.txt', 10));

          assert.strictEqual(mountSpy.mock.calls.length, 1);
        });
      }
    );
  });
});
