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
import HistoryQueryEngine from '../../engine/history-query-engine';
import HistoryQueryEngineMock from '../../tests/__mocks__/history-query-engine.mock';
import { flushPromises } from '../../tests/utils/test-utils';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DateTime } from 'luxon';

jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const historyQueryRepository: HistoryQueryRepository = new HistoryQueryRepositoryMock();
const dataStreamEngine: DataStreamEngine = new DataStreamEngineMock();
const historyQueryEngine: HistoryQueryEngine = new HistoryQueryEngineMock();

const fileList: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [
  {
    metadataFilename: 'file1.json',
    metadata: {
      contentFile: 'file1-123456.json',
      contentSize: 100,
      numberOfElement: 3,
      createdAt: testData.constants.dates.DATE_1,
      contentType: 'time-values',
      source: 'south',
      options: {}
    }
  },
  {
    metadataFilename: 'file2.json',
    metadata: {
      contentFile: 'file2-123456.json',
      contentSize: 100,
      numberOfElement: 4,
      createdAt: testData.constants.dates.DATE_2,
      contentType: 'time-values',
      source: 'south',
      options: {}
    }
  },
  {
    metadataFilename: 'file3.json',
    metadata: {
      contentFile: 'file3-123456.csv',
      contentSize: 100,
      numberOfElement: 0,
      createdAt: testData.constants.dates.DATE_3,
      contentType: 'raw',
      source: 'south',
      options: {}
    }
  },
  {
    metadataFilename: 'file4.json',
    metadata: {
      contentFile: 'file4-123456.json',
      contentSize: 100,
      numberOfElement: 6,
      createdAt: testData.constants.dates.FAKE_NOW,
      contentType: 'time-values',
      source: 'south',
      options: {}
    }
  },
  {
    metadataFilename: 'file5.json',
    metadata: {
      contentFile: 'file5-123456.csv',
      contentSize: 100,
      numberOfElement: 0,
      createdAt: testData.constants.dates.FAKE_NOW,
      contentType: 'raw',
      source: 'south',
      options: {}
    }
  },
  {
    metadataFilename: 'file6.json',
    metadata: {
      contentFile: 'file6-123456.json',
      contentSize: 100,
      numberOfElement: 9,
      createdAt: testData.constants.dates.FAKE_NOW,
      contentType: 'time-values',
      source: 'south',
      options: {}
    }
  }
];

