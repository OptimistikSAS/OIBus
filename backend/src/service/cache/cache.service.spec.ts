import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createFolder } from '../utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';

import { flushPromises, mockBaseFolders } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import CacheService from './cache.service';
import { CacheMetadata } from '../../../shared/model/engine.model';

jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

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
  let service: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    service = new CacheService(
      logger,
      mockBaseFolders('northId').cache,
      mockBaseFolders('northId').error,
      mockBaseFolders('northId').archive
    );
  });

  afterEach(() => {
    service.cacheSizeEventEmitter.removeAllListeners(); // Cleanup to prevent memory leaks
  });

  it('should be properly initialized with files in cache', async () => {
    (fs.readdir as jest.Mock)
      .mockImplementationOnce(() => ['file1', 'file2', 'bad'])
      .mockImplementationOnce(() => ['file3', 'file4', 'bad'])
      .mockImplementationOnce(() => ['file5', 'file6', 'bad']);
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => JSON.stringify(fileList[0].metadata))
      .mockImplementationOnce(() => JSON.stringify(fileList[1].metadata))
      .mockImplementationOnce(() => {
        throw new Error('error 1');
      })
      .mockImplementationOnce(() => JSON.stringify(fileList[2].metadata))
      .mockImplementationOnce(() => JSON.stringify(fileList[3].metadata))
      .mockImplementationOnce(() => {
        throw new Error('error 2');
      })
      .mockImplementationOnce(() => JSON.stringify(fileList[4].metadata))
      .mockImplementationOnce(() => JSON.stringify(fileList[5].metadata))
      .mockImplementationOnce(() => {
        throw new Error('error 3');
      });
    await service.start();
    expect(createFolder).toHaveBeenCalledWith(path.join(mockBaseFolders('northId').cache, service.METADATA_FOLDER));
    expect(createFolder).toHaveBeenCalledWith(path.join(mockBaseFolders('northId').cache, service.CONTENT_FOLDER));
    expect(createFolder).toHaveBeenCalledWith(path.join(mockBaseFolders('northId').error, service.METADATA_FOLDER));
    expect(createFolder).toHaveBeenCalledWith(path.join(mockBaseFolders('northId').error, service.CONTENT_FOLDER));
    expect(createFolder).toHaveBeenCalledWith(path.join(mockBaseFolders('northId').archive, service.METADATA_FOLDER));
    expect(createFolder).toHaveBeenCalledWith(path.join(mockBaseFolders('northId').archive, service.CONTENT_FOLDER));

    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading cache file "${path.join(mockBaseFolders('northId').cache, service.METADATA_FOLDER, 'bad')}": error 1`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading errored file "${path.join(mockBaseFolders('northId').error, service.METADATA_FOLDER, 'bad')}": error 2`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading archived file "${path.join(mockBaseFolders('northId').archive, service.METADATA_FOLDER, 'bad')}": error 3`
    );
    expect(logger.info).toHaveBeenCalledWith('2 content in cache');
    expect(logger.warn).toHaveBeenCalledWith('3 content errored');
    expect(logger.debug).toHaveBeenCalledWith('3 content archived');
  });

  it('should be properly initialized without files in cache', async () => {
    (fs.readdir as jest.Mock)
      .mockImplementationOnce(() => [])
      .mockImplementationOnce(() => [])
      .mockImplementationOnce(() => []);

    await service.start();

    expect(logger.debug).toHaveBeenCalledWith('No content in cache');
    expect(logger.debug).toHaveBeenCalledWith('No content errored');
    expect(logger.debug).toHaveBeenCalledWith('No content archived');
  });

  it('should add, get and remove element in queue', async () => {
    const element = { metadataFilename: 'file.json', metadata: { contentType: 'raw', source: 'south', options: {} } as CacheMetadata };
    expect(service.cacheIsEmpty()).toBeTruthy();
    service.addCacheContentToQueue(element);
    expect(service.cacheIsEmpty()).toBeFalsy();
    const firstQueueElement = await service.getCacheContentToSend(0);
    expect(firstQueueElement).toEqual(element);
    service.removeCacheContentFromQueue(element);
    expect(service.cacheIsEmpty()).toBeTruthy();
    service.removeCacheContentFromQueue(element);
    expect(service.cacheIsEmpty()).toBeTruthy();
    const noElementInQueue = await service.getCacheContentToSend(0);
    expect(noElementInQueue).toEqual(null);
  });

  it('should search cache content', async () => {
    (fs.readdir as jest.Mock).mockReturnValueOnce(fileList.map(element => element.metadataFilename));
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => JSON.stringify(fileList[0].metadata))
      .mockImplementationOnce(() => JSON.stringify(fileList[1].metadata))
      .mockImplementationOnce(() => JSON.stringify(fileList[2].metadata))
      .mockImplementationOnce(() => {
        throw new Error('read error1');
      })
      .mockImplementationOnce(() => {
        throw new Error('read error2');
      });
    (fs.unlink as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('unlink error');
      });
    const result = await service.searchCacheContent(
      {
        start: testData.constants.dates.DATE_1,
        end: testData.constants.dates.DATE_2,
        nameContains: 'file'
      },
      'cache'
    );

    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[3].metadataFilename)}": read error1`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[4].metadataFilename)}": read error2`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing file "${path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[4].metadataFilename)}": unlink error`
    );
    expect(result).toEqual([fileList[0], fileList[1]]);
  });

  it('should search cache content without filter', async () => {
    (fs.readdir as jest.Mock).mockReturnValueOnce([fileList[0].metadataFilename]);
    (fs.readFile as jest.Mock).mockImplementationOnce(() => JSON.stringify(fileList[0].metadata));
    const result = await service.searchCacheContent({ start: null, end: null, nameContains: null }, 'cache');

    expect(result).toEqual([fileList[0]]);
  });

  it('should get cache content from file list', async () => {
    (fs.readdir as jest.Mock).mockReturnValueOnce([fileList[0].metadataFilename, fileList[1].metadataFilename]);
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => JSON.stringify(fileList[0].metadata))
      .mockImplementationOnce(() => JSON.stringify(fileList[1].metadata));

    const result = await service.metadataFileListToCacheContentList('archive', [
      fileList[0].metadataFilename,
      fileList[1].metadataFilename
    ]);
    expect(result).toEqual([fileList[0], fileList[1]]);
  });

  it('should get cache content file stream', async () => {
    (createReadStream as jest.Mock).mockReturnValueOnce(null);
    (fs.stat as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('file does not exists');
      });

    expect(await service.getCacheContentFileStream('error', 'test')).toEqual(null);
    expect(logger.error).not.toHaveBeenCalled();
    expect(createReadStream).toHaveBeenCalledWith(path.join(service.errorFolder, service.CONTENT_FOLDER, 'test'));
    expect(await service.getCacheContentFileStream('error', 'test')).toEqual(null);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${path.join(service.errorFolder, service.CONTENT_FOLDER, 'test')}": file does not exists`
    );
    expect(createReadStream).toHaveBeenCalledTimes(1);
    expect(fs.stat).toHaveBeenCalledTimes(2);
  });

  it('should not get cache content file stream if bad full path', async () => {
    (createReadStream as jest.Mock).mockReturnValueOnce(null);

    expect(await service.getCacheContentFileStream('error', path.join('..', 'test'))).toEqual(null);
    expect(createReadStream).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      `Invalid file path "${path.resolve(service.errorFolder, 'test')}" when retrieving cache content file stream`
    );
  });

  it('should properly remove cache content', async () => {
    service.removeCacheContentFromQueue = jest.fn();

    await service.removeCacheContent('cache', fileList[0]);
    expect(service.removeCacheContentFromQueue).toHaveBeenCalledWith(fileList[0]);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(fs.unlink).toHaveBeenCalledWith(path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[0].metadataFilename));
    expect(fs.unlink).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[0].metadata.contentFile));

    expect(logger.trace).toHaveBeenCalledWith(
      `Files "${fileList[0].metadataFilename}" and "${fileList[0].metadata.contentFile}" removed from cache`
    );
  });

  it('should not remove cache content in case of error', async () => {
    (fs.unlink as jest.Mock).mockImplementationOnce(() => {
      throw new Error('unlink error');
    });

    service.removeCacheContentFromQueue = jest.fn();

    await service.removeCacheContent('error', fileList[0]);
    expect(service.removeCacheContentFromQueue).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalledTimes(1);

    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing files "${fileList[0].metadataFilename}" and "${fileList[0].metadata.contentFile}" from error: unlink error`
    );
  });

  it('should remove all cache content', async () => {
    service.removeCacheContent = jest.fn();
    service['readCacheMetadataFiles'] = jest.fn().mockReturnValueOnce(fileList);

    await service.removeAllCacheContent('cache');
    expect(service.removeCacheContent).toHaveBeenCalledTimes(fileList.length);
  });

  it('should properly move cache content', async () => {
    (fs.rename as jest.Mock).mockImplementationOnce(() => Promise.resolve()).mockImplementationOnce(() => Promise.resolve());
    service.removeCacheContentFromQueue = jest.fn();

    await service.moveCacheContent('cache', 'error', fileList[0]);
    expect(service.removeCacheContentFromQueue).toHaveBeenCalledWith(fileList[0]);
    expect(fs.rename).toHaveBeenCalledTimes(2);
    expect(fs.rename).toHaveBeenCalledWith(
      path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[0].metadataFilename),
      path.join(service.errorFolder, service.METADATA_FOLDER, fileList[0].metadataFilename)
    );
    expect(fs.rename).toHaveBeenCalledWith(
      path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[0].metadata.contentFile),
      path.join(service.errorFolder, service.CONTENT_FOLDER, fileList[0].metadata.contentFile)
    );

    expect(logger.trace).toHaveBeenCalledWith(
      `Files "${fileList[0].metadataFilename}" and "${fileList[0].metadata.contentFile}" moved from cache to error`
    );
  });

  it('should not move cache content in case of error', async () => {
    (fs.rename as jest.Mock).mockImplementationOnce(() => {
      throw new Error('rename error');
    });

    service.removeCacheContentFromQueue = jest.fn();

    await service.moveCacheContent('error', 'archive', fileList[0]);
    expect(service.removeCacheContentFromQueue).not.toHaveBeenCalled();
    expect(fs.rename).toHaveBeenCalledTimes(1);

    expect(logger.error).toHaveBeenCalledWith(
      `Error while moving files "${fileList[0].metadataFilename}" and "${fileList[0].metadata.contentFile}" from error to archive: rename error`
    );
  });

  it('should move all cache content', async () => {
    service.moveCacheContent = jest.fn();
    service['readCacheMetadataFiles'] = jest.fn().mockReturnValueOnce(fileList);

    await service.moveAllCacheContent('cache', 'archive');
    expect(service.moveCacheContent).toHaveBeenCalledTimes(fileList.length);
  });

  it('should properly change logger', async () => {
    (fs.readdir as jest.Mock).mockReturnValue([]);
    service.setLogger(anotherLogger);
    await service.start();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(anotherLogger.debug).toHaveBeenCalledWith(`No content in cache`);
    expect(anotherLogger.debug).toHaveBeenCalledWith(`No content errored`);
    expect(anotherLogger.debug).toHaveBeenCalledWith(`No content archived`);
  });

  it('should properly compact queue with max group count', async () => {
    for (const element of fileList) {
      service.addCacheContentToQueue(element);
    }
    (fs.readFile as jest.Mock)
      .mockReturnValueOnce(JSON.stringify(new Array(3).fill({})))
      .mockReturnValueOnce(JSON.stringify(new Array(4).fill({})))
      .mockReturnValueOnce(JSON.stringify(new Array(6).fill({})));

    (fs.stat as jest.Mock).mockReturnValue({ size: 100 });

    await service.compactQueue(10, 'time-values');
    expect(fs.readFile).toHaveBeenCalledTimes(3);
    expect(fs.readFile).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[0].metadata.contentFile), {
      encoding: 'utf-8'
    });
    expect(fs.readFile).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[1].metadata.contentFile), {
      encoding: 'utf-8'
    });
    expect(fs.readFile).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[3].metadata.contentFile), {
      encoding: 'utf-8'
    });

    expect(fs.stat).toHaveBeenCalledTimes(2);
    expect(fs.writeFile).toHaveBeenCalledTimes(4);
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[0].metadata.contentFile),
      JSON.stringify(new Array(10).fill({})),
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );
    expect(fs.stat).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[0].metadata.contentFile));
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[0].metadataFilename),
      JSON.stringify({
        contentFile: fileList[0].metadata.contentFile,
        contentSize: 100,
        numberOfElement: 10,
        createdAt: fileList[0].metadata.createdAt,
        contentType: fileList[0].metadata.contentType,
        source: 'south',
        options: {}
      }),
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[3].metadata.contentFile),
      JSON.stringify(new Array(3).fill({})),
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );
    expect(fs.stat).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[3].metadata.contentFile));

    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(fs.unlink).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[1].metadata.contentFile));
    expect(fs.unlink).toHaveBeenCalledWith(path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[1].metadataFilename));

    const result = service['queue'];
    expect(result[0]).toEqual({
      metadataFilename: 'file1.json',
      metadata: {
        contentFile: 'file1-123456.json',
        contentSize: 100,
        numberOfElement: 10,
        createdAt: testData.constants.dates.DATE_1,
        contentType: 'time-values',
        source: 'south',
        options: {}
      }
    });
    expect(result[1]).toEqual({
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
    });
    expect(result[2]).toEqual({
      metadataFilename: 'file4.json',
      metadata: {
        contentFile: 'file4-123456.json',
        contentSize: 100,
        numberOfElement: 3,
        createdAt: testData.constants.dates.FAKE_NOW,
        contentType: 'time-values',
        source: 'south',
        options: {}
      }
    });
    expect(result[3]).toEqual({
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
    });
    expect(result[4]).toEqual({
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
    });
    expect(result.length).toEqual(5);
    expect(service.getNumberOfElementsInQueue()).toEqual(22);
    expect(service.getNumberOfRawFilesInQueue()).toEqual(2);
  });

  it('should properly compact queue without max group count', async () => {
    for (const element of fileList) {
      service.addCacheContentToQueue(element);
    }
    (fs.readFile as jest.Mock)
      .mockReturnValueOnce(JSON.stringify(new Array(3).fill({})))
      .mockReturnValueOnce(JSON.stringify(new Array(4).fill({})))
      .mockReturnValueOnce(JSON.stringify(new Array(6).fill({})))
      .mockReturnValueOnce(JSON.stringify(new Array(9).fill({})));

    (fs.stat as jest.Mock).mockReturnValue({ size: 100 });

    await service.compactQueue(0, 'time-values');
    expect(fs.readFile).toHaveBeenCalledTimes(4);
    expect(fs.readFile).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[0].metadata.contentFile), {
      encoding: 'utf-8'
    });
    expect(fs.readFile).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[1].metadata.contentFile), {
      encoding: 'utf-8'
    });
    expect(fs.readFile).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[3].metadata.contentFile), {
      encoding: 'utf-8'
    });
    expect(fs.readFile).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[5].metadata.contentFile), {
      encoding: 'utf-8'
    });

    expect(fs.stat).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[0].metadata.contentFile),
      JSON.stringify(new Array(22).fill({})),
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );
    expect(fs.stat).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[0].metadata.contentFile));
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[0].metadataFilename),
      JSON.stringify({
        contentFile: fileList[0].metadata.contentFile,
        contentSize: 100,
        numberOfElement: 22,
        createdAt: fileList[0].metadata.createdAt,
        contentType: fileList[0].metadata.contentType,
        source: 'south',
        options: {}
      }),
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );

    expect(fs.unlink).toHaveBeenCalledTimes(6);
    expect(fs.unlink).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[1].metadata.contentFile));
    expect(fs.unlink).toHaveBeenCalledWith(path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[1].metadataFilename));
    expect(fs.unlink).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[3].metadata.contentFile));
    expect(fs.unlink).toHaveBeenCalledWith(path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[3].metadataFilename));
    expect(fs.unlink).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[5].metadata.contentFile));
    expect(fs.unlink).toHaveBeenCalledWith(path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[5].metadataFilename));

    const result = service['queue'];
    expect(result[0]).toEqual({
      metadataFilename: 'file1.json',
      metadata: {
        contentFile: 'file1-123456.json',
        contentSize: 100,
        numberOfElement: 22,
        createdAt: testData.constants.dates.DATE_1,
        contentType: 'time-values',
        source: 'south',
        options: {}
      }
    });
    expect(result[1]).toEqual({
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
    });
    expect(result[2]).toEqual({
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
    });
    expect(result.length).toEqual(3);

    expect(service.getNumberOfElementsInQueue()).toEqual(22);
  });

  it('should wait for compact queue to finish', async () => {
    for (const element of fileList) {
      service.addCacheContentToQueue(element);
    }
    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify([{}]));
    (fs.stat as jest.Mock).mockReturnValue({ size: 100 });
    (fs.readdir as jest.Mock).mockReturnValue([]);

    service.getCacheContentToSend(0);

    await service.compactQueue(0, 'time-values');
    service.getCacheContentToSend(0);

    service.searchCacheContent({ start: null, end: null, nameContains: null }, 'cache');

    service.removeCacheContent('cache', {
      metadataFilename: 'fileToRemove.json',
      metadata: { contentFile: 'contentFile.csv' } as CacheMetadata
    });
    service.moveCacheContent('cache', 'archive', {
      metadataFilename: 'fileToRemove.json',
      metadata: { contentFile: 'contentFile.csv' } as CacheMetadata
    });

    expect(fs.readdir).toHaveBeenCalledTimes(0);
    expect(fs.unlink).toHaveBeenCalledTimes(0);
    expect(fs.rename).toHaveBeenCalledTimes(0);

    await flushPromises();
    expect(fs.stat).toHaveBeenCalledTimes(1); // 1 from compact (called once because the size of copied queue at second call is one)
    expect(fs.writeFile).toHaveBeenCalledTimes(2); // 2 from compact (called once because the size of copied queue at second call is one)
    expect(fs.rename).toHaveBeenCalledTimes(2); // 2 from moveCacheContent
    expect(fs.unlink).toHaveBeenCalledTimes(8); // 6 from compact (called once because the size of copied queue at second call is one) + 2 from removeCacheContent

    expect(fs.readdir).toHaveBeenCalledTimes(1); // from search cache content
  });

  it('should properly compact and manage badly formed json files', async () => {
    for (const element of fileList) {
      service.addCacheContentToQueue(element);
    }
    (fs.readFile as jest.Mock)
      .mockReturnValueOnce('not a json')
      .mockReturnValueOnce('not a json')
      .mockReturnValueOnce('not a json')
      .mockReturnValueOnce('not a json');

    (fs.stat as jest.Mock).mockReturnValue({ size: 100 });

    await service.compactQueue(10, 'time-values');
    expect(fs.readFile).toHaveBeenCalledTimes(4);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${fileList[0].metadata.contentFile}": Unexpected token 'o', "not a json" is not valid JSON`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${fileList[1].metadata.contentFile}": Unexpected token 'o', "not a json" is not valid JSON`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${fileList[3].metadata.contentFile}": Unexpected token 'o', "not a json" is not valid JSON`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${fileList[5].metadata.contentFile}": Unexpected token 'o', "not a json" is not valid JSON`
    );

    expect(fs.rm).toHaveBeenCalledTimes(8);
    expect(fs.rm).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[0].metadata.contentFile), {
      recursive: true,
      force: true
    });
    expect(fs.rm).toHaveBeenCalledWith(path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[0].metadataFilename), {
      recursive: true,
      force: true
    });
    expect(fs.rm).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[1].metadata.contentFile), {
      recursive: true,
      force: true
    });
    expect(fs.rm).toHaveBeenCalledWith(path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[1].metadataFilename), {
      recursive: true,
      force: true
    });
    expect(fs.rm).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[3].metadata.contentFile), {
      recursive: true,
      force: true
    });
    expect(fs.rm).toHaveBeenCalledWith(path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[3].metadataFilename), {
      recursive: true,
      force: true
    });
    expect(fs.rm).toHaveBeenCalledWith(path.join(service.cacheFolder, service.CONTENT_FOLDER, fileList[5].metadata.contentFile), {
      recursive: true,
      force: true
    });
    expect(fs.rm).toHaveBeenCalledWith(path.join(service.cacheFolder, service.METADATA_FOLDER, fileList[5].metadataFilename), {
      recursive: true,
      force: true
    });

    const result = service['queue'];
    expect(result.length).toEqual(2); // Only two csv files
    expect(service.getNumberOfElementsInQueue()).toEqual(0);
  });

  it('should properly update cache size', () => {
    const mockListener = jest.fn();
    service.cacheSizeEventEmitter.on('cache-size', mockListener);
    service['updateCacheSize'](1, 'cache', 'archive');
    expect(mockListener).toHaveBeenCalledWith({
      cacheSizeToAdd: -1,
      errorSizeToAdd: 0,
      archiveSizeToAdd: 1
    });

    service['updateCacheSize'](2, 'error', 'cache');
    expect(mockListener).toHaveBeenCalledWith({
      cacheSizeToAdd: 2,
      errorSizeToAdd: -2,
      archiveSizeToAdd: 0
    });

    service['updateCacheSize'](3, 'archive', 'cache');
    expect(mockListener).toHaveBeenCalledWith({
      cacheSizeToAdd: 3,
      errorSizeToAdd: 0,
      archiveSizeToAdd: -3
    });
  });
});
