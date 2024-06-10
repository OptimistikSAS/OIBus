import RepositoryService from './repository.service';
import LoggerService from './logger/logger.service';

import { EngineSettingsDTO } from '../../../shared/model/engine.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO
} from '../../../shared/model/south-connector.model';
import { NorthCacheFiles, NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../shared/model/north-connector.model';
import { HistoryQueryCommandDTO, HistoryQueryDTO } from '../../../shared/model/history-query.model';
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
    if (command.enabled) {
      await this.oibusEngine.startSouth(southConnector.id, southConnector);
    }
    return southConnector;
  }

  async onUpdateSouth(southId: string, command: SouthConnectorCommandDTO): Promise<void> {
    await this.oibusEngine.stopSouth(southId);

    const previousSettings = this.repositoryService.southConnectorRepository.getSouthConnector(southId)!;
    this.repositoryService.southConnectorRepository.updateSouthConnector(southId, command);

    // Handle all cases regarding cache changes when max instant per item changes
    this.onSouthMaxInstantPerItemChange(southId, previousSettings, command);

    if (command.enabled) {
      this.repositoryService.southConnectorRepository.startSouthConnector(southId);
      const settings = this.repositoryService.southConnectorRepository.getSouthConnector(southId)!;
      await this.oibusEngine.startSouth(southId, settings);
    } else {
      this.repositoryService.southConnectorRepository.stopSouthConnector(southId);
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
    const settings = this.repositoryService.southConnectorRepository.getSouthConnector(southId);
    await this.oibusEngine.startSouth(southId, settings!);
  }

  async onStopSouth(southId: string): Promise<void> {
    await this.oibusEngine.stopSouth(southId);
    this.repositoryService.southConnectorRepository.stopSouthConnector(southId);
  }

  async onCreateSouthItem(southId: string, command: SouthConnectorItemCommandDTO): Promise<SouthConnectorItemDTO> {
    const southItem = this.repositoryService.southItemRepository.createSouthItem(southId, command);
    this.oibusEngine.addItemToSouth(southId, southItem);
    return southItem;
  }

  async onUpdateSouthItemsSettings(
    southId: string,
    southItem: SouthConnectorItemDTO,
    command: SouthConnectorItemCommandDTO
  ): Promise<void> {
    this.repositoryService.southItemRepository.updateSouthItem(southItem.id, command);
    const newItem = this.repositoryService.southItemRepository.getSouthItem(southItem.id)!;

    // Handle all cases regarding cache changes when the scan mode changes
    this.onSouthItemScanModeChange(southId, southItem, newItem);

    this.oibusEngine.updateItemInSouth(southId, southItem, newItem);
  }

  async onCreateOrUpdateSouthItems(
    southConnector: SouthConnectorDTO,
    itemsToAdd: Array<SouthConnectorItemCommandDTO>,
    itemsToUpdate: Array<SouthConnectorItemCommandDTO>,
    restart = true
  ): Promise<void> {
    await this.oibusEngine.stopSouth(southConnector.id);

    const allPreviousSouthItems = this.repositoryService.southItemRepository.getSouthItems(southConnector.id);
    this.repositoryService.southItemRepository.createAndUpdateSouthItems(southConnector.id, itemsToAdd, itemsToUpdate);

    for (const newItem of itemsToUpdate) {
      const previousItem = allPreviousSouthItems.find(i => i.id === newItem.id);
      if (previousItem) {
        this.onSouthItemScanModeChange(southConnector.id, previousItem, newItem);
      }
    }

    if (restart) {
      await this.oibusEngine.startSouth(southConnector.id, southConnector);
    }
  }

  async onDeleteSouthItem(itemId: string): Promise<void> {
    const southItem = this.repositoryService.southItemRepository.getSouthItem(itemId);
    if (!southItem) throw new Error('South item not found');
    this.oibusEngine.deleteItemFromSouth(southItem.connectorId, southItem);
    this.repositoryService.southItemRepository.deleteSouthItem(itemId);
    this.safeDeleteSouthCacheEntry(southItem);
  }

  async onEnableSouthItem(itemId: string): Promise<void> {
    const southItem = this.repositoryService.southItemRepository.getSouthItem(itemId);
    if (!southItem) throw new Error('South item not found');
    this.repositoryService.southItemRepository.enableSouthItem(itemId);
    this.oibusEngine.updateItemInSouth(southItem.connectorId, southItem, { ...southItem, enabled: true });
  }

  async onDisableSouthItem(itemId: string): Promise<void> {
    const southItem = this.repositoryService.southItemRepository.getSouthItem(itemId);
    if (!southItem) throw new Error('South item not found');
    this.repositoryService.southItemRepository.disableSouthItem(itemId);
    this.oibusEngine.updateItemInSouth(southItem.connectorId, southItem, { ...southItem, enabled: false });
  }

  async onDeleteAllSouthItems(southId: string): Promise<void> {
    this.oibusEngine.deleteAllItemsFromSouth(southId);
    this.repositoryService.southItemRepository.deleteAllSouthItems(southId);
    this.repositoryService.southCacheRepository.deleteAllCacheScanModes(southId);
  }

  async onCreateNorth(command: NorthConnectorCommandDTO): Promise<NorthConnectorDTO> {
    return this.repositoryService.northConnectorRepository.createNorthConnector(command);
  }

  async onUpdateNorthSettings(northId: string, command: NorthConnectorCommandDTO): Promise<void> {
    await this.oibusEngine.stopNorth(northId);
    this.repositoryService.northConnectorRepository.updateNorthConnector(northId, command);
    if (command.enabled) {
      this.repositoryService.northConnectorRepository.startNorthConnector(northId);
      const settings = this.repositoryService.northConnectorRepository.getNorthConnector(northId)!;
      await this.oibusEngine.startNorth(northId, settings);
    } else {
      this.repositoryService.northConnectorRepository.stopNorthConnector(northId);
    }
  }

  async onDeleteNorth(northId: string): Promise<void> {
    const { name, id } = this.repositoryService.northConnectorRepository.getNorthConnector(northId)!;
    await this.oibusEngine.deleteNorth(id, name);
    this.repositoryService.northConnectorRepository.deleteNorthConnector(id);
    this.repositoryService.logRepository.deleteLogsByScopeId('north', id);
    this.repositoryService.northMetricsRepository.removeMetrics(id);
  }

  async onStartNorth(northId: string): Promise<void> {
    this.repositoryService.northConnectorRepository.startNorthConnector(northId);
    const settings = this.repositoryService.northConnectorRepository.getNorthConnector(northId);
    await this.oibusEngine.startNorth(northId, settings!);
  }

  async onStopNorth(northId: string): Promise<void> {
    await this.oibusEngine.stopNorth(northId);
    this.repositoryService.northConnectorRepository.stopNorthConnector(northId);
  }

  async onCreateNorthSubscription(northId: string, southId: string): Promise<void> {
    await this.oibusEngine.stopNorth(northId);
    this.repositoryService.subscriptionRepository.createNorthSubscription(northId, southId);
    const settings = this.repositoryService.northConnectorRepository.getNorthConnector(northId);
    if (settings && settings.enabled) {
      await this.oibusEngine.startNorth(northId, settings);
    }
  }

  async onCreateExternalNorthSubscription(northId: string, externalSourceId: string): Promise<void> {
    await this.oibusEngine.stopNorth(northId);
    this.repositoryService.subscriptionRepository.createExternalNorthSubscription(northId, externalSourceId);
    const settings = this.repositoryService.northConnectorRepository.getNorthConnector(northId);
    if (settings && settings.enabled) {
      await this.oibusEngine.startNorth(northId, settings);
    }
  }

  async onDeleteNorthSubscription(northId: string, southId: string): Promise<void> {
    await this.oibusEngine.stopNorth(northId);
    this.repositoryService.subscriptionRepository.deleteNorthSubscription(northId, southId);
    const settings = this.repositoryService.northConnectorRepository.getNorthConnector(northId);
    if (settings && settings.enabled) {
      await this.oibusEngine.startNorth(northId, settings);
    }
  }

  async onDeleteExternalNorthSubscription(northId: string, externalSourceId: string): Promise<void> {
    await this.oibusEngine.stopNorth(northId);
    this.repositoryService.subscriptionRepository.deleteExternalNorthSubscription(northId, externalSourceId);
    const settings = this.repositoryService.northConnectorRepository.getNorthConnector(northId);
    if (settings && settings.enabled) {
      await this.oibusEngine.startNorth(northId, settings);
    }
  }

  async onCreateHistoryQuery(command: HistoryQueryCommandDTO, southItems: Array<SouthConnectorItemDTO>): Promise<HistoryQueryDTO> {
    const historyQuery = this.repositoryService.historyQueryRepository.createHistoryQuery(command);
    for (const item of southItems) {
      this.repositoryService.historyQueryItemRepository.createHistoryItem(historyQuery.id, {
        name: item.name,
        enabled: item.enabled,
        settings: item.settings,
        scanModeId: 'history'
      });
    }
    return historyQuery;
  }

  async onUpdateHistoryQuerySettings(historyId: string, command: HistoryQueryCommandDTO): Promise<void> {
    this.repositoryService.historyQueryRepository.setHistoryQueryStatus(historyId, 'PENDING');
    await this.historyEngine.stopHistoryQuery(historyId, true); // Reset cache to start the history from scratch when changing the settings
    this.repositoryService.historyQueryRepository.updateHistoryQuery(historyId, command);
  }

  async onStartHistoryQuery(historyId: string): Promise<void> {
    this.repositoryService.historyQueryRepository.setHistoryQueryStatus(historyId, 'RUNNING');
    const settings = this.repositoryService.historyQueryRepository.getHistoryQuery(historyId);
    await this.historyEngine.startHistoryQuery(settings!);
  }

  async onRestartHistoryQuery(historyId: string): Promise<void> {
    await this.historyEngine.stopHistoryQuery(historyId, true);
    this.repositoryService.historyQueryRepository.setHistoryQueryStatus(historyId, 'RUNNING');
    const settings = this.repositoryService.historyQueryRepository.getHistoryQuery(historyId);
    await this.historyEngine.startHistoryQuery(settings!);
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
    await this.historyEngine.stopHistoryQuery(historyId, true);
    const historyItem = this.repositoryService.historyQueryItemRepository.createHistoryItem(historyId, command);
    await this.historyEngine.addItemToHistoryQuery(historyId, historyItem);
    return historyItem;
  }

  async onUpdateHistoryItemsSettings(historyId: string, item: SouthConnectorItemDTO, command: SouthConnectorItemCommandDTO): Promise<void> {
    await this.historyEngine.stopHistoryQuery(historyId, true);
    this.repositoryService.historyQueryItemRepository.updateHistoryItem(item.id, command);
    const historyItem = this.repositoryService.historyQueryItemRepository.getHistoryItem(item.id);
    await this.historyEngine.updateItemInHistoryQuery(historyId, historyItem);
  }

  async onDeleteHistoryItem(historyId: string, itemId: string): Promise<void> {
    await this.historyEngine.stopHistoryQuery(historyId, true);
    const item = this.repositoryService.historyQueryItemRepository.getHistoryItem(itemId);
    this.repositoryService.historyQueryItemRepository.deleteHistoryItem(itemId);
    await this.historyEngine.deleteItemFromHistoryQuery(historyId, item);
  }

  async onEnableHistoryItem(historyId: string, itemId: string): Promise<void> {
    const item = this.repositoryService.historyQueryItemRepository.getHistoryItem(itemId);
    if (!item) throw new Error('History item not found');
    this.repositoryService.historyQueryItemRepository.enableHistoryItem(itemId);
    await this.historyEngine.updateItemInHistoryQuery(historyId, { ...item, enabled: true });
  }

  async onDisableHistoryItem(historyId: string, itemId: string): Promise<void> {
    const item = this.repositoryService.historyQueryItemRepository.getHistoryItem(itemId);
    if (!item) throw new Error('History item not found');
    this.repositoryService.historyQueryItemRepository.disableHistoryItem(itemId);
    await this.historyEngine.updateItemInHistoryQuery(historyId, { ...item, enabled: false });
  }

  async onDeleteAllHistoryItems(historyId: string): Promise<void> {
    await this.historyEngine.stopHistoryQuery(historyId, true);
    await this.historyEngine.deleteAllItemsFromHistoryQuery(historyId);
    this.repositoryService.historyQueryItemRepository.deleteAllItems(historyId);
  }

  async onCreateOrUpdateHistoryQueryItems(
    historyQuery: HistoryQueryDTO,
    itemsToAdd: Array<SouthConnectorItemDTO>,
    itemsToUpdate: Array<SouthConnectorItemDTO>
  ): Promise<void> {
    await this.historyEngine.stopHistoryQuery(historyQuery.id, true);
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
