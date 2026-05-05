import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import LoggerMock from '../../tests/__mocks__/service/logger/logger.mock';
import FileCleanupService from './file-cleanup.service';

const LOG_FOLDER = path.resolve('logFolder');

let fileCleanupService: FileCleanupService;
let logger: LoggerMock;

describe('FileCleanupService', () => {
  beforeEach(() => {
    logger = new LoggerMock();
    mock.timers.enable({ apis: ['setInterval'] });
    fileCleanupService = new FileCleanupService('logFolder', logger, 'journal.log', 2);
  });

  afterEach(() => {
    mock.restoreAll();
    mock.timers.reset();
  });

  it('should properly start and stop', async () => {
    const cleanUpMock = mock.fn(async () => undefined);
    fileCleanupService.cleanUpLogFiles = cleanUpMock as unknown as () => Promise<void>;
    const clearIntervalSpy = mock.method(global, 'clearInterval', mock.fn());

    await fileCleanupService.start();
    assert.strictEqual(cleanUpMock.mock.calls.length, 1);

    mock.timers.tick(12 * 3600 * 1000); // Advance by half a day
    assert.strictEqual(cleanUpMock.mock.calls.length, 1);

    mock.timers.tick(12 * 3600 * 1000); // Advance by half a day
    assert.strictEqual(cleanUpMock.mock.calls.length, 2);

    fileCleanupService.stop();
    assert.strictEqual(clearIntervalSpy.mock.calls.length, 1);
  });

  it('should properly stop without interval', () => {
    const clearIntervalSpy = mock.method(global, 'clearInterval', mock.fn());

    fileCleanupService.stop();
    assert.deepStrictEqual(logger.trace.mock.calls[0].arguments, ['Stopping file cleanup service.']);
    assert.strictEqual(clearIntervalSpy.mock.calls.length, 0);
  });

  it('should properly clean up folder', async () => {
    // filesExists calls fs.stat(logFolder); file stat calls use path-based dispatch
    mock.method(
      fs,
      'stat',
      mock.fn(async (filePath: unknown) => {
        const p = String(filePath);
        if (p === LOG_FOLDER) return {}; // filesExists — folder exists
        if (p.endsWith('journal.log.1')) return { mtimeMs: 2 };
        if (p.endsWith('journal.log.2')) return { mtimeMs: 1 };
        if (p.endsWith('journal.log.233')) return { mtimeMs: 5 };
        throw new Error(`Unexpected stat call: ${p}`);
      })
    );

    const readdirMock1 = mock.method(
      fs,
      'readdir',
      mock.fn(async () => [
        'journal.log.1',
        'journal.log.2',
        'journal.log.233',
        'journal.log.0.backup',
        'journal.db',
        'migration-journal.log'
      ])
    ) as ReturnType<typeof mock.fn>;

    const unlinkMock = mock.fn(async () => undefined);
    mock.method(fs, 'unlink', unlinkMock);

    await fileCleanupService.cleanUpLogFiles();

    assert.deepStrictEqual(readdirMock1.mock.calls[0].arguments, [LOG_FOLDER]);
    assert.deepStrictEqual(logger.trace.mock.calls[0].arguments, [
      `Found 3 log files with RegExp /^journal.log\\.[0-9]*$/ in folder "${LOG_FOLDER}".`
    ]);
    assert.deepStrictEqual(logger.trace.mock.calls[1].arguments, ['Removing 1 log files.']);
    assert.deepStrictEqual(unlinkMock.mock.calls[0].arguments, [path.join(LOG_FOLDER, 'journal.log.2')]);
  });

  it('should not clean up folder if not enough files', async () => {
    const statMock2 = mock.method(
      fs,
      'stat',
      mock.fn(async () => ({}))
    ) as ReturnType<typeof mock.fn>;

    const readdirMock2 = mock.method(
      fs,
      'readdir',
      mock.fn(async () => ['journal.log.1', 'journal.log.2'])
    ) as ReturnType<typeof mock.fn>;

    const unlinkMock = mock.fn(async () => undefined);
    mock.method(fs, 'unlink', unlinkMock);

    await fileCleanupService.cleanUpLogFiles();

    assert.deepStrictEqual(readdirMock2.mock.calls[0].arguments, [LOG_FOLDER]);
    assert.deepStrictEqual(logger.trace.mock.calls[0].arguments, [
      `Found 2 log files with RegExp /^journal.log\\.[0-9]*$/ in folder "${LOG_FOLDER}".`
    ]);
    // Only the filesExists stat call — no per-file stat calls, no unlinks
    assert.strictEqual(statMock2.mock.calls.length, 1);
    assert.strictEqual(unlinkMock.mock.calls.length, 0);
  });

  it('should properly manage file access errors', async () => {
    mock.method(
      fs,
      'stat',
      mock.fn(async (filePath: unknown) => {
        const p = String(filePath);
        if (p === LOG_FOLDER) return {}; // filesExists — folder exists
        if (p.endsWith('journal.log.1')) return { mtimeMs: 2 };
        if (p.endsWith('journal.log.2')) return { mtimeMs: 1 };
        if (p.endsWith('journal.log.233')) return { mtimeMs: 5 };
        if (p.endsWith('journal.log.3')) throw new Error('stat error');
        if (p.endsWith('journal.log.4')) return { mtimeMs: 9 };
        throw new Error(`Unexpected stat call: ${p}`);
      })
    );

    const readdirMock3 = mock.method(
      fs,
      'readdir',
      mock.fn(async () => [
        'journal.log.1',
        'journal.log.2',
        'journal.log.233',
        'journal.log.3',
        'journal.log.4',
        'journal.log.0.backup',
        'journal.db',
        'migration-journal.log'
      ])
    ) as ReturnType<typeof mock.fn>;

    let unlinkCallCount = 0;
    const unlinkMock = mock.fn(async () => {
      unlinkCallCount++;
      if (unlinkCallCount === 2) throw new Error('unlink error');
    });
    mock.method(fs, 'unlink', unlinkMock);

    await fileCleanupService.cleanUpLogFiles();

    assert.deepStrictEqual(readdirMock3.mock.calls[0].arguments, [LOG_FOLDER]);
    assert.deepStrictEqual(logger.trace.mock.calls[0].arguments, [
      `Found 5 log files with RegExp /^journal.log\\.[0-9]*$/ in folder "${LOG_FOLDER}".`
    ]);
    assert.deepStrictEqual(logger.error.mock.calls[0].arguments, [
      `Error while reading log file "${path.join(LOG_FOLDER, 'journal.log.3')}": ${new Error('stat error')}`
    ]);
    assert.deepStrictEqual(logger.trace.mock.calls[1].arguments, ['Removing 2 log files.']);
    assert.deepStrictEqual(unlinkMock.mock.calls[0].arguments, [path.join(LOG_FOLDER, 'journal.log.2')]);
    assert.deepStrictEqual(logger.error.mock.calls[1].arguments, [
      `Error while removing log file "${path.join(LOG_FOLDER, 'journal.log.1')}": ${new Error('unlink error')}`
    ]);
  });

  it('should properly return if folder does not exist', async () => {
    mock.method(
      fs,
      'stat',
      mock.fn(async () => {
        throw new Error('ENOENT');
      })
    );

    await fileCleanupService.cleanUpLogFiles();

    assert.strictEqual(logger.trace.mock.calls.length, 0);
  });

  it('should properly catch readdir error', async () => {
    mock.method(
      fs,
      'stat',
      mock.fn(async () => ({}))
    ); // filesExists — folder exists
    mock.method(
      fs,
      'readdir',
      mock.fn(async () => {
        throw new Error('readdir error');
      })
    );

    await fileCleanupService.cleanUpLogFiles();

    assert.strictEqual(logger.trace.mock.calls.length, 0);
    assert.deepStrictEqual(logger.error.mock.calls[0].arguments, [new Error('readdir error')]);
  });
});
