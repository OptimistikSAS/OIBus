import fs from 'node:fs/promises';
import path from 'node:path';

import SouthFolderScanner from './south-folder-scanner';

import { compress } from '../../service/utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { SouthFolderScannerItemSettings, SouthFolderScannerSettings } from '../../../../shared/model/south-settings.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthConnectorMetricsRepository from '../../repository/logs/south-connector-metrics.repository';
import NorthMetricsRepositoryMock from '../../tests/__mocks__/repository/log/north-metrics-repository.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import SouthConnectorMetricsServiceMock from '../../tests/__mocks__/service/south-connector-metrics-service.mock';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import testData from '../../tests/utils/test-data';

jest.mock('node:fs/promises');
jest.mock('../../service/utils');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southMetricsRepository: SouthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();
const southConnectorMetricsService = new SouthConnectorMetricsServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);

jest.mock(
  '../../service/south-connector-metrics.service',
  () =>
    function () {
      return southConnectorMetricsService;
    }
);

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

describe('SouthFolderScanner', () => {
  let south: SouthFolderScanner;
  const configuration: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    sharedConnection: false,
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
          minAge: 1000
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          regex: '.*.log',
          preserveFiles: true,
          ignoreModifiedDate: false,
          minAge: 1000
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          regex: '.*.txt',
          preserveFiles: true,
          ignoreModifiedDate: true,
          minAge: 1000
        },
        scanModeId: 'scanModeId1'
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthFolderScanner(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder'
    );
    await south.start();
  });

  it('fileQuery should manage file query', async () => {
    (fs.readdir as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() => Promise.resolve(['file.txt', 'file2.txt', 'file3.txt', 'file.log']));

    south.sendFile = jest.fn();
    south.checkAge = jest
      .fn()
      .mockImplementationOnce(() => false)
      .mockImplementationOnce(() => false)
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => true);

    await south.fileQuery(configuration.items);

    expect(logger.trace).toHaveBeenCalledWith(`Reading "${path.resolve(configuration.settings.inputFolder)}" directory`);
    expect(fs.readdir).toHaveBeenCalledTimes(1);
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
    expect(south.sendFile).toHaveBeenCalledWith(configuration.items[2], 'file2.txt');
    expect(south.sendFile).toHaveBeenCalledWith(configuration.items[2], 'file3.txt');
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
    await south.sendFile(configuration.items[0], 'myFile1');

    expect(south.addContent).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(`Sending file "${path.resolve(configuration.settings.inputFolder, 'myFile1')}" to the engine`);
    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
    expect(south.updateModifiedTime).not.toHaveBeenCalled();

    await south.sendFile(configuration.items[0], 'myFile2');
    expect(logger.info).toHaveBeenCalledWith(`Sending file "${path.resolve(configuration.settings.inputFolder, 'myFile2')}" to the engine`);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing "${path.resolve(configuration.settings.inputFolder, 'myFile2')}": ${new Error('error')}`
    );
  });

  it('should get modified time', () => {
    (southCacheService.getQueryOnCustomTable as jest.Mock).mockReturnValueOnce({ mtimeMs: '1' }).mockReturnValueOnce(null);
    expect(south.getModifiedTime('my file')).toEqual(1);
    expect(south.getModifiedTime('my file')).toEqual(0);
    expect(southCacheService.getQueryOnCustomTable).toHaveBeenCalledWith(
      `SELECT mtime_ms AS mtimeMs FROM "folder_scanner_${configuration.id}" WHERE filename = ?`,
      ['my file']
    );
  });

  it('should update modified time', () => {
    south.updateModifiedTime('my file', 1);
    expect(southCacheService.runQueryOnCustomTable).toHaveBeenCalledWith(
      `INSERT INTO "folder_scanner_${configuration.id}" (filename, mtime_ms) VALUES (?, ?) ON CONFLICT(filename) DO UPDATE SET mtime_ms = ?`,
      ['my file', 1, 1]
    );
  });
});

describe('SouthFolderScanner with compression', () => {
  let south: SouthFolderScanner;
  const configuration: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    sharedConnection: false,
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
          minAge: 1000
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          regex: '.*.log',
          preserveFiles: true,
          ignoreModifiedDate: false,
          minAge: 1000
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          regex: '.*.txt',
          preserveFiles: true,
          ignoreModifiedDate: true,
          minAge: 1000
        },
        scanModeId: 'scanModeId1'
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthFolderScanner(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder'
    );
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
    await south.sendFile(configuration.items[1], 'myFile1');

    expect(logger.info).toHaveBeenCalledWith(`Sending file "${path.resolve(configuration.settings.inputFolder, 'myFile1')}" to the engine`);
    expect(compress).toHaveBeenCalledWith(
      path.resolve(configuration.settings.inputFolder, 'myFile1'),
      `${path.resolve('baseFolder', 'tmp', 'myFile1')}.gz`
    );
    expect(south.addContent).toHaveBeenCalledWith({ type: 'raw', filePath: `${path.resolve('baseFolder', 'tmp', 'myFile1')}.gz` });
    expect(fs.unlink).toHaveBeenCalledWith(`${path.resolve('baseFolder', 'tmp', 'myFile1')}.gz`);
    expect(logger.error).not.toHaveBeenCalled();
    expect(south.updateModifiedTime).toHaveBeenCalledWith('myFile1', mtimeMs);

    await south.sendFile(configuration.items[1], 'myFile2');
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing compressed file "${path.resolve('baseFolder', 'tmp', 'myFile2')}.gz": ${new Error('error')}`
    );

    (compress as jest.Mock).mockImplementationOnce(() => {
      throw new Error('compression error');
    });
    await south.sendFile(configuration.items[1], 'myFile2');
    expect(logger.error).toHaveBeenCalledWith(
      `Error compressing file "${path.resolve(configuration.settings.inputFolder, 'myFile2')}". Sending it raw instead.`
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
    const callback = jest.fn();
    south.testConnection = jest.fn();
    south.checkAge = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    fs.stat = jest.fn();
    fs.readdir = jest.fn().mockReturnValue(['file1.txt', 'file2.csv', 'file3.csv']);

    await south.testItem(configuration.items[0], callback);
    expect(fs.readdir).toHaveBeenCalledTimes(1);
    expect(south.checkAge).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith({
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
});