describe('CacheService', () => {
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
      dataStreamEngine,
      historyQueryEngine
    );
  });

  it('should trigger cleanup method', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    service.scanMainFolder = jest.fn();
    await service.start();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(`Cleaning up data folder...`);
    expect(service.scanMainFolder).toHaveBeenCalledTimes(3);
    expect(service.scanMainFolder).toHaveBeenCalledWith('cache');
    expect(service.scanMainFolder).toHaveBeenCalledWith('error');
    expect(service.scanMainFolder).toHaveBeenCalledWith('archive');
    jest.advanceTimersByTime(3600 * 1000); // trigger next cleanup
    await flushPromises();
    expect(service.scanMainFolder).toHaveBeenCalledTimes(6);

    await service.start();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

    await service.stop();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    await service.stop();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
  });

  it('should manage clean up error', async () => {
    service.scanMainFolder = jest.fn().mockImplementationOnce(() => {
      throw new Error('clean up error');
    });
    await service.cleanup();
    expect(logger.error).toHaveBeenCalledWith('Data folder clean up error: clean up error');
  });

  it('should use another logger', async () => {
    service.setLogger(anotherLogger);
    (logger.debug as jest.Mock).mockClear();
    service.scanMainFolder = jest.fn();
    await service.start();
    expect(anotherLogger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('should get id from folder', () => {
    expect(service['getFolderId']('')).toEqual(null);
    expect(service['getFolderId']('folder')).toEqual(null);
    expect(service['getFolderId']('folder-id')).toEqual('id');
    expect(service['getFolderId']('folder-id-test')).toEqual('id-test');
  });

  it('should clean up cache folder', async () => {
    service['readCacheMetadataFiles'] = jest.fn().mockReturnValue([]);
    (fs.readdir as jest.Mock).mockReturnValueOnce([
      'cache.db',
      'south-id1',
      'south-id2',
      'south-bad-south',
      'north-id3',
      'north-id4',
      'north-bad-north',
      'history-id5',
      'history-id6',
      'history-bad-history'
    ]);
    (southConnectorRepository.findSouthById as jest.Mock)
      .mockReturnValueOnce(testData.south.list[0])
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);
    (northConnectorRepository.findNorthById as jest.Mock)
      .mockReturnValueOnce(testData.north.list[0])
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);
    (historyQueryRepository.findHistoryQueryById as jest.Mock)
      .mockReturnValueOnce(testData.historyQueries.list[0])
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);

    (fs.rm as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error(`south rm error`);
      })
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error(`north rm error`);
      })
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error(`history rm error`);
      });

    await service.scanMainFolder('cache');

    expect(southConnectorRepository.findSouthById).toHaveBeenCalledTimes(3);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith('id1');
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith('id2');
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith('bad-south');
    expect(logger.debug).toHaveBeenCalledWith(`Folder "south-id2" not associated to a South connector. Removing it.`);
    expect(logger.debug).toHaveBeenCalledWith(`Folder "south-bad-south" not associated to a South connector. Removing it.`);
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('baseFolder', 'cache', 'south-id2'), { force: true, recursive: true });
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('baseFolder', 'cache', 'south-bad-south'), { force: true, recursive: true });
    expect(logger.error).toHaveBeenCalledWith(
      `Could not remove "${path.resolve('baseFolder', 'cache', 'south-bad-south')}": south rm error`
    );

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledTimes(3);
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith('id3');
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith('id4');
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith('bad-north');
    expect(logger.debug).toHaveBeenCalledWith(`Folder "north-id4" not associated to a North connector. Removing it.`);
    expect(logger.debug).toHaveBeenCalledWith(`Folder "north-bad-north" not associated to a North connector. Removing it.`);
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('baseFolder', 'cache', 'north-id4'), { force: true, recursive: true });
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('baseFolder', 'cache', 'north-bad-north'), { force: true, recursive: true });
    expect(logger.error).toHaveBeenCalledWith(
      `Could not remove "${path.resolve('baseFolder', 'cache', 'north-bad-north')}": north rm error`
    );

    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledTimes(3);
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith('id5');
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith('id6');
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith('bad-history');
    expect(logger.debug).toHaveBeenCalledWith(`Folder "history-id6" not associated to a History query. Removing it.`);
    expect(logger.debug).toHaveBeenCalledWith(`Folder "history-bad-history" not associated to a History query. Removing it.`);
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('baseFolder', 'cache', 'history-id6'), { force: true, recursive: true });
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('baseFolder', 'cache', 'history-bad-history'), { force: true, recursive: true });
    expect(logger.error).toHaveBeenCalledWith(
      `Could not remove "${path.resolve('baseFolder', 'cache', 'history-bad-history')}": history rm error`
    );
  });

  it('should clean up archive folder', async () => {
    service['shouldDeleteFile'] = jest.fn().mockReturnValue(true);
    service['readCacheMetadataFiles'] = jest.fn().mockReturnValue(fileList);
    (fs.readdir as jest.Mock).mockReturnValueOnce(['north-id1', 'north-id2', 'north-id3', 'history-id4', 'history-id5', 'history-id6']);

    (northConnectorRepository.findNorthById as jest.Mock)
      .mockReturnValueOnce({ id: 'id1', caching: { archive: { enabled: false } } })
      .mockReturnValueOnce({ id: 'id2', caching: { archive: { enabled: true, retentionDuration: 1 } } })
      .mockReturnValueOnce({ id: 'id3', caching: { archive: { enabled: true, retentionDuration: 0 } } });
    (historyQueryRepository.findHistoryQueryById as jest.Mock)
      .mockReturnValueOnce({ id: 'id4', caching: { archive: { enabled: false } } })
      .mockReturnValueOnce({ id: 'id5', caching: { archive: { enabled: true, retentionDuration: 1 } } })
      .mockReturnValueOnce({ id: 'id6', caching: { archive: { enabled: true, retentionDuration: 0 } } });

    await service.scanMainFolder('archive');

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledTimes(3);
    expect(dataStreamEngine.removeCacheContent).toHaveBeenCalledTimes(2);
    expect(dataStreamEngine.removeCacheContent).toHaveBeenCalledWith(
      'id1',
      'archive',
      fileList.map(file => file.metadataFilename)
    );
    expect(dataStreamEngine.removeCacheContent).toHaveBeenCalledWith(
      'id2',
      'archive',
      fileList.map(file => file.metadataFilename)
    );
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledTimes(3);
    expect(historyQueryEngine.removeCacheContent).toHaveBeenCalledTimes(2);
    expect(historyQueryEngine.removeCacheContent).toHaveBeenCalledWith(
      'id4',
      'archive',
      fileList.map(file => file.metadataFilename)
    );
    expect(historyQueryEngine.removeCacheContent).toHaveBeenCalledWith(
      'id5',
      'archive',
      fileList.map(file => file.metadataFilename)
    );
  });

  it('should clean up error folder', async () => {
    service['shouldDeleteFile'] = jest.fn().mockReturnValue(true);
    service['readCacheMetadataFiles'] = jest.fn().mockReturnValue(fileList);
    (fs.readdir as jest.Mock).mockReturnValueOnce(['north-id1', 'north-id2', 'history-id3', 'history-id4']);

    (northConnectorRepository.findNorthById as jest.Mock)
      .mockReturnValueOnce({ id: 'id1', caching: { error: { retentionDuration: 1 } } })
      .mockReturnValueOnce({ id: 'id2', caching: { error: { retentionDuration: 0 } } });
    (historyQueryRepository.findHistoryQueryById as jest.Mock)

      .mockReturnValueOnce({ id: 'id3', caching: { error: { retentionDuration: 1 } } })
      .mockReturnValueOnce({ id: 'id4', caching: { error: { retentionDuration: 0 } } });

    await service.scanMainFolder('error');

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledTimes(2);
    expect(service['readCacheMetadataFiles']).toHaveBeenCalledTimes(4);
    expect(service['readCacheMetadataFiles']).toHaveBeenCalledWith(path.resolve('baseFolder', 'error', 'north-id1'));
    expect(service['readCacheMetadataFiles']).toHaveBeenCalledWith(path.resolve('baseFolder', 'error', 'north-id2'));
    expect(dataStreamEngine.removeCacheContent).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.removeCacheContent).toHaveBeenCalledWith(
      'id1',
      'error',
      fileList.map(file => file.metadataFilename)
    );
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledTimes(2);
    expect(service['readCacheMetadataFiles']).toHaveBeenCalledWith(path.resolve('baseFolder', 'error', 'history-id3', 'north'));
    expect(service['readCacheMetadataFiles']).toHaveBeenCalledWith(path.resolve('baseFolder', 'error', 'history-id4', 'north'));
    expect(historyQueryEngine.removeCacheContent).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.removeCacheContent).toHaveBeenCalledWith(
      'id3',
      'error',
      fileList.map(file => file.metadataFilename)
    );
  });

  it('should delete file', () => {
    expect(
      service['shouldDeleteFile'](
        { metadataFilename: 'file', metadata: { createdAt: testData.constants.dates.FAKE_NOW } as CacheMetadata },
        1
      )
    ).toBeFalsy(); // retention of 1 hr and createdAt set at NOW

    expect(
      service['shouldDeleteFile'](
        { metadataFilename: 'file', metadata: { createdAt: testData.constants.dates.DATE_1 } as CacheMetadata },
        1
      )
    ).toBeTruthy(); // retention of 1 hr and createdAt set at DATE_1 (very older)

    expect(
      service['shouldDeleteFile'](
        {
          metadataFilename: 'file',
          metadata: { createdAt: DateTime.fromISO(testData.constants.dates.FAKE_NOW).minus({ hour: 1 }).toUTC().toISO() } as CacheMetadata
        },
        1
      )
    ).toBeTruthy(); // retention of 1 hr and createdAt set at exactly NOW - 1 hr
  });

  it('should return empty array when cache metadata files fails', async () => {
    (fs.readdir as jest.Mock).mockImplementationOnce(() => {
      throw new Error('read error');
    });
    const result = await service['readCacheMetadataFiles']('folder');
    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(`Could not read cache metadata files from folder "folder": read error`);
  });

  it('should read cache metadata files', async () => {
    (fs.readdir as jest.Mock).mockReturnValueOnce([
      fileList[0].metadataFilename,
      fileList[1].metadataFilename,
      fileList[2].metadataFilename
    ]);
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(fileList[0].metadata)).mockReturnValueOnce('o').mockReturnValueOnce('o');
    (fs.rm as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('remove error');
      });
    const result = await service['readCacheMetadataFiles']('folder');
    expect(result).toEqual([fileList[0]]);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${path.join('folder', 'metadata', fileList[1].metadataFilename)}": Unexpected token 'o', "o" is not valid JSON`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${path.join('folder', 'metadata', fileList[2].metadataFilename)}": Unexpected token 'o', "o" is not valid JSON`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing file "${path.join('folder', 'metadata', fileList[2].metadataFilename)}": remove error`
    );
  });
});
