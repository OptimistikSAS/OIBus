import BaseEngine from './base-engine';
import EncryptionService from '../service/encryption.service';
import ProxyService from '../service/proxy.service';
import NorthService from '../service/north.service';
import SouthService from '../service/south.service';
import pino from 'pino';
import HistoryQueryService from '../service/history-query.service';
import HistoryQuery from './history-query';
import path from 'node:path';
import { createFolder } from '../service/utils';

import { HistoryQueryDTO } from '../../../shared/model/history-query.model';
import { OibusItemDTO } from '../../../shared/model/south-connector.model';

const CACHE_FOLDER = './cache/history-query';

/**
 * Manage history queries by running {@link HistoryQuery} one after another
 * @class HistoryQueryEngine
 */
export default class HistoryQueryEngine extends BaseEngine {
  private historyQueries: Map<string, HistoryQuery> = new Map<string, HistoryQuery>();

  constructor(
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    northService: NorthService,
    southService: SouthService,
    private readonly historyQueryService: HistoryQueryService,
    logger: pino.Logger
  ) {
    super(encryptionService, proxyService, northService, southService, logger, CACHE_FOLDER);
  }

  override async start(): Promise<void> {
    const historyQueriesSettings = this.historyQueryService.getHistoryQueryList();
    for (const settings of historyQueriesSettings) {
      await this.startHistoryQuery(settings);
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

  async startHistoryQuery(settings: HistoryQueryDTO): Promise<void> {
    const items = this.historyQueryService.getItems(settings.id);
    const baseFolder = path.resolve(this.cacheFolder, `history-${settings.id}`);
    await createFolder(baseFolder);
    const historyQuery = new HistoryQuery(
      settings,
      this.southService,
      this.northService,
      items,
      this.logger.child({ scope: `history:${settings.name}` }),
      baseFolder
    );
    this.historyQueries.set(settings.id, historyQuery);
    historyQuery.start().catch(error => {
      this.logger.error(error);
    });
  }

  async addItemToHistoryQuery(historyId: string, item: OibusItemDTO): Promise<void> {
    await this.historyQueries.get(historyId)?.addItem(item);
  }

  async deleteItemFromHistoryQuery(historyId: string, item: OibusItemDTO): Promise<void> {
    await this.historyQueries.get(historyId)?.deleteItem(item);
  }

  async updateItemInHistoryQuery(historyId: string, item: OibusItemDTO): Promise<void> {
    await this.historyQueries.get(historyId)?.updateItem(item);
  }

  async stopHistoryQuery(historyId: string): Promise<void> {
    await this.historyQueries.get(historyId)?.stop();
    this.historyQueries.delete(historyId);
  }

  setLogger(value: pino.Logger) {
    super.setLogger(value);

    for (const [id, historyQuery] of this.historyQueries.entries()) {
      const settings = this.historyQueryService.getHistoryQuery(id);
      if (settings) {
        historyQuery.setLogger(this.logger.child({ scope: `south:${settings.name}` }));
      }
    }
  }
}
