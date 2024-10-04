import RepositoryService from './repository.service';
import LoggerService from './logger/logger.service';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemScanModeNameDTO
} from '../../../shared/model/south-connector.model';
import { NorthCacheFiles, NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../shared/model/north-connector.model';
import { HistoryQueryCommandDTO, HistoryQueryDTO, SouthHistoryQueryItemDTO } from '../../../shared/model/history-query.model';
import NorthService from './north.service';
import SouthService from './south.service';
import OIBusEngine from '../engine/oibus-engine';
import HistoryQueryEngine from '../engine/history-query-engine';
import { Instant } from '../../../shared/model/types';
import { ScanModeCommandDTO } from '../../../shared/model/scan-mode.model';
import ProxyServer from '../web-server/proxy-server';
import OIBusService from './oibus.service';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';

export default class ReloadService {
  constructor(
    private readonly _loggerService: LoggerService,
    private readonly _repositoryService: RepositoryService,
    private readonly _northService: NorthService,
    private readonly _southService: SouthService,
    private readonly _oibusEngine: OIBusEngine,
    private readonly _historyEngine: HistoryQueryEngine,
    private readonly _oibusService: OIBusService,
    private readonly _oianalyticsMessageService: OIAnalyticsMessageService,
    private readonly _proxyServer: ProxyServer
  ) {}

  get repositoryService(): RepositoryService {
    return this._repositoryService;
  }

  get loggerService(): LoggerService {
    return this._loggerService;
  }

  get northService(): NorthService {
    return this._northService;
  }

  get southService(): SouthService {
    return this._southService;
  }

  get oibusEngine(): OIBusEngine {
    return this._oibusEngine;
  }

  get historyEngine(): HistoryQueryEngine {
    return this._historyEngine;
  }

  get oibusService(): OIBusService {
    return this._oibusService;
  }

  get proxyServer(): ProxyServer {
    return this._proxyServer;
  }

  get oianalyticsMessageService(): OIAnalyticsMessageService {
    return this._oianalyticsMessageService;
  }

  async onCreateSouth(command: SouthConnectorCommandDTO): Promise<SouthConnectorDTO> {
    const southConnector = this.repositoryService.southConnectorRepository.create(command);
    await this.oibusEngine.createSouth(southConnector);
    return southConnector;
  }

  async onUpdateSouth(
    previousSettings: SouthConnectorDTO,
    command: SouthConnectorCommandDTO,
    itemsToAdd: Array<SouthConnectorItemCommandDTO>,
    itemsToUpdate: Array<SouthConnectorItemCommandDTO>
  ): Promise<void> {
    this.repositoryService.southConnectorRepository.update(previousSettings.id, command);

    // Handle all cases regarding cache changes when max instant per item changes
    this.onSouthMaxInstantPerItemChange(previousSettings.id, previousSettings, command);

    if (previousSettings.name !== command.name) {
      this.oibusEngine.setLogger(this.oibusEngine.logger);
    }

    const southConnector = this.repositoryService.southConnectorRepository.findById(previousSettings.id)!;
    this.onCreateOrUpdateSouthItems(southConnector, itemsToAdd, itemsToUpdate);

    if (southConnector.enabled) {
      this.repositoryService.southConnectorRepository.start(southConnector.id);
      await this.oibusEngine.reloadSouth(southConnector.id);
    } else {
      this.repositoryService.southConnectorRepository.stop(southConnector.id);
      await this.oibusEngine.stopSouth(southConnector.id);
    }
  }

  async onDeleteSouth(southId: string): Promise<void> {
    const subscribedNorthIds = this.repositoryService.subscriptionRepository.listNorthBySouth(southId);
    await Promise.allSettled(subscribedNorthIds.map(northId => this.onDeleteNorthSubscription(northId, southId)));

    const { name, id } = this.repositoryService.southConnectorRepository.findById(southId)!;
    await this.oibusEngine.deleteSouth(id, name);

    this.repositoryService.southItemRepository.deleteAllBySouthConnector(id);
    this.repositoryService.southConnectorRepository.delete(id);

    this.repositoryService.logRepository.deleteLogsByScopeId('south', id);
    this.repositoryService.southMetricsRepository.removeMetrics(id);
    this.repositoryService.southCacheRepository.deleteAllBySouthConnector(id);
  }

  async onStartSouth(southId: string): Promise<void> {
    this.repositoryService.southConnectorRepository.start(southId);
    await this.oibusEngine.startSouth(southId);
  }

  async onStopSouth(southId: string): Promise<void> {
    this.repositoryService.southConnectorRepository.stop(southId);
    await this.oibusEngine.stopSouth(southId);
  }

  async onCreateSouthItem(southId: string, command: SouthConnectorItemCommandDTO): Promise<SouthConnectorItemDTO> {
    const southItem = this.repositoryService.southItemRepository.create(southId, command);
    await this.oibusEngine.onSouthItemsChange(southId);
    return southItem;
  }

  async onUpdateSouthItemSettings(southId: string, southItem: SouthConnectorItemDTO, command: SouthConnectorItemCommandDTO): Promise<void> {
    this.repositoryService.southItemRepository.update(southItem.id, command);
    const newItem = this.repositoryService.southItemRepository.findById(southItem.id)!;

    // Handle all cases regarding cache changes when the scan mode changes
    this.onSouthItemScanModeChange(southId, southItem, newItem);
    await this.oibusEngine.onSouthItemsChange(southId);
  }

  onCreateOrUpdateSouthItems(
    southConnector: SouthConnectorDTO,
    itemsToAdd: Array<SouthConnectorItemCommandDTO>,
    itemsToUpdate: Array<SouthConnectorItemCommandDTO>
  ) {
    const allPreviousSouthItems = this.repositoryService.southItemRepository.findAllForSouthConnector(southConnector.id);
    this.repositoryService.southItemRepository.createAndUpdateSouthItems(southConnector.id, itemsToAdd, itemsToUpdate);

    for (const newItem of itemsToUpdate) {
      const previousItem = allPreviousSouthItems.find(i => i.id === newItem.id);
      if (previousItem) {
        this.onSouthItemScanModeChange(southConnector.id, previousItem, newItem);
      }
    }
  }

  async onDeleteSouthItem(itemId: string): Promise<void> {
    const southItem = this.repositoryService.southItemRepository.findById(itemId);
    if (!southItem) throw new Error('South item not found');
    this.repositoryService.southItemRepository.delete(itemId);
    this.safeDeleteSouthCacheEntry(southItem);
  }

  async onEnableSouthItem(itemId: string): Promise<void> {
    const southItem = this.repositoryService.southItemRepository.findById(itemId);
    if (!southItem) throw new Error('South item not found');
    this.repositoryService.southItemRepository.enable(itemId);
    await this.oibusEngine.onSouthItemsChange(southItem.connectorId);
  }

  async onDisableSouthItem(itemId: string): Promise<void> {
    const southItem = this.repositoryService.southItemRepository.findById(itemId);
    if (!southItem) throw new Error('South item not found');
    this.repositoryService.southItemRepository.disable(itemId);
    await this.oibusEngine.onSouthItemsChange(southItem.connectorId);
  }

  async onDeleteAllSouthItems(southId: string): Promise<void> {
    this.repositoryService.southItemRepository.deleteAllBySouthConnector(southId);
    this.repositoryService.southCacheRepository.deleteAllBySouthConnector(southId);
    await this.oibusEngine.onSouthItemsChange(southId);
  }

  async onCreateNorth(command: NorthConnectorCommandDTO): Promise<NorthConnectorDTO> {
    const northConnector = this.repositoryService.northConnectorRepository.create(command);
    await this.oibusEngine.createNorth(northConnector);
    return northConnector;
  }

  async onUpdateNorthSettings(northId: string, command: NorthConnectorCommandDTO): Promise<void> {
    const previousSettings = this.repositoryService.northConnectorRepository.findById(northId)!;
    this.repositoryService.northConnectorRepository.update(northId, command);

    if (previousSettings.name !== command.name) {
      this.oibusEngine.setLogger(this.oibusEngine.logger);
    }
    if (command.enabled) {
      this.repositoryService.northConnectorRepository.start(northId);
      await this.oibusEngine.reloadNorth(northId);
    } else {
      this.repositoryService.northConnectorRepository.stop(northId);
      await this.oibusEngine.stopNorth(northId);
    }
  }

  async onDeleteNorth(northId: string): Promise<void> {
    const { id, name } = this.repositoryService.northConnectorRepository.findById(northId)!;
    await this.oibusEngine.deleteNorth(id, name);
    this.repositoryService.northConnectorRepository.delete(id);
    this.repositoryService.logRepository.deleteLogsByScopeId('north', id);
    this.repositoryService.northMetricsRepository.removeMetrics(id);
  }

  async onStartNorth(northId: string): Promise<void> {
    this.repositoryService.northConnectorRepository.start(northId);
    await this.oibusEngine.startNorth(northId);
  }

  async onStopNorth(northId: string): Promise<void> {
    await this.oibusEngine.stopNorth(northId);
    this.repositoryService.northConnectorRepository.stop(northId);
  }

  async onCreateNorthSubscription(northId: string, southId: string): Promise<void> {
    this.repositoryService.subscriptionRepository.create(northId, southId);
    this.oibusEngine.updateSubscriptions(northId);
  }

  async onDeleteNorthSubscription(northId: string, southId: string): Promise<void> {
    this.repositoryService.subscriptionRepository.delete(northId, southId);
    this.oibusEngine.updateSubscriptions(northId);
  }

  async onCreateHistoryQuery(
    command: HistoryQueryCommandDTO,
    southItems: Array<SouthConnectorItemDTO> | Array<SouthConnectorItemScanModeNameDTO>
  ): Promise<HistoryQueryDTO> {
    const historyQuery = this.repositoryService.historyQueryRepository.create(command);
    for (const item of southItems) {
      this.repositoryService.historyQueryItemRepository.create(historyQuery.id, {
        name: item.name,
        enabled: item.enabled,
        settings: item.settings,
        scanModeId: 'history'
      });
    }
    await this.historyEngine.createHistoryQuery(historyQuery);
    await this.historyEngine.startHistoryQuery(historyQuery.id);
    return historyQuery;
  }

  async onUpdateHistoryQuerySettings(historyId: string, command: HistoryQueryCommandDTO): Promise<void> {
    const previousSettings = this.repositoryService.historyQueryRepository.findById(historyId)!;
    this.repositoryService.historyQueryRepository.updateStatus(historyId, 'PENDING');
    this.repositoryService.historyQueryRepository.update(historyId, command);
    if (previousSettings.name !== command.name) {
      this.historyEngine.setLogger(this.historyEngine.logger);
    }
  }

  async onStartHistoryQuery(historyId: string): Promise<void> {
    this.repositoryService.historyQueryRepository.updateStatus(historyId, 'RUNNING');
    await this.historyEngine.startHistoryQuery(historyId);
  }

  async onPauseHistoryQuery(historyId: string): Promise<void> {
    await this.historyEngine.stopHistoryQuery(historyId);
    this.repositoryService.historyQueryRepository.updateStatus(historyId, 'PAUSED');
  }

  async onDeleteHistoryQuery(historyId: string): Promise<void> {
    const { name, id } = this.repositoryService.historyQueryRepository.findById(historyId)!;
    await this.historyEngine.deleteHistoryQuery(id, name);

    this.repositoryService.historyQueryItemRepository.deleteAllByHistoryId(id);
    this.repositoryService.historyQueryRepository.delete(id);
    this.repositoryService.logRepository.deleteLogsByScopeId('history-query', id);
  }

  async onCreateHistoryItem(historyId: string, command: SouthConnectorItemCommandDTO): Promise<SouthConnectorItemDTO> {
    await this.historyEngine.stopHistoryQuery(historyId);
    const historyItem = this.repositoryService.historyQueryItemRepository.create(historyId, command);
    await this.historyEngine.startHistoryQuery(historyId);
    return historyItem;
  }

  async onUpdateHistoryItemsSettings(historyId: string, item: SouthConnectorItemDTO, command: SouthConnectorItemCommandDTO): Promise<void> {
    await this.historyEngine.stopHistoryQuery(historyId);
    this.repositoryService.historyQueryItemRepository.update(item.id, command);
    await this.historyEngine.startHistoryQuery(historyId);
  }

  async onDeleteHistoryItem(historyId: string, itemId: string): Promise<void> {
    this.repositoryService.historyQueryItemRepository.delete(itemId);
  }

  async onEnableHistoryItem(historyId: string, itemId: string): Promise<void> {
    const item = this.repositoryService.historyQueryItemRepository.findById(itemId);
    if (!item) {
      throw new Error('History item not found');
    }
    await this.historyEngine.stopHistoryQuery(historyId);
    this.repositoryService.historyQueryItemRepository.enable(itemId);
    await this.historyEngine.startHistoryQuery(historyId);
  }

  async onDisableHistoryItem(historyId: string, itemId: string): Promise<void> {
    const item = this.repositoryService.historyQueryItemRepository.findById(itemId);
    if (!item) throw new Error('History item not found');
    await this.historyEngine.stopHistoryQuery(historyId);
    this.repositoryService.historyQueryItemRepository.disable(itemId);
    await this.historyEngine.startHistoryQuery(historyId);
  }

  async onDeleteAllHistoryItems(historyId: string): Promise<void> {
    this.repositoryService.historyQueryItemRepository.deleteAllByHistoryId(historyId);
  }

  async onCreateOrUpdateHistoryQueryItems(
    historyQuery: HistoryQueryDTO,
    itemsToAdd: Array<SouthHistoryQueryItemDTO>,
    itemsToUpdate: Array<SouthHistoryQueryItemDTO>
  ): Promise<void> {
    this.repositoryService.historyQueryItemRepository.createAndUpdateAll(historyQuery.id, itemsToAdd, itemsToUpdate);
  }

  async getErrorFiles(northId: string, start: Instant, end: Instant, fileNameContains: string): Promise<Array<NorthCacheFiles>> {
    return await this.oibusEngine.getErrorFiles(northId, start, end, fileNameContains);
  }

  async onUpdateScanMode(scanModeId: string, scanModeCommand: ScanModeCommandDTO) {
    const oldScanMode = this.repositoryService.scanModeRepository.findById(scanModeId);
    if (!oldScanMode) {
      throw new Error(`Scan mode ${scanModeId} not found`);
    }
    this.repositoryService.scanModeRepository.update(scanModeId, scanModeCommand);
    const newScanMode = this.repositoryService.scanModeRepository.findById(scanModeId)!;
    if (oldScanMode.cron !== scanModeCommand.cron) {
      await this.oibusEngine.updateScanMode(newScanMode);
    }
  }

  /**
   * Handle the change of a south item's scan mode
   */
  private onSouthItemScanModeChange(southId: string, previousItem: SouthConnectorItemDTO, newItem: SouthConnectorItemCommandDTO) {
    const settings = this.repositoryService.southConnectorRepository.findById(southId)!;
    const oldScanModeId = previousItem.scanModeId;
    const newScanModeId = newItem.scanModeId!;

    if (oldScanModeId === newScanModeId) {
      return;
    }

    const southItemId = settings.history.maxInstantPerItem ? previousItem.id : 'all';
    const previousCacheEntry = this.repositoryService.southCacheRepository.getScanMode(southId, oldScanModeId, southItemId);
    const newCacheEntry = this.repositoryService.southCacheRepository.getScanMode(southId, newScanModeId, southItemId);

    // If the south hasn't been started yet, the previous cache entry won't exist
    if (!previousCacheEntry) {
      return;
    }

    // Max instant per item is enabled
    if (settings.history.maxInstantPerItem) {
      // 1. Remove the previous cache entry
      this.safeDeleteSouthCacheEntry(previousItem);

      // 2. Create the new cache entry, with the previous max instant
      this.repositoryService.southCacheRepository.createOrUpdate({
        southId,
        itemId: previousItem.id,
        scanModeId: newScanModeId,
        maxInstant: previousCacheEntry.maxInstant
      });
    }

    // Max instant per item is disabled
    if (!settings.history.maxInstantPerItem) {
      // 1. Remove the previous cache entry, if it's not used anymore
      this.safeDeleteSouthCacheEntry(previousItem);

      // 2. Create the new cache entry, with the previous max instant, if it's not already created
      if (!newCacheEntry) {
        this.repositoryService.southCacheRepository.createOrUpdate({
          southId,
          itemId: 'all',
          scanModeId: newScanModeId,
          maxInstant: previousCacheEntry.maxInstant
        });
      }
    }
  }

  /**
   * Handle the change of the max instant per item setting of a south connector
   */
  private onSouthMaxInstantPerItemChange(
    southId: string,
    previousSettings: SouthConnectorCommandDTO,
    newSettings: SouthConnectorCommandDTO
  ) {
    if (previousSettings.history.maxInstantPerItem == newSettings.history.maxInstantPerItem) {
      return;
    }

    const maxInstantsByScanMode = this.repositoryService.southCacheRepository.getLatestMaxInstants(southId);
    // If the south hasn't been started yet, the cache entries won't exist
    if (!maxInstantsByScanMode) {
      return;
    }

    // 1. Remove all previous cache entries
    this.repositoryService.southCacheRepository.deleteAllBySouthConnector(southId);

    // Max instant per item is being enabled
    if (newSettings.history.maxInstantPerItem) {
      const southItems = this.repositoryService.southItemRepository.findAllForSouthConnector(southId);

      // 2. Create new cache entries for each item
      // The max instant of these new entries, will be the max instant of the previously removed ones, based on scan mode
      for (const item of southItems) {
        const maxInstant = maxInstantsByScanMode.get(item.scanModeId);
        if (maxInstant) {
          this.repositoryService.southCacheRepository.createOrUpdate({
            southId,
            itemId: item.id,
            scanModeId: item.scanModeId,
            maxInstant
          });
        }
      }
    }

    // Max instant per item is being disabled
    if (!newSettings.history.maxInstantPerItem) {
      // 2. Create a single cache entry for all scan modes
      // The max instant of these new entries, will be the *latest* max instant of the previously removed ones
      for (const [scanModeId, maxInstant] of maxInstantsByScanMode) {
        this.repositoryService.southCacheRepository.createOrUpdate({ southId, itemId: 'all', scanModeId, maxInstant });
      }
    }
  }

  /**
   * Safely delete the cache entries of a south item, when the south item is deleted
   */
  private safeDeleteSouthCacheEntry(southItem: SouthConnectorItemDTO) {
    const southConnector = this.repositoryService.southConnectorRepository.findById(southItem.connectorId);
    if (!southConnector) {
      return;
    }

    if (southConnector.history.maxInstantPerItem) {
      this.repositoryService.southCacheRepository.deleteAllBySouthItem(southItem.id);
    }

    if (!southConnector.history.maxInstantPerItem) {
      const southItems = this.repositoryService.southItemRepository.findAllForSouthConnector(southItem.connectorId);
      const isOldScanModeUnused = !southItems.some(item => item.scanModeId === southItem.scanModeId);
      if (isOldScanModeUnused) {
        this.repositoryService.southCacheRepository.delete(southItem.id, southItem.scanModeId, 'all');
      }
    }
  }
}
