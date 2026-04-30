import fs from 'node:fs/promises';
import path from 'node:path';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import HistoryQueryRepository from '../../repository/config/history-query.repository';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import DataStreamEngine from '../../engine/data-stream-engine';
import OIAnalyticsMessageRepository from '../../repository/config/oianalytics-message.repository';
import OIAnalyticsCommandRepository from '../../repository/config/oianalytics-command.repository';
import type { ILogger } from '../../model/logger.model';

const CLEAN_UP_INTERVAL = 3600 * 1000; // Every hour

const FOLDERS = {
  CACHE: 'cache',
  ERROR: 'error',
  ARCHIVE: 'archive',
  METADATA: 'metadata',
  CONTENT: 'content'
} as const;

/**
 * Clean up archive and error folders after retention duration
 */
export default class CleanupService {
  private logger: ILogger;
  private readonly dataFolder: string;
  private cleanUpInterval: NodeJS.Timeout | null = null;

  constructor(
    logger: ILogger,
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

  setLogger(value: ILogger) {
    this.logger = value;
  }

  async start(): Promise<void> {
    await this.cleanup();
    this.stop();
    this.cleanUpInterval = setInterval(this.cleanup.bind(this), CLEAN_UP_INTERVAL);
  }

  stop(): void {
    if (this.cleanUpInterval) {
      clearInterval(this.cleanUpInterval);
      this.cleanUpInterval = null;
    }
  }

  async cleanup() {
    this.logger.debug(`Cleaning up data folder...`);

    // 1. Remove orphan folders (Folders on disk that no longer have a connector)
    await this.cleanOrphans();

    // 2. Process retention policies for archive and error folders
    await this.cleanNorthConnectors();
    await this.cleanHistoryQueries();

    // 3. Clean OIAnalytics Data
    this.cleanOIAnalyticsData();
  }

  private async cleanOrphans() {
    // Scan all 3 main folders for orphaned sub-folders
    for (const mainFolder of [FOLDERS.CACHE, FOLDERS.ERROR, FOLDERS.ARCHIVE]) {
      const rootPath = path.join(this.dataFolder, mainFolder);
      let entries: Array<string> = [];

      try {
        entries = (await fs.readdir(rootPath)).filter(f => !f.endsWith('.db'));
      } catch {
        continue; // Folder likely doesn't exist yet
      }

      for (const folderName of entries) {
        const fullPath = path.join(rootPath, folderName);
        const folderId = this.extractIdFromFolderName(folderName);

        if (!folderId) continue;

        let exists = false;
        if (folderName.startsWith('north-')) {
          exists = !!this.northConnectorRepository.findNorthById(folderId);
        } else if (folderName.startsWith('history-')) {
          exists = !!this.historyQueryRepository.findHistoryById(folderId);
        } else if (folderName.startsWith('south-')) {
          exists = !!this.southConnectorRepository.findSouthById(folderId);
        }

        if (!exists) {
          this.logger.debug(`Folder "${folderName}" in ${mainFolder} is orphaned. Removing it.`);
          await fs
            .rm(fullPath, { force: true, recursive: true })
            .catch(err => this.logger.error(`Could not remove orphan "${fullPath}": ${err.message}`));
        }
      }
    }
  }

  private async cleanNorthConnectors() {
    const norths = this.northConnectorRepository.findAllNorthFull();

    for (const north of norths) {
      await this.applyRetentionPolicy('north', north.id, north.caching.error.retentionDuration, north.caching.archive.retentionDuration);
    }
  }

  private async cleanHistoryQueries() {
    const histories = this.historyQueryRepository.findAllHistoriesFull();

    for (const history of histories) {
      // History queries store data in a 'north' subfolder inside their main folder
      await this.applyRetentionPolicy(
        'history',
        history.id,
        history.caching.error.retentionDuration,
        history.caching.archive.retentionDuration,
        'north'
      );
    }
  }

  /**
   * Core logic to check both Error and Archive folders for a single entity
   * and send a single update command if files need removal.
   */
  private async applyRetentionPolicy(
    type: 'north' | 'history',
    entityId: string,
    errorRetention: number,
    archiveRetention: number,
    subPath = ''
  ) {
    // Folder names follow the pattern "type-entityId"
    const folderName = `${type}-${entityId}`;

    const [errorFiles, archiveFiles] = await Promise.all([
      this.scanFolderForDeletion(path.join(this.dataFolder, FOLDERS.ERROR, folderName, subPath), errorRetention),
      this.scanFolderForDeletion(path.join(this.dataFolder, FOLDERS.ARCHIVE, folderName, subPath), archiveRetention)
    ]);

    // If we found files to delete in either folder, send ONE command
    if (errorFiles.length > 0 || archiveFiles.length > 0) {
      await this.dataStreamEngine.updateCacheContent(type, entityId, {
        error: { remove: errorFiles, move: [] },
        archive: { remove: archiveFiles, move: [] },
        cache: { remove: [], move: [] }
      });
    }
  }

  private async scanFolderForDeletion(targetFolder: string, retentionDuration: number): Promise<Array<string>> {
    // Optimization: Skip disk IO entirely if retention is disabled (0)
    if (retentionDuration <= 0) {
      return [];
    }

    return this.retrieveFilesToDelete(targetFolder, retentionDuration);
  }

  private cleanOIAnalyticsData() {
    const sevenDaysAgo = DateTime.now().minus({ days: 7 }).toUTC().toISO()!;

    this.oianalyticsMessageRepository
      .list({
        types: [],
        status: ['ERRORED', 'COMPLETED'],
        start: undefined,
        end: sevenDaysAgo
      })
      .forEach(m => this.oianalyticsMessageRepository.delete(m.id));

    this.oianalyticsCommandRepository
      .list({
        types: [],
        status: ['ERRORED', 'COMPLETED', 'CANCELLED'],
        start: undefined,
        ack: undefined,
        end: sevenDaysAgo
      })
      .forEach(c => this.oianalyticsCommandRepository.delete(c.id));
  }

  private async retrieveFilesToDelete(folderPath: string, retentionDuration: number): Promise<Array<string>> {
    const metadataFolder = path.join(folderPath, FOLDERS.METADATA);
    let filenames: Array<string> = [];

    try {
      filenames = await fs.readdir(metadataFolder);
    } catch {
      return []; // Folder doesn't exist or is empty
    }

    const filesToDelete: Array<string> = [];
    const now = DateTime.now();

    for (const filename of filenames) {
      const metadataPath = path.join(metadataFolder, filename);
      const contentPath = path.join(folderPath, FOLDERS.CONTENT, filename);

      try {
        const fileContent = await fs.readFile(metadataPath, 'utf8');
        const metadata: CacheMetadata = JSON.parse(fileContent);

        const fileDate = DateTime.fromISO(metadata.createdAt);
        // Calculate age
        const ageInHours = now.diff(fileDate, 'hours').hours;

        if (ageInHours >= retentionDuration) {
          filesToDelete.push(filename);
        }
      } catch (error) {
        this.logger.error(`Corrupt metadata file "${metadataPath}", deleting: ${(error as Error).message}`);
        // Auto-heal: delete corrupt files
        await Promise.all([fs.rm(metadataPath, { force: true }).catch(), fs.rm(contentPath, { force: true }).catch()]);
      }
    }
    return filesToDelete;
  }

  private extractIdFromFolderName(folderName: string): string | null {
    const parts = folderName.split('-');
    return parts.length > 1 ? parts.slice(1).join('-') : null;
  }
}
