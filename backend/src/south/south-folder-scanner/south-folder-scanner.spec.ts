import fs from 'node:fs/promises';
import path from 'node:path';
import SouthFolderScanner from './south-folder-scanner';
import { compress } from '../../service/utils';
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
  const configuration: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'folder-scanner',
    description: 'my test connector',
    enabled: true,
    settings: {
      inputFolder: 'inputFolder',
      compression: false
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          regex: '.*.csv',
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
        overlap: null
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          regex: '.*.log',
          preserveFiles: true,
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
        overlap: null
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          regex: '.*.txt',
          preserveFiles: true,
          ignoreModifiedDate: true,
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
        overlap: null
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    south = new SouthFolderScanner(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    await south.start();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fileQuery should manage file query', async () => {
    // First fileQuery call - all 3 items get empty
    // Second fileQuery call - all 3 items get files
    (fs.readdir as jest.Mock)
      .mockResolvedValueOnce([]) // item1 empty
      .mockResolvedValueOnce([]) // item2 empty
      .mockResolvedValueOnce([]) // item3 empty
      .mockResolvedValue([
        { name: 'file.txt', isFile: () => true, isDirectory: () => false },
        { name: 'file2.txt', isFile: () => true, isDirectory: () => false },
        { name: 'file3.txt', isFile: () => true, isDirectory: () => false },
        { name: 'file.log', isFile: () => true, isDirectory: () => false }
      ]); // All subsequent calls return files

    south.sendFile = jest.fn();
    south.checkAge = jest
      .fn()
      // Second fileQuery - item2 (.log regex): file.log
      .mockReturnValueOnce(false) // file.log - too young
      // Second fileQuery - item3 (.txt regex): file.txt, file2.txt, file3.txt
      .mockReturnValueOnce(false) // file.txt - too young
      .mockReturnValueOnce(true) // file2.txt - OK
      .mockReturnValueOnce(true); // file3.txt - OK

    (fs.stat as jest.Mock).mockResolvedValue({ size: 100 });

    await south.fileQuery(configuration.items);

    expect(logger.trace).toHaveBeenCalledWith(`Reading "${path.resolve(configuration.settings.inputFolder)}" directory`);
    expect(fs.readdir).toHaveBeenCalledTimes(3); // Once for each of the 3 items
    expect(logger.debug).toHaveBeenCalledWith(`The folder "${path.resolve(configuration.settings.inputFolder)}" is empty`);

    await south.fileQuery(configuration.items);
    expect(logger.trace).toHaveBeenCalledWith(`Filtering with regex "${configuration.items[0].settings.regex}"`);
    expect(logger.debug).toHaveBeenCalledWith(
      `No file in "${path.resolve(configuration.settings.inputFolder)}" matches regex "${configuration.items[0].settings.regex}"`
    );

    expect(logger.trace).toHaveBeenCalledWith(`Filtering with regex "${configuration.items[1].settings.regex}"`);
    expect(logger.trace).toHaveBeenCalledWith(`1 files matching regex "${configuration.items[1].settings.regex}"`);
    expect(logger.debug).toHaveBeenCalledWith(`No file matches minimum age with regex "${configuration.items[1].settings.regex}"`);

    expect(logger.trace).toHaveBeenCalledWith(`Filtering with regex "${configuration.items[2].settings.regex}"`);
    expect(logger.trace).toHaveBeenCalledWith(`Sending 2 files`);
    expect(south.sendFile).toHaveBeenCalledTimes(2);
    expect(south.sendFile).toHaveBeenCalledWith(configuration.items[2], 'file2.txt', testData.constants.dates.FAKE_NOW);
    expect(south.sendFile).toHaveBeenCalledWith(configuration.items[2], 'file3.txt', testData.constants.dates.FAKE_NOW);
  });

  it('should properly check age', async () => {
    const mtimeMs = new Date(testData.constants.dates.FAKE_NOW).getTime();
    const timestamp = new Date().getTime();
    (fs.stat as jest.Mock).mockImplementationOnce(() => ({ mtimeMs })).mockImplementationOnce(() => ({ mtimeMs: mtimeMs - 10000 }));

    expect(await south.checkAge(configuration.items[0], 'myFile')).toEqual(false);
    expect(logger.trace).toHaveBeenCalledWith(
      `Check age condition: mT:${mtimeMs} + mA ${configuration.items[0].settings.minAge} < ts:${timestamp} ` +
        `= ${mtimeMs + configuration.items[0].settings.minAge < timestamp}`
    );

    expect(await south.checkAge(configuration.items[0], 'myFile')).toEqual(true);
    expect(logger.trace).toHaveBeenCalledWith('File "myFile" matches age');
  });

  it('should properly check age with preserve file', async () => {
    const mtimeMs = new Date(testData.constants.dates.FAKE_NOW).getTime();
    (fs.stat as jest.Mock).mockImplementation(() => ({ mtimeMs: mtimeMs - 10000 }));
    south.getModifiedTime = jest
      .fn()
      .mockReturnValueOnce(mtimeMs - 10000) // saved modified time same than mTime (mtimeMs - 10000) => file did not change
      .mockReturnValueOnce(mtimeMs - 999999); // saved modified time is more recent than mTime (mtimeMs - 999999) => file changed
    expect(await south.checkAge(configuration.items[1], 'myFile1')).toEqual(false);
    expect(await south.checkAge(configuration.items[1], 'myFile2')).toEqual(true);
    expect(logger.trace).toHaveBeenCalledWith(
      `File "myFile2" last modified time ${mtimeMs - 999999} is older than mtimeMs ${mtimeMs - 10000}. The file will be sent`
    );
  });

  it('should properly check age with preserve file and ignore modified date', async () => {
    const mtimeMs = new Date(testData.constants.dates.FAKE_NOW).getTime();
    (fs.stat as jest.Mock).mockImplementation(() => ({ mtimeMs: mtimeMs - 10000 }));
    south.getModifiedTime = jest
      .fn()
      .mockReturnValueOnce(mtimeMs - 10000) // saved modified time same than mTime (mtimeMs - 10000) => file did not change
      .mockReturnValueOnce(mtimeMs - 999999); // saved modified time is more recent than mTime (mtimeMs - 999999) => file changed
    expect(await south.checkAge(configuration.items[2], 'myFile1')).toEqual(true);
    expect(await south.checkAge(configuration.items[2], 'myFile2')).toEqual(true);
  });

  it('should properly send file', async () => {
    south.addContent = jest.fn();
    south.updateModifiedTime = jest.fn();
    (fs.unlink as jest.Mock)
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => {
        throw new Error('error');
      });
    await south.sendFile(configuration.items[0], 'myFile1', testData.constants.dates.DATE_1);

    expect(south.addContent).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(`Sending file "${path.resolve(configuration.settings.inputFolder, 'myFile1')}" to the engine`);
    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
    expect(south.updateModifiedTime).not.toHaveBeenCalled();

    await south.sendFile(configuration.items[0], 'myFile2', testData.constants.dates.DATE_1);
    expect(logger.info).toHaveBeenCalledWith(`Sending file "${path.resolve(configuration.settings.inputFolder, 'myFile2')}" to the engine`);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing "${path.resolve(configuration.settings.inputFolder, 'myFile2')}": ${new Error('error')}`
    );
  });

  it('should get modified time', () => {
    const item = configuration.items[0];
    (southCacheService.getItemLastValue as jest.Mock)
      .mockReturnValueOnce({ value: [{ filename: 'my file', modifiedTime: 1 }] })
      .mockReturnValueOnce(null);
    expect(south.getModifiedTime(item, 'my file')).toEqual(1);
    expect(south.getModifiedTime(item, 'my file')).toEqual(0);
    expect(southCacheService.getItemLastValue).toHaveBeenCalledWith(configuration.id, item.id);
  });

  it('should return 0 when filename is not in cache array', () => {
    const item = configuration.items[0];
    (southCacheService.getItemLastValue as jest.Mock).mockReturnValue({
      value: [{ filename: 'other.txt', modifiedTime: 1 }]
    });
    expect(south.getModifiedTime(item, 'requested.csv')).toEqual(0);
    expect(southCacheService.getItemLastValue).toHaveBeenCalledWith(configuration.id, item.id);
  });

  it('should return 0 when getModifiedTime value is not an array', () => {
    const item = configuration.items[0];
    (southCacheService.getItemLastValue as jest.Mock).mockReturnValue({ value: 42 });
    expect(south.getModifiedTime(item, 'any')).toEqual(0);
  });

  it('should update modified time', () => {
    const item = configuration.items[0];
    (southCacheService.getItemLastValue as jest.Mock).mockReturnValue(null);
    south.updateModifiedTime(item, 'my file', 1);
    expect(southCacheService.saveItemLastValue).toHaveBeenCalledWith(configuration.id, {
      itemId: item.id,
      queryTime: expect.any(String),
      value: [{ filename: 'my file', modifiedTime: 1 }],
      trackedInstant: null
    });
  });

  it('should update modified time for existing file entry', () => {
    const item = configuration.items[0];
    (southCacheService.getItemLastValue as jest.Mock).mockReturnValue({
      value: [{ filename: 'existing.txt', modifiedTime: 1000 }]
    });
    south.updateModifiedTime(item, 'existing.txt', 2000);
    expect(southCacheService.saveItemLastValue).toHaveBeenCalledWith(configuration.id, {
      itemId: item.id,
      queryTime: expect.any(String),
      value: [{ filename: 'existing.txt', modifiedTime: 2000 }],
      trackedInstant: null
    });
  });

  it('should reset files when updateModifiedTime value is not an array', () => {
    const item = configuration.items[0];
    (southCacheService.getItemLastValue as jest.Mock).mockReturnValue({ value: 42 });
    south.updateModifiedTime(item, 'new file', 1);
    expect(southCacheService.saveItemLastValue).toHaveBeenCalledWith(configuration.id, {
      itemId: item.id,
      queryTime: expect.any(String),
      value: [{ filename: 'new file', modifiedTime: 1 }],
      trackedInstant: null
    });
  });
});

describe('SouthFolderScanner with compression', () => {
  let south: SouthFolderScanner;
  const configuration: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'folder-scanner',
    description: 'my test connector',
    enabled: true,
    settings: {
      inputFolder: 'inputFolder',
      compression: true
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          regex: '.*.csv',
          preserveFiles: true,
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
        overlap: null
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          regex: '.*.log',
          preserveFiles: true,
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
        overlap: null
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          regex: '.*.txt',
          preserveFiles: true,
          ignoreModifiedDate: true,
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
        overlap: null
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    south = new SouthFolderScanner(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should properly send compressed file', async () => {
    const mtimeMs = new Date('2020-02-02T02:02:02.222Z').getTime();

    south.addContent = jest.fn();
    south.updateModifiedTime = jest.fn();
    (fs.unlink as jest.Mock)
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => {
        throw new Error('error');
      });
    (fs.stat as jest.Mock).mockImplementation(() => ({ mtimeMs }));
    await south.sendFile(configuration.items[1], 'myFile1', testData.constants.dates.FAKE_NOW);

    expect(logger.info).toHaveBeenCalledWith(`Sending file "${path.resolve(configuration.settings.inputFolder, 'myFile1')}" to the engine`);
    expect(compress).toHaveBeenCalledWith(
      path.resolve(configuration.settings.inputFolder, 'myFile1'),
      `${path.resolve('cacheFolder', 'tmp', 'myFile1')}.gz`
    );
    expect(south.addContent).toHaveBeenCalledWith(
      {
        type: 'any',
        filePath: `${path.resolve('cacheFolder', 'tmp', 'myFile1')}.gz`
      },
      testData.constants.dates.FAKE_NOW,
      [configuration.items[1].id]
    );
    expect(fs.unlink).toHaveBeenCalledWith(`${path.resolve('cacheFolder', 'tmp', 'myFile1')}.gz`);
    expect(logger.error).not.toHaveBeenCalled();
    expect(south.updateModifiedTime).toHaveBeenCalledWith(configuration.items[1], 'myFile1', mtimeMs);

    await south.sendFile(configuration.items[1], 'myFile2', testData.constants.dates.FAKE_NOW);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing compressed file "${path.resolve('cacheFolder', 'tmp', 'myFile2')}.gz": ${new Error('error')}`
    );

    (compress as jest.Mock).mockImplementationOnce(() => {
      throw new Error('compression error');
    });
    await south.sendFile(configuration.items[1], 'myFile2', testData.constants.dates.FAKE_NOW);
    expect(logger.error).toHaveBeenCalledWith(
      `Error compressing file "${path.resolve(configuration.settings.inputFolder, 'myFile2')}": compression error. Sending it raw instead.`
    );
  });

  it('Folder does not exist', async () => {
    const errorMessage = 'Folder does not exist';
    (fs.access as jest.Mock).mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });

    const accessRegex = new RegExp(`Folder ".*(${configuration.settings.inputFolder}).*" does not exist: ${errorMessage}`);
    await expect(south.testConnection()).rejects.toThrow(accessRegex);
  });

  it('No read/write access', async () => {
    const errorMessage = 'No read/write access';
    (fs.access as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error(errorMessage);
      });

    const accessRegex = new RegExp(`Read access error on ".*(${configuration.settings.inputFolder}).*": ${errorMessage}`);
    await expect(south.testConnection()).rejects.toThrow(accessRegex);
  });

  it('Not a directory', async () => {
    (fs.access as jest.Mock).mockImplementation(() => Promise.resolve());
    (fs.stat as jest.Mock).mockReturnValue({
      isDirectory: () => false
    });
    await expect(south.testConnection()).rejects.toThrow(`${path.resolve(configuration.settings.inputFolder)} is not a directory`);
  });

  it('should properly test connection', async () => {
    (fs.access as jest.Mock).mockImplementation(() => Promise.resolve());
    (fs.stat as jest.Mock).mockReturnValue({
      isDirectory: () => true
    });
    await south.testConnection();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should test item', async () => {
    south.testConnection = jest.fn();
    south.checkAge = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    fs.stat = jest.fn().mockReturnValueOnce({ mtimeMs: DateTime.now().toMillis() });
    fs.readdir = jest.fn().mockReturnValue(['file1.txt', 'file2.csv', 'file3.csv']);

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    expect(fs.readdir).toHaveBeenCalledTimes(1);
    expect(south.checkAge).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      type: 'time-values',
      content: [
        {
          pointId: configuration.items[0].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: { value: 'file2.csv' }
        }
      ]
    });
  });

  it('should test item and throw an error', async () => {
    south.testConnection = jest.fn();
    south.checkAge = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    fs.stat = jest.fn();
    const error = new Error('Cannot read directory');
    fs.readdir = jest.fn().mockRejectedValue(error);

    await expect(south.testItem(configuration.items[0], testData.south.itemTestingSettings)).rejects.toThrow(error);

    expect(south.testConnection).toHaveBeenCalledTimes(1);
    expect(fs.readdir).toHaveBeenCalledTimes(1);
    expect(south.checkAge).not.toHaveBeenCalled();
  });

  it('should respect max files limit', async () => {
    const configWithLimit: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings> = {
      ...configuration,
      settings: {
        inputFolder: 'inputFolder',
        compression: false
      },
      items: [
        ...configuration.items.map(item => ({
          ...item,
          settings: {
            ...item.settings,
            maxFiles: 2,
            maxSize: 0,
            recursive: false
          }
        }))
      ]
    };
    south = new SouthFolderScanner(configWithLimit, addContentCallback, southCacheRepository, logger, 'cacheFolder');

    (fs.readdir as jest.Mock).mockResolvedValue([
      { name: 'file1.csv', isFile: () => true, isDirectory: () => false },
      { name: 'file2.csv', isFile: () => true, isDirectory: () => false },
      { name: 'file3.csv', isFile: () => true, isDirectory: () => false }
    ]);

    south.sendFile = jest.fn();
    south.checkAge = jest.fn().mockReturnValue(true);
    (fs.stat as jest.Mock).mockReturnValue({ size: 100 });

    await south.fileQuery(configWithLimit.items);

    expect(south.sendFile).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Max files limit (2) reached'));
  });

  it('should respect max size limit', async () => {
    const configWithLimit: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings> = {
      ...configuration,
      settings: {
        inputFolder: 'inputFolder',
        compression: false
      },
      items: [
        ...configuration.items.map(item => ({
          ...item,
          settings: {
            ...item.settings,
            maxFiles: 0,
            maxSize: 1,
            recursive: false
          }
        }))
      ]
    };
    south = new SouthFolderScanner(configWithLimit, addContentCallback, southCacheRepository, logger, 'cacheFolder');

    (fs.readdir as jest.Mock).mockResolvedValue([
      { name: 'file1.csv', isFile: () => true, isDirectory: () => false },
      { name: 'file2.csv', isFile: () => true, isDirectory: () => false }
    ]);

    south.sendFile = jest.fn();
    south.checkAge = jest.fn().mockReturnValue(true);
    (fs.stat as jest.Mock)
      .mockReturnValueOnce({ size: 500 * 1024 }) // 500 KB
      .mockReturnValueOnce({ size: 600 * 1024 }); // 600 KB - should exceed 1MB limit

    await south.fileQuery(configWithLimit.items);

    expect(south.sendFile).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Max size limit (1 MB) reached'));
  });

  it('should stop file query when max files limit reached across items', async () => {
    const configWithLimit: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings> = {
      ...configuration,
      settings: {
        inputFolder: 'inputFolder',
        compression: false
      },
      items: [
        ...configuration.items.map(item => ({
          ...item,
          settings: {
            ...item.settings,
            maxFiles: 2,
            maxSize: 0,
            recursive: false
          }
        }))
      ]
    };
    south = new SouthFolderScanner(configWithLimit, addContentCallback, southCacheRepository, logger, 'cacheFolder');

    (fs.readdir as jest.Mock).mockResolvedValue([
      { name: 'file1.csv', isFile: () => true, isDirectory: () => false },
      { name: 'file2.csv', isFile: () => true, isDirectory: () => false },
      { name: 'file3.csv', isFile: () => true, isDirectory: () => false }
    ]);

    south.sendFile = jest.fn();
    south.checkAge = jest.fn().mockReturnValue(true);
    (fs.stat as jest.Mock).mockReturnValue({ size: 100 });

    await south.fileQuery(configWithLimit.items);

    expect(south.sendFile).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith('Max files limit (2) reached for item item1, skipping remaining files');
  });

  it('should stop file query when max size limit reached across items', async () => {
    const configWithLimit: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings> = {
      ...configuration,
      settings: {
        inputFolder: 'inputFolder',
        compression: false
      },
      items: [
        ...configuration.items.map(item => ({
          ...item,
          settings: {
            ...item.settings,
            maxFiles: 0,
            maxSize: 1,
            recursive: false
          }
        }))
      ]
    };
    south = new SouthFolderScanner(configWithLimit, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    await south.start();

    (fs.readdir as jest.Mock).mockReset();
    (fs.readdir as jest.Mock).mockResolvedValue([
      { name: 'file1.csv', isFile: () => true, isDirectory: () => false },
      { name: 'file2.csv', isFile: () => true, isDirectory: () => false },
      { name: 'file3.csv', isFile: () => true, isDirectory: () => false }
    ]);

    (fs.stat as jest.Mock).mockReset();
    (fs.stat as jest.Mock).mockReturnValue({ size: 512 * 1024, mtimeMs: Date.now() });

    south.sendFile = jest.fn();
    south.checkAge = jest.fn().mockReturnValue(true);

    await south.fileQuery(configWithLimit.items);

    expect(south.sendFile).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith('Max size limit (1 MB) reached for item item1, skipping remaining files');
  });

  it('should skip directory entries when recursive is false', async () => {
    const configNoRecursive: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings> = {
      ...configuration,
      settings: {
        inputFolder: 'inputFolder',
        compression: false
      },
      items: [
        ...configuration.items.map(item => ({
          ...item,
          settings: {
            ...item.settings,
            maxFiles: 0,
            maxSize: 0,
            recursive: false
          }
        }))
      ]
    };
    south = new SouthFolderScanner(configNoRecursive, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    await south.start();

    (fs.readdir as jest.Mock).mockReset();
    (fs.readdir as jest.Mock)
      .mockResolvedValueOnce([
        { name: 'subdir', isFile: () => false, isDirectory: () => true },
        { name: 'file1.csv', isFile: () => true, isDirectory: () => false }
      ])
      .mockResolvedValue([]); // Return empty for any recursive calls

    south.sendFile = jest.fn();
    south.checkAge = jest.fn().mockReturnValue(true);
    (fs.stat as jest.Mock).mockReset();
    (fs.stat as jest.Mock).mockReturnValue({ size: 100, mtimeMs: Date.now() });

    await south.fileQuery(configNoRecursive.items);

    expect(south.sendFile).toHaveBeenCalledTimes(1);
    expect(south.sendFile).toHaveBeenCalledWith(configNoRecursive.items[0], 'file1.csv', expect.any(String));
  });

  it('should scan recursively when enabled', async () => {
    const configWithRecursive: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings> = {
      ...configuration,
      settings: {
        inputFolder: 'inputFolder',
        compression: false
      },
      items: [
        ...configuration.items.map(item => ({
          ...item,
          settings: {
            ...item.settings,
            maxFiles: 0,
            maxSize: 0,
            recursive: true
          }
        }))
      ]
    };
    south = new SouthFolderScanner(configWithRecursive, addContentCallback, southCacheRepository, logger, 'cacheFolder');

    (fs.readdir as jest.Mock)
      .mockResolvedValueOnce([
        { name: 'file1.csv', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true }
      ])
      .mockResolvedValueOnce([{ name: 'file2.csv', isFile: () => true, isDirectory: () => false }]) // subdir contents
      .mockResolvedValue([]); // All subsequent calls (item2, item3) return empty

    south.sendFile = jest.fn();
    south.checkAge = jest.fn().mockReturnValue(true);
    (fs.stat as jest.Mock).mockReturnValue({ size: 100 });

    await south.fileQuery(configWithRecursive.items);

    // Item1: 2 readdir calls (root + subdir), 2 files sent
    // Item2 & Item3: 1 readdir call each (root), 0 files (empty)
    expect(south.sendFile).toHaveBeenCalledTimes(2); // Both files from item1
  });
});
