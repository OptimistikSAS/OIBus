import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DateTime } from 'luxon';
import type pino from 'pino';

import LoggerMock from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { CacheMetadata } from '../../../shared/model/engine.model';
import CleanupService from './cleanup.service';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import HistoryQueryRepositoryMock from '../../tests/__mocks__/repository/config/history-query-repository.mock';
import DataStreamEngineMock from '../../tests/__mocks__/data-stream-engine.mock';
import OianalyticsMessageRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-message-repository.mock';
import OianalyticsCommandRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-command-repository.mock';

const createMetadata = (date: string): string =>
  JSON.stringify({
    contentFile: 'file-123.json',
    contentSize: 100,
    numberOfElement: 1,
    createdAt: date,
    contentType: 'any'
  } as CacheMetadata);

describe('CleanupService', () => {
  let service: CleanupService;
  let logger: LoggerMock;
  let anotherLogger: LoggerMock;
  let northConnectorRepository: NorthConnectorRepositoryMock;
  let southConnectorRepository: SouthConnectorRepositoryMock;
  let historyQueryRepository: HistoryQueryRepositoryMock;
  let oianalyticsMessageRepository: OianalyticsMessageRepositoryMock;
  let oianalyticsCommandRepository: OianalyticsCommandRepositoryMock;
  let engine: DataStreamEngineMock;

  beforeEach(() => {
    logger = new LoggerMock();
    anotherLogger = new LoggerMock();
    northConnectorRepository = new NorthConnectorRepositoryMock();
    southConnectorRepository = new SouthConnectorRepositoryMock();
    historyQueryRepository = new HistoryQueryRepositoryMock();
    oianalyticsMessageRepository = new OianalyticsMessageRepositoryMock();
    oianalyticsCommandRepository = new OianalyticsCommandRepositoryMock();
    engine = new DataStreamEngineMock(null);

    mock.timers.enable({ apis: ['Date', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW).getTime() });

    service = new CleanupService(
      logger as unknown as pino.Logger,
      'baseFolder',
      historyQueryRepository,
      northConnectorRepository,
      southConnectorRepository,
      oianalyticsMessageRepository,
      oianalyticsCommandRepository,
      engine
    );
  });

  afterEach(() => {
    mock.restoreAll();
    mock.timers.reset();
  });

  it('should start and schedule cleanup', async () => {
    const clearIntervalSpy = mock.method(global, 'clearInterval', mock.fn());

    (service as any)['cleanOrphans'] = mock.fn(async () => {});
    (service as any)['cleanNorthConnectors'] = mock.fn(async () => {});
    (service as any)['cleanHistoryQueries'] = mock.fn(async () => {});
    (service as any)['cleanOIAnalyticsData'] = mock.fn();

    await service.start();

    assert.strictEqual((service as any)['cleanOrphans'].mock.calls.length, 1);

    // Verify setInterval was called with 3600s interval by ticking the clock
    mock.timers.tick(3600 * 1000);
    assert.strictEqual((service as any)['cleanOrphans'].mock.calls.length, 2);

    service.stop();
    assert.strictEqual(clearIntervalSpy.mock.calls.length, 1);
  });

  it('should run full cleanup process', async () => {
    (service as any)['cleanOrphans'] = mock.fn(async () => {});
    (service as any)['cleanNorthConnectors'] = mock.fn(async () => {});
    (service as any)['cleanHistoryQueries'] = mock.fn(async () => {});
    (service as any)['cleanOIAnalyticsData'] = mock.fn();

    await service.cleanup();

    assert.deepStrictEqual(logger.debug.mock.calls[0].arguments, ['Cleaning up data folder...']);
    assert.strictEqual((service as any)['cleanOrphans'].mock.calls.length, 1);
    assert.strictEqual((service as any)['cleanNorthConnectors'].mock.calls.length, 1);
    assert.strictEqual((service as any)['cleanHistoryQueries'].mock.calls.length, 1);
    assert.strictEqual((service as any)['cleanOIAnalyticsData'].mock.calls.length, 1);
  });

  describe('cleanOrphans', () => {
    it('should remove orphan folders in all main directories', async () => {
      mock.method(
        fs,
        'readdir',
        mock.fn(async (p: unknown) => {
          const pathStr = String(p);
          if (pathStr.includes('cache')) return ['south-1', 'south-2', 'random.db'];
          if (pathStr.includes('error')) return ['north-1', 'north-2'];
          if (pathStr.includes('archive')) return ['history-1', 'history-2'];
          return [];
        })
      );

      let rmCallCount = 0;
      mock.method(
        fs,
        'rm',
        mock.fn(async () => {
          rmCallCount++;
          if (rmCallCount === 1) throw new Error('rm error');
        })
      );

      southConnectorRepository.findSouthById.mock.mockImplementation((id: unknown) => (id === '1' ? {} : null));
      northConnectorRepository.findNorthById.mock.mockImplementation((id: unknown) => (id === '1' ? {} : null));
      historyQueryRepository.findHistoryById.mock.mockImplementation((id: unknown) => (id === '1' ? {} : null));

      await (service as any)['cleanOrphans']();

      const rmCalls = (fs.rm as ReturnType<typeof mock.fn>).mock.calls.map(c => c.arguments[0]);

      assert.ok(rmCalls.includes(path.resolve('baseFolder', 'cache', 'south-2')));
      assert.ok(rmCalls.includes(path.resolve('baseFolder', 'error', 'north-2')));
      assert.ok(rmCalls.includes(path.resolve('baseFolder', 'archive', 'history-2')));

      assert.ok(!rmCalls.includes(path.resolve('baseFolder', 'cache', 'south-1')));
      assert.ok(!rmCalls.includes(path.resolve('baseFolder', 'error', 'north-1')));
      assert.ok(!rmCalls.includes(path.resolve('baseFolder', 'archive', 'history-1')));

      assert.strictEqual(logger.error.mock.calls.length, 1);
      assert.ok(
        (logger.error.mock.calls[0].arguments[0] as string).includes(
          `Could not remove orphan "${path.resolve('baseFolder', 'cache', 'south-2')}": rm error`
        )
      );
    });

    it('should manage other folders gracefully', async () => {
      mock.method(
        fs,
        'readdir',
        mock.fn(async (p: unknown) => {
          const pathStr = String(p);
          if (pathStr.includes('cache')) return ['south-1', 'south-2', 'random.db', 'other_folder', 'other_folder-withId'];
          if (pathStr.includes('error')) return ['north-1', 'north-2', 'other_folder', 'other_folder-withId'];
          if (pathStr.includes('archive')) return ['history-1', 'history-2', 'other_folder', 'other_folder-withId'];
          return [];
        })
      );

      await assert.doesNotReject(() => (service as any)['cleanOrphans']());
    });

    it('should handle fs errors gracefully', async () => {
      mock.method(fs, 'readdir', mock.fn(async () => { throw new Error('Read Error'); }));

      await assert.doesNotReject(() => (service as any)['cleanOrphans']());
    });

    it('should handle removal errors gracefully', async () => {
      mock.method(
        fs,
        'readdir',
        mock.fn(async (p: unknown) => {
          if (String(p).includes('cache')) return ['south-2'];
          return [];
        })
      );
      southConnectorRepository.findSouthById.mock.mockImplementation(() => null);
      mock.method(fs, 'rm', mock.fn(async () => { throw new Error('Remove Error'); }));

      await (service as any)['cleanOrphans']();

      assert.ok((fs.rm as ReturnType<typeof mock.fn>).mock.calls.some(c => String(c.arguments[0]).includes('south-2')));
      assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Could not remove orphan')));
    });
  });

  describe('cleanNorthConnectors (Retention Policy)', () => {
    it('should apply retention policy and update content', async () => {
      const north = {
        id: 'n1',
        caching: {
          error: { retentionDuration: 1 },
          archive: { retentionDuration: 5 }
        }
      };
      northConnectorRepository.findAllNorthFull.mock.mockImplementation(() => [north]);

      const errorFiles = ['file1.json', 'file2.json'];
      const archiveFiles = ['file3.json', 'file4.json'];

      mock.method(
        fs,
        'readdir',
        mock.fn(async (p: unknown) => {
          const pathStr = String(p);
          if (pathStr.includes(path.join('error', 'north-n1', 'metadata'))) return errorFiles;
          if (pathStr.includes(path.join('archive', 'north-n1', 'metadata'))) return archiveFiles;
          return [];
        })
      );

      const now = DateTime.fromISO(testData.constants.dates.FAKE_NOW);
      mock.method(
        fs,
        'readFile',
        mock.fn(async (p: unknown) => {
          const pathStr = String(p);
          if (pathStr.includes('file1')) return createMetadata(now.toUTC().toISO()!);
          if (pathStr.includes('file2')) return createMetadata(now.minus({ hours: 2 }).toUTC().toISO()!);
          if (pathStr.includes('file3')) return createMetadata(now.minus({ hours: 2 }).toUTC().toISO()!);
          if (pathStr.includes('file4')) return createMetadata(now.minus({ hours: 6 }).toUTC().toISO()!);
          return '';
        })
      );

      await (service as any)['cleanNorthConnectors']();

      assert.deepStrictEqual(engine.updateCacheContent.mock.calls[0].arguments, [
        'north',
        'n1',
        {
          error: { remove: ['file2.json'], move: [] },
          archive: { remove: ['file4.json'], move: [] },
          cache: { remove: [], move: [] }
        }
      ]);
    });

    it('should skip folders if retention is 0 (optimization)', async () => {
      const north = {
        id: 'n1',
        caching: {
          error: { retentionDuration: 0 },
          archive: { retentionDuration: 0 }
        }
      };
      northConnectorRepository.findAllNorthFull.mock.mockImplementation(() => [north]);

      await (service as any)['cleanNorthConnectors']();

      assert.strictEqual(engine.updateCacheContent.mock.calls.length, 0);
    });
  });

  describe('cleanHistoryQueries (Retention Policy)', () => {
    it('should apply retention policy including subpath "north"', async () => {
      const history = {
        id: 'h1',
        caching: {
          error: { retentionDuration: 24 },
          archive: { retentionDuration: 0 }
        }
      };
      historyQueryRepository.findAllHistoriesFull.mock.mockImplementation(() => [history]);

      const files = ['old.json'];
      const targetPath = path.join('error', 'history-h1', 'north', 'metadata');

      mock.method(
        fs,
        'readdir',
        mock.fn(async (p: unknown) => {
          if (String(p).includes(targetPath)) return files;
          return [];
        })
      );

      const oldDate = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ hours: 25 }).toUTC().toISO()!;
      mock.method(fs, 'readFile', mock.fn(async () => createMetadata(oldDate)));

      await (service as any)['cleanHistoryQueries']();

      assert.deepStrictEqual(engine.updateCacheContent.mock.calls[0].arguments, [
        'history',
        'h1',
        {
          error: { remove: ['old.json'], move: [] },
          archive: { remove: [], move: [] },
          cache: { remove: [], move: [] }
        }
      ]);
    });
  });

  describe('retrieveFilesToDelete (Low Level)', () => {
    it('should delete corrupt metadata files', async () => {
      mock.method(fs, 'readdir', mock.fn(async () => ['corrupt.json']));
      mock.method(fs, 'readFile', mock.fn(async () => 'INVALID JSON'));
      mock.method(fs, 'rm', mock.fn(async () => {}));

      const files = await (service as any)['retrieveFilesToDelete']('some/folder', 10);

      assert.ok((fs.rm as ReturnType<typeof mock.fn>).mock.calls.some(c => String(c.arguments[0]).includes('corrupt.json')));
      assert.deepStrictEqual(files, []);
    });

    it('should handle missing folders gracefully', async () => {
      mock.method(fs, 'readdir', mock.fn(async () => { throw new Error('ENOENT'); }));

      const files = await (service as any)['retrieveFilesToDelete']('missing/folder', 10);
      assert.deepStrictEqual(files, []);
    });
  });

  describe('cleanOIAnalyticsData', () => {
    it('should delete old messages and commands', () => {
      const messages = [{ id: 'm1' }, { id: 'm2' }];
      const commands = [{ id: 'c1' }];

      oianalyticsMessageRepository.list.mock.mockImplementation(() => messages);
      oianalyticsCommandRepository.list.mock.mockImplementation(() => commands);

      (service as any)['cleanOIAnalyticsData']();

      const expectedEnd = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ days: 7 }).toUTC().toISO();

      assert.deepStrictEqual(oianalyticsMessageRepository.list.mock.calls[0].arguments, [
        {
          types: [],
          status: ['ERRORED', 'COMPLETED'],
          start: undefined,
          end: expectedEnd
        }
      ]);
      assert.ok(oianalyticsMessageRepository.delete.mock.calls.some(c => c.arguments[0] === 'm1'));
      assert.ok(oianalyticsMessageRepository.delete.mock.calls.some(c => c.arguments[0] === 'm2'));

      assert.deepStrictEqual(oianalyticsCommandRepository.list.mock.calls[0].arguments, [
        {
          types: [],
          status: ['ERRORED', 'COMPLETED', 'CANCELLED'],
          start: undefined,
          ack: undefined,
          end: expectedEnd
        }
      ]);
      assert.ok(oianalyticsCommandRepository.delete.mock.calls.some(c => c.arguments[0] === 'c1'));
    });
  });

  it('should use another logger', async () => {
    service.setLogger(anotherLogger as unknown as pino.Logger);
    (service as any)['cleanOrphans'] = mock.fn(async () => {});
    (service as any)['cleanNorthConnectors'] = mock.fn(async () => {});
    (service as any)['cleanHistoryQueries'] = mock.fn(async () => {});
    (service as any)['cleanOIAnalyticsData'] = mock.fn();
    await service.cleanup();
    assert.ok(anotherLogger.debug.mock.calls.length > 0);
  });
});
