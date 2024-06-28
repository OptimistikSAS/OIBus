import RepositoryService from './repository.service';
import LoggerService from './logger/logger.service';

import { EngineSettingsDTO } from '../../../shared/model/engine.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemScanModeNameDTO
} from '../../../shared/model/south-connector.model';
import { NorthCacheFiles, NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../shared/model/north-connector.model';
import { HistoryQueryCommandDTO, HistoryQueryDTO, SouthHistoryQueryItemDTO } from '../../../shared/model/history-query.model';
import pino from 'pino';
import EngineMetricsService from './engine-metrics.service';
import NorthService from './north.service';
import SouthService from './south.service';
import OIBusEngine from '../engine/oibus-engine';
import HistoryQueryEngine from '../engine/history-query-engine';
import { Instant } from '../../../shared/model/types';
import { ScanModeCommandDTO } from '../../../shared/model/scan-mode.model';
import HomeMetricsService from './home-metrics.service';
import ProxyServer from '../web-server/proxy-server';
import OIBusService from './oibus.service';
import { getOIBusInfo } from './utils';
import OIAnalyticsMessageService from './oia/message.service';

export default class ReloadService {
  private webServerChangeLoggerCallback: (logger: pino.Logger) => void = () => {};
  private webServerChangePortCallback: (port: number) => Promise<void> = () => Promise.resolve();

  constructor(
    private readonly _loggerService: LoggerService,
    private readonly _repositoryService: RepositoryService,
    private readonly _engineMetricsService: EngineMetricsService,
    private readonly _homeMetricsService: HomeMetricsService,
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

  get engineMetricsService(): EngineMetricsService {
    return this._engineMetricsService;
  }

  get homeMetricsService(): HomeMetricsService {
    return this._homeMetricsService;
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

  setWebServerChangeLogger(callback: (logger: pino.Logger) => void): void {
    this.webServerChangeLoggerCallback = callback;
  }

  setWebServerChangePort(callback: (port: number) => Promise<void>): void {
    this.webServerChangePortCallback = callback;
  }

  async onUpdateOibusSettings(oldSettings: EngineSettingsDTO | null, newSettings: EngineSettingsDTO): Promise<void> {
    if (
      !oldSettings ||
      JSON.stringify(oldSettings.logParameters) !== JSON.stringify(newSettings.logParameters) ||
      oldSettings.name !== newSettings.name
    ) {
      await this.restartLogger(newSettings);
      const registration = this.repositoryService.registrationRepository.getRegistrationSettings()!;
      if (oldSettings?.name !== newSettings.name && registration.status !== 'NOT_REGISTERED') {
        const info = getOIBusInfo(newSettings);
        const createdMessage = this.repositoryService.oianalyticsMessageRepository.createOIAnalyticsMessages('INFO', info);
        this._oianalyticsMessageService.addMessageToQueue(createdMessage);
      }
    }
    if (newSettings.port === newSettings.proxyPort) {
      throw new Error('same port on general and proxy');
    } else if (oldSettings && oldSettings.port !== newSettings.port && oldSettings.proxyPort !== newSettings.proxyPort) {
      await this.proxyServer.stop();
      await this.webServerChangePortCallback(newSettings.port);
      if (newSettings.proxyEnabled) {
        await this.proxyServer.start(newSettings.proxyPort);
      }
    } else {
      if (!oldSettings || oldSettings.port !== newSettings.port) {
        await this.webServerChangePortCallback(newSettings.port);
      }
      if (!oldSettings || oldSettings.proxyEnabled !== newSettings.proxyEnabled || oldSettings.proxyPort !== newSettings.proxyPort) {
        await this.proxyServer.stop();
        if (newSettings.proxyEnabled) {
          await this.proxyServer.start(newSettings.proxyPort);
        }
      }
    }
  }

  public async restartLogger(newSettings: EngineSettingsDTO) {
    this.loggerService.stop();
    const registration = this.repositoryService.registrationRepository.getRegistrationSettings()!;
    await this.loggerService.start(newSettings.id, newSettings.name, newSettings.logParameters, registration);
    this.webServerChangeLoggerCallback(this.loggerService.createChildLogger('web-server'));
    this.oibusService.setLogger(this.loggerService.createChildLogger('internal'));
    this.engineMetricsService.setLogger(this.loggerService.createChildLogger('internal'));
    this.proxyServer.setLogger(this.loggerService.createChildLogger('internal'));
  }

  async onCreateSouth(command: SouthConnectorCommandDTO): Promise<SouthConnectorDTO> {
    const southConnector = this.repositoryService.southConnectorRepository.createSouthConnector(command);
    await this.oibusEngine.createSouth(southConnector);
    return southConnector;
  }

  async onUpdateSouth(
    previousSettings: SouthConnectorDTO,
    command: SouthConnectorCommandDTO,
    itemsToAdd: Array<SouthConnectorItemCommandDTO>,
    itemsToUpdate: Array<SouthConnectorItemCommandDTO>
  ): Promise<void> {
    this.repositoryService.southConnectorRepository.updateSouthConnector(previousSettings.id, command);

    // Handle all cases regarding cache changes when max instant per item changes
    this.onSouthMaxInstantPerItemChange(previousSettings.id, previousSettings, command);

    if (previousSettings.name !== command.name) {
      this.oibusEngine.setLogger(this.oibusEngine.logger);
    }

    const southConnector = this.repositoryService.southConnectorRepository.getSouthConnector(previousSettings.id)!;
    this.onCreateOrUpdateSouthItems(southConnector, itemsToAdd, itemsToUpdate);

    if (southConnector.enabled) {
      this.repositoryService.southConnectorRepository.startSouthConnector(southConnector.id);
      await this.oibusEngine.reloadSouth(southConnector.id);
    } else {
      this.repositoryService.southConnectorRepository.stopSouthConnector(southConnector.id);
      await this.oibusEngine.stopSouth(southConnector.id);
    }
  }

  async onDeleteSouth(southId: string): Promise<void> {
    const subscribedNorthIds = this.repositoryService.subscriptionRepository.getSubscribedNorthConnectors(southId);
    await Promise.allSettled(subscribedNorthIds.map(northId => this.onDeleteNorthSubscription(northId, southId)));

    const { name, id } = this.repositoryService.southConnectorRepository.getSouthConnector(southId)!;
    await this.oibusEngine.deleteSouth(id, name);

    this.repositoryService.southItemRepository.deleteAllSouthItems(id);
    this.repositoryService.southConnectorRepository.deleteSouthConnector(id);

    this.repositoryService.logRepository.deleteLogsByScopeId('south', id);
    this.repositoryService.southMetricsRepository.removeMetrics(id);
    this.repositoryService.southCacheRepository.deleteAllCacheScanModes(id);
  }

  async onStartSouth(southId: string): Promise<void> {
    this.repositoryService.southConnectorRepository.startSouthConnector(southId);
    await this.oibusEngine.startSouth(southId);
  }

  async onStopSouth(southId: string): Promise<void> {
    this.repositoryService.southConnectorRepository.stopSouthConnector(southId);
    await this.oibusEngine.stopSouth(southId);
  }

  async onCreateSouthItem(southId: string, command: SouthConnectorItemCommandDTO): Promise<SouthConnectorItemDTO> {
    const southItem = this.repositoryService.southItemRepository.createSouthItem(southId, command);
    await this.oibusEngine.onSouthItemsChange(southId);
    return southItem;
  }

  async onUpdateSouthItemSettings(southId: string, southItem: SouthConnectorItemDTO, command: SouthConnectorItemCommandDTO): Promise<void> {
    this.repositoryService.southItemRepository.updateSouthItem(southItem.id, command);
    const newItem = this.repositoryService.southItemRepository.getSouthItem(southItem.id)!;

    // Handle all cases regarding cache changes when the scan mode changes
    this.onSouthItemScanModeChange(southId, southItem, newItem);
    await this.oibusEngine.onSouthItemsChange(southId);
  }

  onCreateOrUpdateSouthItems(
    southConnector: SouthConnectorDTO,
    itemsToAdd: Array<SouthConnectorItemCommandDTO>,
    itemsToUpdate: Array<SouthConnectorItemCommandDTO>
  ) {
    const allPreviousSouthItems = this.repositoryService.southItemRepository.getSouthItems(southConnector.id);
    this.repositoryService.southItemRepository.createAndUpdateSouthItems(southConnector.id, itemsToAdd, itemsToUpdate);

    for (const newItem of itemsToUpdate) {
      const previousItem = allPreviousSouthItems.find(i => i.id === newItem.id);
      if (previousItem) {
        this.onSouthItemScanModeChange(southConnector.id, previousItem, newItem);
      }
    }
  }

  async onDeleteSouthItem(itemId: string): Promise<void> {
    const southItem = this.repositoryService.southItemRepository.getSouthItem(itemId);
    if (!southItem) throw new Error('South item not found');
    this.repositoryService.southItemRepository.deleteSouthItem(itemId);
    this.safeDeleteSouthCacheEntry(southItem);
  }

  async onEnableSouthItem(itemId: string): Promise<void> {
    const southItem = this.repositoryService.southItemRepository.getSouthItem(itemId);
    if (!southItem) throw new Error('South item not found');
    this.repositoryService.southItemRepository.enableSouthItem(itemId);
    await this.oibusEngine.onSouthItemsChange(southItem.connectorId);
  }

  async onDisableSouthItem(itemId: string): Promise<void> {
    const southItem = this.repositoryService.southItemRepository.getSouthItem(itemId);
    if (!southItem) throw new Error('South item not found');
    this.repositoryService.southItemRepository.disableSouthItem(itemId);
    await this.oibusEngine.onSouthItemsChange(southItem.connectorId);
  }

  async onDeleteAllSouthItems(southId: string): Promise<void> {
    this.repositoryService.southItemRepository.deleteAllSouthItems(southId);
    this.repositoryService.southCacheRepository.deleteAllCacheScanModes(southId);
    await this.oibusEngine.onSouthItemsChange(southId);
  }

  async onCreateNorth(command: NorthConnectorCommandDTO): Promise<NorthConnectorDTO> {
    const northConnector = this.repositoryService.northConnectorRepository.createNorthConnector(command);
    await this.oibusEngine.createNorth(northConnector);
    return northConnector;
  }

  async onUpdateNorthSettings(northId: string, command: NorthConnectorCommandDTO): Promise<void> {
    const previousSettings = this.repositoryService.northConnectorRepository.getNorthConnector(northId)!;
    this.repositoryService.northConnectorRepository.updateNorthConnector(northId, command);

    if (previousSettings.name !== command.name) {
      this.oibusEngine.setLogger(this.oibusEngine.logger);
    }
    if (command.enabled) {
      this.repositoryService.northConnectorRepository.startNorthConnector(northId);
      await this.oibusEngine.reloadNorth(northId);
    } else {
      this.repositoryService.northConnectorRepository.stopNorthConnector(northId);
      await this.oibusEngine.stopNorth(northId);
    }
  }

  async onDeleteNorth(northId: string): Promise<void> {
    const { id, name } = this.repositoryService.northConnectorRepository.getNorthConnector(northId)!;
    await this.oibusEngine.deleteNorth(id, name);
    this.repositoryService.northConnectorRepository.deleteNorthConnector(id);
    this.repositoryService.logRepository.deleteLogsByScopeId('north', id);
    this.repositoryService.northMetricsRepository.removeMetrics(id);
  }

  async onStartNorth(northId: string): Promise<void> {
    this.repositoryService.northConnectorRepository.startNorthConnector(northId);
    await this.oibusEngine.startNorth(northId);
  }

  async onStopNorth(northId: string): Promise<void> {
    await this.oibusEngine.stopNorth(northId);
    this.repositoryService.northConnectorRepository.stopNorthConnector(northId);
  }

  async onCreateNorthSubscription(northId: string, southId: string): Promise<void> {
    this.repositoryService.subscriptionRepository.createNorthSubscription(northId, southId);
    this.oibusEngine.updateNorthConnectorSubscriptions(northId);
  }

  async onDeleteNorthSubscription(northId: string, southId: string): Promise<void> {
    this.repositoryService.subscriptionRepository.deleteNorthSubscription(northId, southId);
    this.oibusEngine.updateNorthConnectorSubscriptions(northId);
  }

  async onCreateHistoryQuery(
    command: HistoryQueryCommandDTO,
    southItems: Array<SouthConnectorItemDTO> | Array<SouthConnectorItemScanModeNameDTO>
  ): Promise<HistoryQueryDTO> {
    const historyQuery = this.repositoryService.historyQueryRepository.createHistoryQuery(command);
    for (const item of southItems) {
      this.repositoryService.historyQueryItemRepository.createHistoryItem(historyQuery.id, {
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
    const previousSettings = this.repositoryService.historyQueryRepository.getHistoryQuery(historyId)!;
    this.repositoryService.historyQueryRepository.setHistoryQueryStatus(historyId, 'PENDING');
    this.repositoryService.historyQueryRepository.updateHistoryQuery(historyId, command);
    if (previousSettings.name !== command.name) {
      this.historyEngine.setLogger(this.historyEngine.logger);
    }
  }

  async onStartHistoryQuery(historyId: string): Promise<void> {
    this.repositoryService.historyQueryRepository.setHistoryQueryStatus(historyId, 'RUNNING');
    await this.historyEngine.startHistoryQuery(historyId);
  }

  async onPauseHistoryQuery(historyId: string): Promise<void> {
    await this.historyEngine.stopHistoryQuery(historyId);
    this.repositoryService.historyQueryRepository.setHistoryQueryStatus(historyId, 'PAUSED');
  }

  async onDeleteHistoryQuery(historyId: string): Promise<void> {
    const { name, id } = this.repositoryService.historyQueryRepository.getHistoryQuery(historyId)!;
    await this.historyEngine.deleteHistoryQuery(id, name);

    this.repositoryService.historyQueryItemRepository.deleteAllItems(id);
    this.repositoryService.historyQueryRepository.deleteHistoryQuery(id);
    this.repositoryService.logRepository.deleteLogsByScopeId('history-query', id);
  }

  async onCreateHistoryItem(historyId: string, command: SouthConnectorItemCommandDTO): Promise<SouthConnectorItemDTO> {
    await this.historyEngine.stopHistoryQuery(historyId);
    const historyItem = this.repositoryService.historyQueryItemRepository.createHistoryItem(historyId, command);
    await this.historyEngine.startHistoryQuery(historyId);
    return historyItem;
  }

  async onUpdateHistoryItemsSettings(historyId: string, item: SouthConnectorItemDTO, command: SouthConnectorItemCommandDTO): Promise<void> {
    await this.historyEngine.stopHistoryQuery(historyId);
    this.repositoryService.historyQueryItemRepository.updateHistoryItem(item.id, command);
    await this.historyEngine.startHistoryQuery(historyId);
  }

  async onDeleteHistoryItem(historyId: string, itemId: string): Promise<void> {
    this.repositoryService.historyQueryItemRepository.deleteHistoryItem(itemId);
  }

  async onEnableHistoryItem(historyId: string, itemId: string): Promise<void> {
    const item = this.repositoryService.historyQueryItemRepository.getHistoryItem(itemId);
    if (!item) {
      throw new Error('History item not found');
    }
    await this.historyEngine.stopHistoryQuery(historyId);
    this.repositoryService.historyQueryItemRepository.enableHistoryItem(itemId);
    await this.historyEngine.startHistoryQuery(historyId);
  }

  async onDisableHistoryItem(historyId: string, itemId: string): Promise<void> {
    const item = this.repositoryService.historyQueryItemRepository.getHistoryItem(itemId);
    if (!item) throw new Error('History item not found');
    await this.historyEngine.stopHistoryQuery(historyId);
    this.repositoryService.historyQueryItemRepository.disableHistoryItem(itemId);
    await this.historyEngine.startHistoryQuery(historyId);
  }

  async onDeleteAllHistoryItems(historyId: string): Promise<void> {
    this.repositoryService.historyQueryItemRepository.deleteAllItems(historyId);
  }

  async onCreateOrUpdateHistoryQueryItems(
    historyQuery: HistoryQueryDTO,
    itemsToAdd: Array<SouthHistoryQueryItemDTO>,
    itemsToUpdate: Array<SouthHistoryQueryItemDTO>
  ): Promise<void> {
    this.repositoryService.historyQueryItemRepository.createAndUpdateItems(historyQuery.id, itemsToAdd, itemsToUpdate);
  }

  async getErrorFiles(northId: string, start: Instant, end: Instant, fileNameContains: string): Promise<Array<NorthCacheFiles>> {
    return await this.oibusEngine.getErrorFiles(northId, start, end, fileNameContains);
  }

  async onUpdateScanMode(scanModeId: string, scanModeCommand: ScanModeCommandDTO) {
    const oldScanMode = this.repositoryService.scanModeRepository.getScanMode(scanModeId);
    if (!oldScanMode) {
      throw new Error(`Scan mode ${scanModeId} not found`);
    }
    this.repositoryService.scanModeRepository.updateScanMode(scanModeId, scanModeCommand);
    const newScanMode = this.repositoryService.scanModeRepository.getScanMode(scanModeId)!;
    if (oldScanMode.cron !== scanModeCommand.cron) {
      await this.oibusEngine.updateScanMode(newScanMode);
    }
  }

  /**
   * Handle the change of a south item's scan mode
   */
  private onSouthItemScanModeChange(southId: string, previousItem: SouthConnectorItemDTO, newItem: SouthConnectorItemCommandDTO) {
    const settings = this.repositoryService.southConnectorRepository.getSouthConnector(southId)!;
    const oldScanModeId = previousItem.scanModeId;
    const newScanModeId = newItem.scanModeId!;

    if (oldScanModeId === newScanModeId) {
      return;
    }

    const southItemId = settings.history.maxInstantPerItem ? previousItem.id : 'all';
    const previousCacheEntry = this.repositoryService.southCacheRepository.getSouthCacheScanMode(southId, oldScanModeId, southItemId);
    const newCacheEntry = this.repositoryService.southCacheRepository.getSouthCacheScanMode(southId, newScanModeId, southItemId);

    // If the south hasn't been started yet, the previous cache entry won't exist
    if (!previousCacheEntry) {
      return;
    }

    // Max instant per item is enabled
    if (settings.history.maxInstantPerItem) {
      // 1. Remove the previous cache entry
      this.safeDeleteSouthCacheEntry(previousItem);

      // 2. Create the new cache entry, with the previous max instant
      this.repositoryService.southCacheRepository.createOrUpdateCacheScanMode({
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
        this.repositoryService.southCacheRepository.createOrUpdateCacheScanMode({
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
    this.repositoryService.southCacheRepository.deleteAllCacheScanModes(southId);

    // Max instant per item is being enabled
    if (newSettings.history.maxInstantPerItem) {
      const southItems = this.repositoryService.southItemRepository.getSouthItems(southId);

      // 2. Create new cache entries for each item
      // The max instant of these new entries, will be the max instant of the previously removed ones, based on scan mode
      for (const item of southItems) {
        const maxInstant = maxInstantsByScanMode.get(item.scanModeId);
        if (maxInstant) {
          this.repositoryService.southCacheRepository.createOrUpdateCacheScanMode({
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
        this.repositoryService.southCacheRepository.createOrUpdateCacheScanMode({ southId, itemId: 'all', scanModeId, maxInstant });
      }
    }
  }

  /**
   * Safely delete the cache entries of a south item, when the south item is deleted
   */
  private safeDeleteSouthCacheEntry(southItem: SouthConnectorItemDTO) {
    const southConnector = this.repositoryService.southConnectorRepository.getSouthConnector(southItem.connectorId);
    if (!southConnector) {
      return;
    }

    if (southConnector.history.maxInstantPerItem) {
      this.repositoryService.southCacheRepository.deleteCacheScanModesByItem(southItem.id);
    }

    if (!southConnector.history.maxInstantPerItem) {
      const southItems = this.repositoryService.southItemRepository.getSouthItems(southItem.connectorId);
      const isOldScanModeUnused = !southItems.some(item => item.scanModeId === southItem.scanModeId);
      if (isOldScanModeUnused) {
        this.repositoryService.southCacheRepository.deleteCacheScanMode(southItem.id, southItem.scanModeId, 'all');
      }
    }
  }
}
