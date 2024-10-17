import pino from 'pino';
import HistoryQuery from './history-query';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createFolder, filesExists } from '../service/utils';
import { PassThrough } from 'node:stream';
import { HistoryQueryEntity } from '../model/histor-query.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';

const CACHE_FOLDER = './cache/history-query';

/**
 * Manage history queries by running {@link HistoryQuery} one after another
 * @class HistoryQueryEngine
 */
export default class HistoryQueryEngine {
  private historyQueries: Map<string, HistoryQuery> = new Map<string, HistoryQuery>();
  private readonly cacheFolder: string;

  constructor(private _logger: pino.Logger) {
    this.cacheFolder = path.resolve(CACHE_FOLDER);
  }

  get logger() {
    return this._logger;
  }

  get baseFolder() {
    return this.cacheFolder;
  }

  async start(historyQueryList: Array<HistoryQuery>): Promise<void> {
    for (const historyQuery of historyQueryList) {
      await this.createHistoryQuery(historyQuery);
      await this.startHistoryQuery(historyQuery.settings.id);
    }
  }

  /**
   * Gracefully stop every Timer, Protocol and Application
   */
  async stop(): Promise<void> {
    for (const historyQueryId of this.historyQueries.keys()) {
      await this.stopHistoryQuery(historyQueryId);
    }
    this.historyQueries.clear();
  }

  async createHistoryQuery(historyQuery: HistoryQuery): Promise<void> {
    const baseFolder = path.resolve(this.cacheFolder, `history-${historyQuery.settings.id}`);
    await createFolder(baseFolder);

    this.historyQueries.set(historyQuery.settings.id, historyQuery);
  }

  async startHistoryQuery(historyId: string): Promise<void> {
    const historyQuery = this.historyQueries.get(historyId);
    if (!historyQuery) {
      this._logger.trace(`History Query "${historyId}" not set`);
      return;
    }

    historyQuery.start().catch(error => {
      this._logger.error(
        `Error while starting History Query "${historyQuery.settings.name}" (${historyQuery.settings.id}): ${error.message}`
      );
    });
  }

  async stopHistoryQuery(historyId: string): Promise<void> {
    await this.historyQueries.get(historyId)?.stop();
  }

  async resetCache(historyId: string) {
    await this.historyQueries.get(historyId)?.resetCache();
  }

  async reloadHistoryQuery(historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>, resetCache: boolean) {
    await this.stopHistoryQuery(historyQuery.id);
    this.historyQueries
      .get(historyQuery.id)
      ?.setLogger(this.logger.child({ scopeType: 'history-query', scopeId: historyQuery.id, scopeName: historyQuery.name }));
    if (resetCache) {
      await this.resetCache(historyQuery.id);
    }
    await this.startHistoryQuery(historyQuery.id);
  }

  setLogger(value: pino.Logger) {
    this._logger = value;

    for (const historyQuery of this.historyQueries.values()) {
      historyQuery.setLogger(
        this._logger.child({ scopeType: 'history-query', scopeId: historyQuery.settings.id, scopeName: historyQuery.settings.name })
      );
    }
  }

  getHistoryDataStream(historyId: string): PassThrough | null {
    return this.historyQueries.get(historyId)?.getMetricsDataStream() || null;
  }

  /**
   * Stops the History query and deletes all cache inside the base folder
   */
  async deleteHistoryQuery(historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>): Promise<void> {
    await this.stopHistoryQuery(historyQuery.id);
    await this.resetCache(historyQuery.id);
    const baseFolder = path.resolve(this.cacheFolder, `history-${historyQuery.id}`);
    try {
      this._logger.trace(`Deleting base folder "${baseFolder}" of History query "${historyQuery.name}" (${historyQuery.id})`);
      if (await filesExists(baseFolder)) {
        await fs.rm(baseFolder, { recursive: true });
      }
      this._logger.info(`Deleted History query "${historyQuery.name}" (${historyQuery.id})`);
    } catch (error) {
      this._logger.error(`Unable to delete History query "${historyQuery.name}" (${historyQuery.id}) base folder: ${error}`);
    }
  }
}
