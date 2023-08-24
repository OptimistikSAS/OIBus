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
    private readonly _historyEngine: HistoryQueryEngine
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
      await this.loggerService.stop();
      await this.loggerService.start(newSettings.id, newSettings.name, newSettings.logParameters);
      await this.webServerChangeLoggerCallback(this.loggerService.createChildLogger('web-server'));
      await this.engineMetricsService.setLogger(this.loggerService.createChildLogger('metrics'));
      await this.oibusEngine.setLogger(this.loggerService.createChildLogger('data-stream'));
    }
    if (!oldSettings || oldSettings.port !== newSettings.port) {
      await this.webServerChangePortCallback(newSettings.port);
    }
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
    this.repositoryService.southConnectorRepository.updateSouthConnector(southId, command);
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

    const { name } = this.repositoryService.southConnectorRepository.getSouthConnector(southId)!;
    await this.oibusEngine.deleteSouth(southId, name);

    this.repositoryService.southItemRepository.deleteAllSouthItems(southId);
    this.repositoryService.southConnectorRepository.deleteSouthConnector(southId);

    this.repositoryService.logRepository.deleteLogsByScopeId('south', southId);
    this.repositoryService.southMetricsRepository.removeMetrics(southId);
    this.repositoryService.southCacheRepository.deleteAllCacheScanModes(southId);
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
    this.oibusEngine.updateItemInSouth(southId, southItem, newItem);
  }

  async onCreateOrUpdateSouthItems(
    southConnector: SouthConnectorDTO,
    itemsToAdd: Array<SouthConnectorItemDTO>,
    itemsToUpdate: Array<SouthConnectorItemDTO>
  ): Promise<void> {
    await this.oibusEngine.stopSouth(southConnector.id);
    this.repositoryService.southItemRepository.createAndUpdateSouthItems(southConnector.id, itemsToAdd, itemsToUpdate);
    await this.oibusEngine.startSouth(southConnector.id, southConnector);
  }

  async onDeleteSouthItem(itemId: string): Promise<void> {
    const southItem = this.repositoryService.southItemRepository.getSouthItem(itemId);
    if (!southItem) throw new Error('South item not found');
    this.oibusEngine.deleteItemFromSouth(southItem.connectorId, southItem);
    this.repositoryService.southItemRepository.deleteSouthItem(itemId);
    this.repositoryService.southCacheRepository.deleteCacheScanModesByItem(itemId);
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
  }

  async onCreateNorth(command: NorthConnectorCommandDTO): Promise<NorthConnectorDTO> {
    const northSettings = this.repositoryService.northConnectorRepository.createNorthConnector(command);
    if (command.enabled) {
      await this.oibusEngine.startNorth(northSettings.id, northSettings);
    }
    return northSettings;
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
    const { name } = this.repositoryService.northConnectorRepository.getNorthConnector(northId)!;
    await this.oibusEngine.deleteNorth(northId, name);
    this.repositoryService.northConnectorRepository.deleteNorthConnector(northId);
    this.repositoryService.logRepository.deleteLogsByScopeId('north', northId);
    this.repositoryService.northMetricsRepository.removeMetrics(northId);
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
    await this.historyEngine.stopHistoryQuery(historyId, true); // Reset cache to start the history from scratch when changing the settings
    this.repositoryService.historyQueryRepository.updateHistoryQuery(historyId, command);
    if (command.enabled) {
      this.repositoryService.historyQueryRepository.startHistoryQuery(historyId);
      const settings = this.repositoryService.historyQueryRepository.getHistoryQuery(historyId)!;
      await this.historyEngine.startHistoryQuery(settings);
    } else {
      this.repositoryService.historyQueryRepository.stopHistoryQuery(historyId);
    }
  }

  async onStartHistoryQuery(historyId: string): Promise<void> {
    this.repositoryService.historyQueryRepository.startHistoryQuery(historyId);
    const settings = this.repositoryService.historyQueryRepository.getHistoryQuery(historyId);
    await this.historyEngine.startHistoryQuery(settings!);
  }

  async onStopHistoryQuery(historyId: string): Promise<void> {
    await this.historyEngine.stopHistoryQuery(historyId);
    this.repositoryService.historyQueryRepository.stopHistoryQuery(historyId);
  }

  async onDeleteHistoryQuery(historyId: string): Promise<void> {
    const { name } = this.repositoryService.historyQueryRepository.getHistoryQuery(historyId)!;
    await this.historyEngine.deleteHistoryQuery(historyId, name);

    this.repositoryService.historyQueryItemRepository.deleteAllItems(historyId);
    this.repositoryService.historyQueryRepository.deleteHistoryQuery(historyId);
    this.repositoryService.logRepository.deleteLogsByScopeId('history-query', historyId);
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
    await this.historyEngine.stopHistoryQuery(historyQuery.id);
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
}
