import pino from 'pino';
import HistoryQuery from './history-query';
import path from 'node:path';
import { HistoryQueryEntity } from '../model/histor-query.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import HistoryQueryMetricsService from '../service/metrics/history-query-metrics.service';
import HistoryQueryMetricsRepository from '../repository/metrics/history-query-metrics.repository';
import { PassThrough } from 'node:stream';
import { BaseFolders } from '../model/types';
import { CacheMetadata, CacheSearchParam } from '../../shared/model/engine.model';
import { ReadStream } from 'node:fs';

const CACHE_FOLDER = './cache';
const ARCHIVE_FOLDER = './archive';
const ERROR_FOLDER = './error';

/**
 * Manage history queries by running {@link HistoryQuery} one after another
 * @class HistoryQueryEngine
 */
export default class HistoryQueryEngine {
  private historyQueries: Map<string, HistoryQuery> = new Map<string, HistoryQuery>();
  private historyQueryMetrics: Map<string, HistoryQueryMetricsService> = new Map<string, HistoryQueryMetricsService>();
  private readonly cacheFolders: BaseFolders;

  constructor(
    private historyQueryMetricsRepository: HistoryQueryMetricsRepository,
    private _logger: pino.Logger
  ) {
    this.cacheFolders = {
      cache: path.resolve(CACHE_FOLDER),
      archive: path.resolve(ARCHIVE_FOLDER),
      error: path.resolve(ERROR_FOLDER)
    };
  }

  get logger() {
    return this._logger;
  }

  get baseFolders() {
    return this.cacheFolders;
  }

  getHistoryQueryDataStream(historyQueryId: string): PassThrough | null {
    return this.historyQueryMetrics.get(historyQueryId)?.stream || null;
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
    this.historyQueryMetrics.set(
      historyQuery.settings.id,
      new HistoryQueryMetricsService(historyQuery, this.historyQueryMetricsRepository)
    );
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
    this.historyQueryMetrics.get(historyId)?.resetMetrics();
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

  /**
   * Stops the History query and deletes all cache inside the base folder
   */
  async deleteHistoryQuery(historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>): Promise<void> {
    await this.stopHistoryQuery(historyQuery.id);
    await this.resetCache(historyQuery.id);
  }

  async searchCacheContent(
    historyQueryId: string,
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    return (await this.historyQueries.get(historyQueryId)?.searchCacheContent(searchParams, folder)) || [];
  }

  async getCacheContentFileStream(
    historyQueryId: string,
    folder: 'cache' | 'archive' | 'error',
    filename: string
  ): Promise<ReadStream | null> {
    return (await this.historyQueries.get(historyQueryId)?.getCacheContentFileStream(folder, filename)) || null;
  }

  async removeCacheContent(
    historyQueryId: string,
    folder: 'cache' | 'archive' | 'error',
    metadataFilenameList: Array<string>
  ): Promise<void> {
    await this.historyQueries.get(historyQueryId)?.removeCacheContent(folder, metadataFilenameList);
  }

  async removeAllCacheContent(historyQueryId: string, folder: 'cache' | 'archive' | 'error'): Promise<void> {
    await this.historyQueries.get(historyQueryId)?.removeAllCacheContent(folder);
  }

  async moveCacheContent(
    historyQueryId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    cacheContentList: Array<string>
  ): Promise<void> {
    await this.historyQueries.get(historyQueryId)?.moveCacheContent(originFolder, destinationFolder, cacheContentList);
  }

  async moveAllCacheContent(
    historyQueryId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error'
  ): Promise<void> {
    await this.historyQueries.get(historyQueryId)?.moveAllCacheContent(originFolder, destinationFolder);
  }
}
