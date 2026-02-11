import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { CacheMetadata } from '../../../shared/model/engine.model';
import CleanupService from './cleanup.service';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import HistoryQueryRepository from '../../repository/config/history-query.repository';
import HistoryQueryRepositoryMock from '../../tests/__mocks__/repository/config/history-query-repository.mock';
import DataStreamEngine from '../../engine/data-stream-engine';
import DataStreamEngineMock from '../../tests/__mocks__/data-stream-engine.mock';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DateTime } from 'luxon';
import OIAnalyticsMessageRepository from '../../repository/config/oianalytics-message.repository';
import OianalyticsMessageRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-message-repository.mock';
import OIAnalyticsCommandRepository from '../../repository/config/oianalytics-command.repository';
import OianalyticsCommandRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-command-repository.mock';

jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const historyQueryRepository: HistoryQueryRepository = new HistoryQueryRepositoryMock();
const oianalyticsMessageRepository: OIAnalyticsMessageRepository = new OianalyticsMessageRepositoryMock();
const oianalyticsCommandRepository: OIAnalyticsCommandRepository = new OianalyticsCommandRepositoryMock();
const engine: DataStreamEngine = new DataStreamEngineMock();

// Helper to create test metadata
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

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    service = new CleanupService(
      logger,
      'baseFolder',
      historyQueryRepository,
      northConnectorRepository,
      southConnectorRepository,
      oianalyticsMessageRepository,
      oianalyticsCommandRepository,
      engine
    );
  });

  it('should start and schedule cleanup', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    // Mock internal methods to avoid actual execution during start test
    service['cleanOrphans'] = jest.fn();
    service['cleanNorthConnectors'] = jest.fn();
    service['cleanHistoryQueries'] = jest.fn();
    service['cleanOIAnalyticsData'] = jest.fn();

    await service.start();

    expect(service['cleanOrphans']).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 3600 * 1000);

    service.stop();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should run full cleanup process', async () => {
    service['cleanOrphans'] = jest.fn();
    service['cleanNorthConnectors'] = jest.fn();
    service['cleanHistoryQueries'] = jest.fn();
    service['cleanOIAnalyticsData'] = jest.fn();

    await service.cleanup();

    expect(logger.debug).toHaveBeenCalledWith('Cleaning up data folder...');
    expect(service['cleanOrphans']).toHaveBeenCalled();
    expect(service['cleanNorthConnectors']).toHaveBeenCalled();
    expect(service['cleanHistoryQueries']).toHaveBeenCalled();
    expect(service['cleanOIAnalyticsData']).toHaveBeenCalled();
  });

  describe('cleanOrphans', () => {
    it('should remove orphan folders in all main directories', async () => {
      // Setup: Mock fs.readdir to return different folders for cache, error, archive
      // cache: south-1 (active), south-2 (orphan)
      // error: north-1 (active), north-2 (orphan)
      // archive: history-1 (active), history-2 (orphan)
      (fs.readdir as jest.Mock).mockImplementation((p: string) => {
        if (p.includes('cache')) return Promise.resolve(['south-1', 'south-2', 'random.db']);
        if (p.includes('error')) return Promise.resolve(['north-1', 'north-2']);
        if (p.includes('archive')) return Promise.resolve(['history-1', 'history-2']);
        return Promise.resolve([]);
      });
      (fs.rm as jest.Mock).mockRejectedValueOnce(new Error('rm error')).mockResolvedValue(undefined);

      // Setup: Mock Repositories
      (southConnectorRepository.findSouthById as jest.Mock).mockImplementation(id => id === '1');
      (northConnectorRepository.findNorthById as jest.Mock).mockImplementation(id => id === '1');
      (historyQueryRepository.findHistoryById as jest.Mock).mockImplementation(id => id === '1');

      await service['cleanOrphans']();

      // Expect removal of orphans
      expect(fs.rm).toHaveBeenCalledWith(path.resolve('baseFolder', 'cache', 'south-2'), { force: true, recursive: true });
      expect(fs.rm).toHaveBeenCalledWith(path.resolve('baseFolder', 'error', 'north-2'), { force: true, recursive: true });
      expect(fs.rm).toHaveBeenCalledWith(path.resolve('baseFolder', 'archive', 'history-2'), { force: true, recursive: true });

      // Expect active folders NOT to be removed
      expect(fs.rm).not.toHaveBeenCalledWith(path.resolve('baseFolder', 'cache', 'south-1'), expect.anything());
      expect(fs.rm).not.toHaveBeenCalledWith(path.resolve('baseFolder', 'error', 'north-1'), expect.anything());
      expect(fs.rm).not.toHaveBeenCalledWith(path.resolve('baseFolder', 'archive', 'history-1'), expect.anything());

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(`Could not remove orphan "${path.resolve('baseFolder', 'cache', 'south-2')}": rm error`);
    });

    it('should manage other folders gracefully', async () => {
      (fs.readdir as jest.Mock).mockImplementation((p: string) => {
        if (p.includes('cache')) return Promise.resolve(['south-1', 'south-2', 'random.db', 'other_folder', 'other_folder-withId']);
        if (p.includes('error')) return Promise.resolve(['north-1', 'north-2', 'other_folder', 'other_folder-withId']);
        if (p.includes('archive')) return Promise.resolve(['history-1', 'history-2', 'other_folder', 'other_folder-withId']);
        return Promise.resolve([]);
      });

      await expect(service['cleanOrphans']()).resolves.not.toThrow();
    });

    it('should handle fs errors gracefully', async () => {
      (fs.readdir as jest.Mock).mockRejectedValue(new Error('Read Error'));
      await expect(service['cleanOrphans']()).resolves.not.toThrow();
    });
  });

  describe('cleanNorthConnectors (Retention Policy)', () => {
    it('should apply retention policy and update content', async () => {
      // Setup: 1 North connector with retention settings
      const north = {
        id: 'n1',
        caching: {
          error: { retentionDuration: 1 }, // 1 hour
          archive: { retentionDuration: 5 } // 5 hours
        }
      };
      (northConnectorRepository.findAllNorthFull as jest.Mock).mockReturnValue([north]);

      // Setup: Mock File System
      // Files for Error folder (Retention 1h)
      // file1: created NOW (keep)
      // file2: created 2h ago (delete)
      const errorFiles = ['file1.json', 'file2.json'];

      // Files for Archive folder (Retention 5h)
      // file3: created 2h ago (keep)
      // file4: created 6h ago (delete)
      const archiveFiles = ['file3.json', 'file4.json'];

      (fs.readdir as jest.Mock).mockImplementation((p: string) => {
        if (p.includes(path.join('error', 'north-n1', 'metadata'))) return Promise.resolve(errorFiles);
        if (p.includes(path.join('archive', 'north-n1', 'metadata'))) return Promise.resolve(archiveFiles);
        return Promise.resolve([]);
      });

      const now = DateTime.fromISO(testData.constants.dates.FAKE_NOW);
      (fs.readFile as jest.Mock).mockImplementation((p: string) => {
        if (p.includes('file1')) return Promise.resolve(createMetadata(now.toUTC().toISO()!));
        if (p.includes('file2')) return Promise.resolve(createMetadata(now.minus({ hours: 2 }).toUTC().toISO()!));
        if (p.includes('file3')) return Promise.resolve(createMetadata(now.minus({ hours: 2 }).toUTC().toISO()!));
        if (p.includes('file4')) return Promise.resolve(createMetadata(now.minus({ hours: 6 }).toUTC().toISO()!));
        return Promise.resolve('');
      });

      await service['cleanNorthConnectors']();

      // Verify Update Command
      expect(engine.updateCacheContent).toHaveBeenCalledWith('north', 'n1', {
        error: { remove: ['file2.json'], move: [] },
        archive: { remove: ['file4.json'], move: [] },
        cache: { remove: [], move: [] }
      });
    });

    it('should skip folders if retention is 0 (optimization)', async () => {
      const north = {
        id: 'n1',
        caching: {
          error: { retentionDuration: 0 },
          archive: { retentionDuration: 0 }
        }
      };
      (northConnectorRepository.findAllNorthFull as jest.Mock).mockReturnValue([north]);

      await service['cleanNorthConnectors']();

      // Should NOT read disk
      expect(fs.readdir).not.toHaveBeenCalled();
      expect(engine.updateCacheContent).not.toHaveBeenCalled();
    });
  });

  describe('cleanHistoryQueries (Retention Policy)', () => {
    it('should apply retention policy including subpath "north"', async () => {
      const history = {
        id: 'h1',
        caching: {
          error: { retentionDuration: 24 },
          archive: { retentionDuration: 0 } // Disabled
        }
      };
      (historyQueryRepository.findAllHistoriesFull as jest.Mock).mockReturnValue([history]);

      const files = ['old.json'];
      // Path should include 'north' subfolder for history queries
      const targetPath = path.join('error', 'history-h1', 'north', 'metadata');

      (fs.readdir as jest.Mock).mockImplementation((p: string) => {
        if (p.includes(targetPath)) return Promise.resolve(files);
        return Promise.resolve([]);
      });

      // 25 hours ago -> should delete
      const oldDate = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ hours: 25 }).toUTC().toISO()!;
      (fs.readFile as jest.Mock).mockResolvedValue(createMetadata(oldDate));

      await service['cleanHistoryQueries']();

      expect(engine.updateCacheContent).toHaveBeenCalledWith('history', 'h1', {
        error: { remove: ['old.json'], move: [] },
        archive: { remove: [], move: [] }, // skipped
        cache: { remove: [], move: [] }
      });
    });
  });

  describe('retrieveFilesToDelete (Low Level)', () => {
    it('should delete corrupt metadata files', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['corrupt.json']);
      (fs.readFile as jest.Mock).mockResolvedValue('INVALID JSON');
      (fs.rm as jest.Mock).mockResolvedValue(undefined);

      const files = await service['retrieveFilesToDelete']('some/folder', 10);

      // It should try to remove the corrupt file from disk
      expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining('corrupt.json'), { force: true });

      // It should NOT include it in the returned list for the engine (since it's already deleted manually)
      expect(files).toEqual([]);
    });

    it('should handle missing folders gracefully', async () => {
      (fs.readdir as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      const files = await service['retrieveFilesToDelete']('missing/folder', 10);
      expect(files).toEqual([]);
    });
  });

  describe('cleanOIAnalyticsData', () => {
    it('should delete old messages and commands', () => {
      const messages = [{ id: 'm1' }, { id: 'm2' }];
      const commands = [{ id: 'c1' }];

      (oianalyticsMessageRepository.list as jest.Mock).mockReturnValue(messages);
      (oianalyticsCommandRepository.list as jest.Mock).mockReturnValue(commands);

      service['cleanOIAnalyticsData']();

      const expectedEnd = DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ days: 7 }).toUTC().toISO();

      expect(oianalyticsMessageRepository.list).toHaveBeenCalledWith({
        types: [],
        status: ['ERRORED', 'COMPLETED'],
        start: undefined,
        end: expectedEnd
      });
      expect(oianalyticsMessageRepository.delete).toHaveBeenCalledWith('m1');
      expect(oianalyticsMessageRepository.delete).toHaveBeenCalledWith('m2');

      expect(oianalyticsCommandRepository.list).toHaveBeenCalledWith({
        types: [],
        status: ['ERRORED', 'COMPLETED', 'CANCELLED'],
        start: undefined,
        ack: undefined,
        end: expectedEnd
      });
      expect(oianalyticsCommandRepository.delete).toHaveBeenCalledWith('c1');
    });
  });

  it('should use another logger', () => {
    service.setLogger(anotherLogger);
    service.cleanup();
    expect(anotherLogger.debug).toHaveBeenCalled();
  });
});
