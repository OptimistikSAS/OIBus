import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import HistoryQueryRepository from '../../repository/config/history-query.repository';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import DataStreamEngine from '../../engine/data-stream-engine';
import OIAnalyticsMessageRepository from '../../repository/config/oianalytics-message.repository';
import OIAnalyticsCommandRepository from '../../repository/config/oianalytics-command.repository';

const CACHE_FOLDER = 'cache';
const CACHE_DATABASE = 'cache.db';
const ERROR_FOLDER = 'error';
const ARCHIVE_FOLDER = 'archive';
const METADATA_SUB_FOLDER = 'metadata';
const CLEAN_UP_INTERVAL = 3600 * 1000; // Every hour

/**
 * Clean up archive and error folders after retention duration
 */
export default class CleanupService {
  private logger: pino.Logger;
  private readonly dataFolder: string;
  private cleanUpInterval: NodeJS.Timeout | null = null;

  constructor(
    logger: pino.Logger,
    baseCacheFolder: string,
    private readonly historyQueryRepository: HistoryQueryRepository,
    private readonly northConnectorRepository: NorthConnectorRepository,
    private readonly southConnectorRepository: SouthConnectorRepository,
    private readonly oianalyticsMessageRepository: OIAnalyticsMessageRepository,
    private readonly oianalyticsCommandRepository: OIAnalyticsCommandRepository,
    private readonly dataStreamEngine: DataStreamEngine
  ) {
    this.logger = logger;
    this.dataFolder = path.resolve(baseCacheFolder);
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }

  async start(): Promise<void> {
    await this.cleanup();
    if (this.cleanUpInterval) {
      clearInterval(this.cleanUpInterval);
      this.cleanUpInterval = null;
    }
    this.cleanUpInterval = setInterval(this.cleanup.bind(this), CLEAN_UP_INTERVAL);
  }

  async stop(): Promise<void> {
    if (this.cleanUpInterval) {
      clearInterval(this.cleanUpInterval);
      this.cleanUpInterval = null;
    }
  }

  async cleanup() {
    this.logger.debug(`Cleaning up data folder...`);
    try {
      await this.scanMainFolder('cache');
      await this.scanMainFolder('error');
      await this.scanMainFolder('archive');
    } catch (error: unknown) {
      this.logger.error(`Data folder clean up error: ${(error as Error).message}`);
    }

    try {
      this.cleanUpOIAnalyticsCommandAndMessage();
    } catch (error: unknown) {
      this.logger.error(`Error while cleaning up old OIAnalytics commands and messages: ${(error as Error).message}`);
    }
  }

  async scanMainFolder(mainFolder: 'cache' | 'archive' | 'error') {
    // Read the cache folder and exclude cache.db file
    const cacheFolders =
      mainFolder === 'cache'
        ? (await fs.readdir(this.getFolder(mainFolder))).filter(element => element !== CACHE_DATABASE)
        : await fs.readdir(this.getFolder(mainFolder));

    // Remove south folder if folder is present but the connector does not exist
    const southFolders = cacheFolders.filter(element => element.startsWith('south-'));
    for (const folder of southFolders) {
      const folderPath = path.join(this.getFolder(mainFolder), folder);
      const folderId = this.getFolderId(folder)!;
      if (!this.southConnectorRepository.findSouthById(folderId)) {
        this.logger.debug(`Folder "${folder}" not associated to a South connector. Removing it.`);
        try {
          await fs.rm(folderPath, { force: true, recursive: true });
        } catch (error: unknown) {
          this.logger.error(`Could not remove "${folderPath}": ${(error as Error).message}`);
        }
      }
    }

    // Remove north folder if folder is present but the connector does not exist
    const northFolders = cacheFolders.filter(element => element.startsWith('north-'));
    for (const folder of northFolders) {
      const folderPath = path.join(this.getFolder(mainFolder), folder);
      const folderId = this.getFolderId(folder)!;
      const north = this.northConnectorRepository.findNorthById(folderId);
      if (!north) {
        this.logger.debug(`Folder "${folder}" not associated to a North connector. Removing it.`);
        try {
          await fs.rm(folderPath, { force: true, recursive: true });
        } catch (error: unknown) {
          this.logger.error(`Could not remove "${folderPath}": ${(error as Error).message}`);
        }
      } else {
        if (mainFolder === 'cache') {
          continue;
        }
        const fileList = await this.readCacheMetadataFiles(folderPath);
        if (fileList.length === 0) {
          continue;
        }

        const retentionDuration =
          mainFolder === 'archive' ? north.caching.archive.retentionDuration : north.caching.error.retentionDuration;
        if (mainFolder === 'archive' && !north.caching.archive.enabled) {
          await this.dataStreamEngine.removeCacheContent(
            'north',
            north.id,
            'archive',
            fileList.map(file => file.metadataFilename)
          );
        } else if (retentionDuration > 0) {
          await this.dataStreamEngine.removeCacheContent(
            'north',
            north.id,
            mainFolder,
            fileList.filter(file => this.shouldDeleteFile(file, retentionDuration)).map(file => file.metadataFilename)
          );
        }
      }
    }

    // Remove history folder if folder is present but the connector does not exist
    const historyQueryFolders = cacheFolders.filter(element => element.startsWith('history-'));
    for (const folder of historyQueryFolders) {
      const folderPath = path.join(this.getFolder(mainFolder), folder);
      const folderId = this.getFolderId(folder)!;

      const historyQuery = this.historyQueryRepository.findHistoryQueryById(folderId);
      if (!historyQuery) {
        this.logger.debug(`Folder "${folder}" not associated to a History query. Removing it.`);
        try {
          await fs.rm(folderPath, { force: true, recursive: true });
        } catch (error: unknown) {
          this.logger.error(`Could not remove "${folderPath}": ${(error as Error).message}`);
        }
      } else {
        if (mainFolder === 'cache') {
          continue;
        }

        const northFolderPath = path.join(folderPath, 'north');
        const fileList = await this.readCacheMetadataFiles(northFolderPath);
        if (fileList.length === 0) {
          continue;
        }

        const retentionDuration =
          mainFolder === 'archive' ? historyQuery.caching.archive.retentionDuration : historyQuery.caching.error.retentionDuration;
        if (mainFolder === 'archive' && !historyQuery.caching.archive.enabled) {
          await this.dataStreamEngine.removeCacheContent(
            'history',
            historyQuery.id,
            'archive',
            fileList.map(file => file.metadataFilename)
          );
        } else if (retentionDuration > 0) {
          await this.dataStreamEngine.removeCacheContent(
            'history',
            historyQuery.id,
            mainFolder,
            fileList.filter(file => this.shouldDeleteFile(file, retentionDuration)).map(file => file.metadataFilename)
          );
        }
      }
    }
  }

