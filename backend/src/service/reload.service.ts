import RepositoryService from './repository.service';
import LoggerService from './logger/logger.service';

import { EngineSettingsDTO } from '../../../shared/model/engine.model';
import {
  OibusItemCommandDTO,
  OibusItemDTO,
  SouthConnectorCommandDTO,
  SouthConnectorDTO
} from '../../../shared/model/south-connector.model';
import { NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../shared/model/north-connector.model';
import { HistoryQueryCommandDTO, HistoryQueryDTO } from '../../../shared/model/history-query.model';
import pino from 'pino';
import HealthSignalService from './health-signal.service';
import NorthService from './north.service';
import SouthService from './south.service';
import OIBusEngine from '../engine/oibus-engine';

export default class ReloadService {
  private webServerChangeLoggerCallback: (logger: pino.Logger) => void = () => {};
  private webServerChangePortCallback: (port: number) => Promise<void> = () => Promise.resolve();

  constructor(
    private readonly _loggerService: LoggerService,
    private readonly _repositoryService: RepositoryService,
    private readonly _healthSignalService: HealthSignalService,
    private readonly _northService: NorthService,
    private readonly _southService: SouthService,
    private readonly _oibusEngine: OIBusEngine
  ) {}

  get repositoryService(): RepositoryService {
    return this._repositoryService;
  }

  get loggerService(): LoggerService {
    return this._loggerService;
  }

  get healthSignalService(): HealthSignalService {
    return this._healthSignalService;
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

  setWebServerChangeLogger(callback: (logger: pino.Logger) => void): void {
    this.webServerChangeLoggerCallback = callback;
  }

  setWebServerChangePort(callback: (port: number) => Promise<void>): void {
    this.webServerChangePortCallback = callback;
  }

  async onUpdateOibusSettings(oldSettings: EngineSettingsDTO | null, newSettings: EngineSettingsDTO): Promise<void> {
    if (!oldSettings || JSON.stringify(oldSettings.logParameters) !== JSON.stringify(newSettings.logParameters)) {
      await this.loggerService.stop();
      await this.loggerService.start(newSettings.id, newSettings.logParameters);
      await this.webServerChangeLoggerCallback(this.loggerService.createChildLogger('web-server'));
      await this.healthSignalService.setLogger(this.loggerService.createChildLogger('health'));
      await this.oibusEngine.setLogger(this.loggerService.createChildLogger('engine'));
    }
    if (!oldSettings || oldSettings.port !== newSettings.port) {
      await this.webServerChangePortCallback(newSettings.port);
    }
    if (!oldSettings || JSON.stringify(oldSettings.healthSignal) !== JSON.stringify(newSettings.healthSignal)) {
      await this.healthSignalService.setSettings(newSettings.healthSignal);
    }
  }

  async onCreateSouth(command: SouthConnectorCommandDTO): Promise<SouthConnectorDTO> {
    const southSettings = this.repositoryService.southConnectorRepository.createSouthConnector(command);
    await this.oibusEngine.startSouth(southSettings.id, southSettings);
    return southSettings;
  }

  async onUpdateSouthSettings(southId: string, command: SouthConnectorCommandDTO): Promise<void> {
    await this.oibusEngine.stopSouth(southId);
    this.repositoryService.southConnectorRepository.updateSouthConnector(southId, command);
    const settings = this.repositoryService.southConnectorRepository.getSouthConnector(southId);
    await this.oibusEngine.startSouth(southId, settings);
  }

  async onDeleteSouth(southId: string): Promise<void> {
    await this.oibusEngine.stopSouth(southId);
    this.repositoryService.southItemRepository.deleteSouthItemByConnectorId(southId);
    this.repositoryService.southConnectorRepository.deleteSouthConnector(southId);
  }

  async onCreateSouthItem(southId: string, command: OibusItemCommandDTO): Promise<OibusItemDTO> {
    const southItem = this.repositoryService.southItemRepository.createSouthItem(southId, command);
    this.oibusEngine.addItemToSouth(southId, southItem);
    return southItem;
  }

  async onUpdateSouthItemsSettings(southId: string, southItem: OibusItemDTO, command: OibusItemCommandDTO): Promise<void> {
    this.repositoryService.southItemRepository.updateSouthItem(southItem.id, command);
    this.oibusEngine.updateItemInSouth(southId, southItem, command);
  }

  async onDeleteSouthItem(itemId: string): Promise<void> {
    const southItem = this.repositoryService.southItemRepository.getSouthItem(itemId);
    this.oibusEngine.deleteItemFromSouth(southItem.connectorId, southItem);
    this.repositoryService.southItemRepository.deleteSouthItem(itemId);
  }

  async onCreateNorth(command: NorthConnectorCommandDTO): Promise<NorthConnectorDTO> {
    const northSettings = this.repositoryService.northConnectorRepository.createNorthConnector(command);
    await this.oibusEngine.startNorth(northSettings.id, northSettings);
    return northSettings;
  }

  async onUpdateNorthSettings(northId: string, command: NorthConnectorCommandDTO): Promise<void> {
    await this.oibusEngine.stopNorth(northId);
    this.repositoryService.northConnectorRepository.updateNorthConnector(northId, command);
    const settings = this.repositoryService.northConnectorRepository.getNorthConnector(northId);
    await this.oibusEngine.startNorth(northId, settings);
  }

  async onDeleteNorth(northId: string): Promise<void> {
    await this.oibusEngine.stopNorth(northId);
    this.repositoryService.northConnectorRepository.deleteNorthConnector(northId);
  }

  async onCreateHistoryQuery(command: HistoryQueryCommandDTO, southItems: Array<OibusItemDTO>): Promise<HistoryQueryDTO> {
    const historyQuery = this.repositoryService.historyQueryRepository.createHistoryQuery(command);
    for (const item of southItems) {
      this.repositoryService.historyQueryItemRepository.createHistoryItem(historyQuery.id, {
        name: item.name,
        settings: item.settings,
        scanModeId: null
      });
    }
    // TODO: start history query engine
    return historyQuery;
  }

  async onUpdateHistoryQuerySettings(historyId: string, command: HistoryQueryCommandDTO): Promise<void> {
    // TODO: stop history query engine
    this.repositoryService.historyQueryRepository.updateHistoryQuery(historyId, command);
    // TODO: start history query engine
  }

  async onDeleteHistoryQuery(historyId: string): Promise<void> {
    // TODO: stop history query engine
    this.repositoryService.historyQueryItemRepository.deleteHistoryItemByHistoryId(historyId);
    this.repositoryService.historyQueryRepository.deleteHistoryQuery(historyId);
  }

  async onCreateHistoryItem(historyId: string, command: OibusItemCommandDTO): Promise<OibusItemDTO> {
    const historyItem = this.repositoryService.historyQueryItemRepository.createHistoryItem(historyId, command);
    // TODO: stop history query engine
    // TODO: start history query engine
    return historyItem;
  }

  async onUpdateHistoryItemsSettings(historyId: string, southItem: OibusItemDTO, command: OibusItemCommandDTO): Promise<void> {
    this.repositoryService.historyQueryItemRepository.updateHistoryItem(southItem.id, command);
    // TODO: stop history query engine
    // TODO: start history query engine
  }

  async onDeleteHistoryItem(itemId: string): Promise<void> {
    this.repositoryService.historyQueryItemRepository.getHistoryItem(itemId);
    // TODO: stop history query engine
    this.repositoryService.historyQueryItemRepository.deleteHistoryItem(itemId);
    // TODO: start history query engine
  }

  // TODO: on scan mode delete, add, update
  // TODO: on proxy delete, add, update
}
