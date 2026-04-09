import fs from 'node:fs/promises';
import { Stats } from 'node:fs';
import path from 'node:path';
import SouthFolderScanner from './south-folder-scanner';
import { checkAge, compress } from '../../service/utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { SouthFolderScannerItemSettings, SouthFolderScannerSettings } from '../../../shared/model/south-settings.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import testData from '../../tests/utils/test-data';
import { DateTime } from 'luxon';

jest.mock('node:fs/promises');
jest.mock('../../service/utils');

const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

describe('SouthFolderScanner', () => {
  let south: SouthFolderScanner;
  let configuration: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings>;

  beforeEach(() => {
    jest.clearAllMocks();

    configuration = {
      id: 'southId',
      name: 'south',
      type: 'folder-scanner',
      description: 'my test connector',
      enabled: true,
      settings: {
        inputFolder: 'inputFolder',
        compression: false
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            regex: '.*\\.csv',
            preserveFiles: false,
            ignoreModifiedDate: false,
            minAge: 1000,
            maxFiles: 0,
            maxSize: 0,
            recursive: false
          },
          scanMode: testData.scanMode.list[0],
          group: null,
          syncWithGroup: false,
          maxReadInterval: null,
          readDelay: null,
          overlap: null,
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        }
      ],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    // Default mock behaviors
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true, mtimeMs: 1600000000000, size: 1024 } as Stats);
    (checkAge as jest.Mock).mockReturnValue(true);

    south = new SouthFolderScanner(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  describe('testConnection', () => {
    it('should pass testConnection if folder exists, is readable, and is a directory', async () => {
      await expect(south.testConnection()).resolves.toEqual({ items: [{ key: 'Folder', value: path.resolve('inputFolder') }] });
      expect(fs.access).toHaveBeenCalledWith(path.resolve('inputFolder'), fs.constants.F_OK);
      expect(fs.access).toHaveBeenCalledWith(path.resolve('inputFolder'), fs.constants.R_OK);
      expect(fs.stat).toHaveBeenCalledWith(path.resolve('inputFolder'));
    });

    it('should throw if folder does not exist', async () => {
      (fs.access as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));
      await expect(south.testConnection()).rejects.toThrow(/Folder ".*inputFolder" does not exist: ENOENT/);
    });

    it('should throw if folder is not readable', async () => {
      (fs.access as jest.Mock).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('EACCES'));
      await expect(south.testConnection()).rejects.toThrow(/Read access error on ".*inputFolder": EACCES/);
    });

    it('should throw if folder is a file, not a directory', async () => {
      (fs.stat as jest.Mock).mockResolvedValueOnce({ isDirectory: () => false } as Stats);
      await expect(south.testConnection()).rejects.toThrow(/is not a directory/);
    });
  });

  describe('listFilesRecursively', () => {
    it('should list files directly in the base dir without recursion', async () => {
      const mockDirents = [
        { name: 'file1.csv', isDirectory: () => false, isFile: () => true },
        { name: 'subfolder', isDirectory: () => true, isFile: () => false }
      ];
      (fs.readdir as jest.Mock).mockResolvedValueOnce(mockDirents);

      const files = await south['listFilesRecursively']('/base', '/base', configuration.items[0]);
      expect(files).toEqual(['file1.csv']);
    });

    it('should list files recursively if enabled in settings', async () => {
      configuration.items[0].settings.recursive = true;

      const rootDirents = [
        { name: 'file1.csv', isDirectory: () => false, isFile: () => true },
        { name: 'subfolder', isDirectory: () => true, isFile: () => false }
      ];
      const subDirents = [{ name: 'file2.csv', isDirectory: () => false, isFile: () => true }];

      (fs.readdir as jest.Mock).mockResolvedValueOnce(rootDirents).mockResolvedValueOnce(subDirents);

      const files = await south['listFilesRecursively']('/base', '/base', configuration.items[0]);
      expect(files.length).toBe(2);
      expect(files).toContain('file1.csv');
      expect(files).toContain(path.join('subfolder', 'file2.csv'));
    });
  });

  describe('directQuery', () => {
    beforeEach(() => {
      // Setup default mock for listFilesRecursively and stat
      south['listFilesRecursively'] = jest.fn().mockResolvedValue(['file1.csv', 'file2.csv', 'ignore.txt']);
      jest.spyOn(south, 'sendFile').mockResolvedValue(undefined);
    });

    it('should process matched files, call sendFile, and unlink files if preserveFiles is false', async () => {
      const result = await south.directQuery(configuration.items);

      expect(south.sendFile).toHaveBeenCalledTimes(2);
      expect(fs.unlink).toHaveBeenCalledTimes(2); // One for each matched file
      expect(result).toEqual([]); // Nothing preserved
    });

    it('should preserve files and return their updated modify times if preserveFiles is true', async () => {
      configuration.items[0].settings.preserveFiles = true;
      (southCacheService.getItemLastValue as jest.Mock).mockReturnValue({ value: [{ filename: 'file1.csv', modifiedTime: 1000 }] });

      const result = await south.directQuery(configuration.items);

      expect(fs.unlink).not.toHaveBeenCalled();

      // file1.csv was updated, file2.csv was added
      expect(result.length).toBe(2);
      expect(result.find(f => f.filename === 'file1.csv')?.modifiedTime).toBe(1600000000000); // from our default mock stat
      expect(result.find(f => f.filename === 'file2.csv')?.modifiedTime).toBe(1600000000000);
    });

    it('should safely log and ignore unlink errors', async () => {
      (fs.unlink as jest.Mock).mockRejectedValueOnce(new Error('Cannot delete'));

      await south.directQuery(configuration.items);

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error while removing'));
    });

    it('should stop processing if maxFiles limit is reached', async () => {
      configuration.items[0].settings.maxFiles = 1;

      await south.directQuery(configuration.items);

      // Only 1 file should be processed despite 2 matching the regex
      expect(south.sendFile).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Max files limit (1) reached'));
    });

    it('should stop processing if maxSize limit is reached', async () => {
      configuration.items[0].settings.maxSize = 1; // 1 MB

      // Mock stats so the first file is under 1MB, but the second file pushes it over
      (fs.stat as jest.Mock)
        .mockResolvedValueOnce({ mtimeMs: 1600000000000, size: 600 * 1024 } as Stats) // 600KB
        .mockResolvedValueOnce({ mtimeMs: 1600000000000, size: 600 * 1024 } as Stats); // 600KB

      await south.directQuery(configuration.items);

      // Only 1 file should be processed
      expect(south.sendFile).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Max size limit (1 MB) reached'));
    });

    it('should skip files modified before v3.7 migration cutoff when filesPreserved is empty and trackedInstant is set', async () => {
      configuration.items[0].settings.preserveFiles = true;
      // Simulate post-migration state: no filesPreserved list but trackedInstant from old max_instant
      const migrationCutoff = '2024-01-01T12:00:00.000Z';
      const cutoffMs = new Date(migrationCutoff).getTime();
      (southCacheService.getItemLastValue as jest.Mock).mockReturnValue({
        value: null,
        trackedInstant: migrationCutoff
      });

      // file1.csv: mtime before cutoff → should be skipped
      // file2.csv: mtime after cutoff → should be processed
      (fs.stat as jest.Mock)
        .mockResolvedValueOnce({ mtimeMs: cutoffMs - 1000, size: 100 } as Stats)
        .mockResolvedValueOnce({ mtimeMs: cutoffMs + 1000, size: 100 } as Stats);

      const result = await south.directQuery(configuration.items);

      expect(south.sendFile).toHaveBeenCalledTimes(1);
      expect(logger.trace).toHaveBeenCalledWith(expect.stringContaining('Skipping "file1.csv"'));
      expect(result.find(f => f.filename === 'file2.csv')).toBeDefined();
    });

    it('should not apply migration cutoff when filesPreserved is already populated', async () => {
      configuration.items[0].settings.preserveFiles = true;
      // Normal v3.8 state: filesPreserved populated, trackedInstant also set — cutoff must NOT apply
      const trackedInstant = '2024-01-01T12:00:00.000Z';
      const cutoffMs = new Date(trackedInstant).getTime();
      (southCacheService.getItemLastValue as jest.Mock).mockReturnValue({
        value: [{ filename: 'file1.csv', modifiedTime: cutoffMs - 1000 }],
        trackedInstant
      });

      // Both files have mtime before the trackedInstant — without cutoff they're checked by checkAge
      (fs.stat as jest.Mock).mockResolvedValue({ mtimeMs: cutoffMs - 500, size: 100 } as Stats);

      await south.directQuery(configuration.items);

      // Cutoff not active — checkAge (mocked to return true) decides
      expect(logger.trace).not.toHaveBeenCalledWith(expect.stringContaining('migration cutoff'));
    });
  });

  describe('sendFile', () => {
    const mockQueryTime = DateTime.now().toUTC().toISO()!;

    beforeEach(() => {
      jest.spyOn(south, 'addContent').mockResolvedValue(undefined);
    });

    it('should send the raw file if compression is disabled', async () => {
      await south.sendFile(configuration.items[0], 'file1.csv', mockQueryTime);

      expect(south['addContent']).toHaveBeenCalledWith({ type: 'any', filePath: path.resolve('inputFolder', 'file1.csv') }, mockQueryTime, [
        configuration.items[0]
      ]);
    });

    it('should compress the file and send the gzipped version if compression is enabled', async () => {
      configuration.settings.compression = true;

      await south.sendFile(configuration.items[0], path.join('sub', 'file1.csv'), mockQueryTime);

      const safeFilename = `sub_file1.csv`.replace(/\//g, '_').replace(/\\/g, '_');
      const expectedGzipPath = path.resolve('cacheFolder', 'tmp', `${safeFilename}.gz`);

      expect(compress).toHaveBeenCalledWith(path.resolve('inputFolder', 'sub', 'file1.csv'), expectedGzipPath);
      expect(south['addContent']).toHaveBeenCalledWith({ type: 'any', filePath: expectedGzipPath }, mockQueryTime, [
        configuration.items[0]
      ]);
      expect(fs.unlink).toHaveBeenCalledWith(expectedGzipPath); // Cleans up the temp zip
    });

    it('should fallback to sending the raw file if compression fails', async () => {
      configuration.settings.compression = true;
      (compress as jest.Mock).mockRejectedValueOnce(new Error('Zip failure'));

      await south.sendFile(configuration.items[0], 'file1.csv', mockQueryTime);

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error compressing file'));
      expect(south['addContent']).toHaveBeenCalledWith({ type: 'any', filePath: path.resolve('inputFolder', 'file1.csv') }, mockQueryTime, [
        configuration.items[0]
      ]);
    });

    it('should safely log and ignore unlink errors after compressing', async () => {
      configuration.settings.compression = true;
      (fs.unlink as jest.Mock).mockRejectedValueOnce(new Error('Cannot delete zip'));

      await south.sendFile(configuration.items[0], 'file1.csv', mockQueryTime);

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error while removing compressed file'));
    });
  });
});