  cleanUpOIAnalyticsCommandAndMessage() {
    // Retrieve messages and commands older than 7 days
    const messagesToRemove = this.oianalyticsMessageRepository.list({
      types: [],
      status: ['ERRORED', 'COMPLETED'],
      end: DateTime.now()
        .minus({ hour: 24 * 7 })
        .toUTC()
        .toISO()!
    });

    for (const message of messagesToRemove) {
      this.oianalyticsMessageRepository.delete(message.id);
    }

    const commandsToRemove = this.oianalyticsCommandRepository.list({
      types: [],
      status: ['ERRORED', 'COMPLETED', 'CANCELLED'],
      end: DateTime.now()
        .minus({ hour: 24 * 7 })
        .toUTC()
        .toISO()!,
      start: undefined,
      ack: undefined
    });
    for (const command of commandsToRemove) {
      this.oianalyticsCommandRepository.delete(command.id);
    }
  }

  private async readCacheMetadataFiles(folderPath: string): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    let filenames = [];
    try {
      filenames = await fs.readdir(path.join(folderPath, METADATA_SUB_FOLDER));
    } catch (error: unknown) {
      this.logger.debug(`Could not read cache metadata files from folder "${folderPath}": ${(error as Error).message}`);
      return [];
    }

    const cacheMetadataFiles: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];
    for (const filename of filenames) {
      const filePath = path.join(folderPath, METADATA_SUB_FOLDER, filename);
      try {
        const metadata: CacheMetadata = JSON.parse(await fs.readFile(filePath, { encoding: 'utf8' }));
        cacheMetadataFiles.push({ metadataFilename: filename, metadata });
      } catch (error: unknown) {
        this.logger.error(`Error while reading file "${filePath}": ${(error as Error).message}`);
        try {
          await fs.rm(filename, { force: true, recursive: true });
        } catch (unlinkError: unknown) {
          this.logger.error(`Error while removing file "${filePath}": ${(unlinkError as Error).message}`);
        }
      }
    }
    return cacheMetadataFiles;
  }

  private getFolder(folder: 'cache' | 'archive' | 'error') {
    switch (folder) {
      case 'cache':
        return path.join(this.dataFolder, CACHE_FOLDER);
      case 'archive':
        return path.join(this.dataFolder, ARCHIVE_FOLDER);
      case 'error':
        return path.join(this.dataFolder, ERROR_FOLDER);
    }
  }

  private getFolderId(folderName: string): string | null {
    const match = folderName.match(/^[^-]+-(.+)$/);
    return match ? match[1] : null;
  }

  private shouldDeleteFile(file: { metadataFilename: string; metadata: CacheMetadata }, retentionDuration: number) {
    return DateTime.now().minus({ hour: retentionDuration }).toMillis() - DateTime.fromISO(file.metadata.createdAt).toMillis() >= 0;
  }
}
