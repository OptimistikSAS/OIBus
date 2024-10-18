import { SouthConnectorCommandDTO } from '../../../shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { HistoryQueryEntity, HistoryQueryEntityLight, HistoryQueryItemEntity } from '../model/histor-query.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryItemDTO,
  HistoryQueryItemSearchParam,
  HistoryQueryLightDTO
} from '../../../shared/model/history-query.model';
import { NorthConnectorCommandDTO } from '../../../shared/model/north-connector.model';
import EncryptionService from './encryption.service';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import { checkScanMode, createFolder } from './utils';
import SouthService, { southManifestList } from './south.service';
import NorthService, { northManifestList } from './north.service';
import LogRepository from '../repository/logs/log.repository';
import { Page } from '../../../shared/model/types';
import pino from 'pino';
import { OIBusContent } from '../../../shared/model/engine.model';
import { ScanMode } from '../model/scan-mode.model';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import multer from '@koa/multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import csv from 'papaparse';
import HistoryQueryEngine from '../engine/history-query-engine';
import HistoryQuery from '../engine/history-query';
import HistoryQueryMetricsRepository from '../repository/logs/history-query-metrics.repository';
import { PassThrough } from 'node:stream';

export default class HistoryQueryService {
  constructor(
    private readonly validator: JoiValidator,
    private readonly historyQueryRepository: HistoryQueryRepository,
    private readonly scanModeRepository: ScanModeRepository,
    private readonly logRepository: LogRepository,
    private readonly historyQueryMetricsRepository: HistoryQueryMetricsRepository,
    private readonly southService: SouthService,
    private readonly northService: NorthService,
    private readonly oIAnalyticsMessageService: OIAnalyticsMessageService,
    private readonly encryptionService: EncryptionService,
    private readonly historyQueryEngine: HistoryQueryEngine
  ) {}

  runHistoryQuery(settings: HistoryQueryEntityLight, baseFolder: string | undefined = undefined) {
    const historyQueryBaseFolder = baseFolder ?? this.getDefaultBaseFolder(settings.id);

    return new HistoryQuery(
      this.findById(settings.id)!,
      this.southService,
      this.northService,
      this.historyQueryRepository,
      historyQueryBaseFolder,
      this.historyQueryEngine.logger.child({ scopeType: 'history-query', scopeId: settings.id, scopeName: settings.name })
    );
  }

  async testNorth<N extends NorthSettings>(
    historyQueryId: string,
    command: NorthConnectorCommandDTO<N>,
    logger: pino.Logger
  ): Promise<void> {
    let historyQuery: HistoryQueryEntity<SouthSettings, N, SouthItemSettings> | null = null;
    if (historyQueryId !== 'create') {
      historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
      if (!historyQuery) {
        throw new Error(`History query ${historyQueryId} not found`);
      }
    }
    const manifest = this.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
    if (!manifest) {
      throw new Error(`North manifest ${command.type} not found`);
    }

    await this.validator.validateSettings(manifest.settings, command.settings);
    command.settings = await this.encryptionService.encryptConnectorSecrets<N>(
      command.settings,
      historyQuery?.northSettings || null,
      manifest.settings
    );

    return await this.northService.testNorth<N>('create', command, logger);
  }

  async testSouth<S extends SouthSettings>(
    historyQueryId: string,
    command: SouthConnectorCommandDTO<S, SouthItemSettings>,
    logger: pino.Logger
  ): Promise<void> {
    let historyQuery: HistoryQueryEntity<S, NorthSettings, SouthItemSettings> | null = null;
    if (historyQueryId !== 'create') {
      historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
      if (!historyQuery) {
        throw new Error(`History query ${historyQueryId} not found`);
      }
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === command.type);
    if (!manifest) {
      throw new Error(`South manifest ${command.type} not found`);
    }

    await this.validator.validateSettings(manifest.settings, command.settings);
    command.settings = await this.encryptionService.encryptConnectorSecrets<S>(
      command.settings,
      historyQuery?.southSettings || null,
      manifest.settings
    );
    return await this.southService.testSouth<S, SouthItemSettings>('create', command, logger);
  }

  async testSouthItem<S extends SouthSettings, I extends SouthItemSettings>(
    historyQueryId: string,
    command: SouthConnectorCommandDTO<S, I>,
    itemCommand: HistoryQueryItemCommandDTO<I>,
    callback: (data: OIBusContent) => void,
    logger: pino.Logger
  ): Promise<void> {
    let historyQuery: HistoryQueryEntity<S, NorthSettings, I> | null = null;
    if (historyQueryId !== 'create') {
      historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
      if (!historyQuery) {
        throw new Error(`History query ${historyQueryId} not found`);
      }
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === command.type);
    if (!manifest) {
      throw new Error(`South manifest ${command.type} not found`);
    }
    await this.validator.validateSettings(manifest.settings, command.settings);
    await this.validator.validateSettings(manifest.items.settings, itemCommand.settings);
    command.settings = await this.encryptionService.encryptConnectorSecrets<S>(
      command.settings,
      historyQuery?.southSettings || null,
      manifest.settings
    );
    return await this.southService.testSouthItem<S, I>(
      'create',
      command,
      { ...itemCommand, scanModeId: 'history', scanModeName: null },
      callback,
      logger
    );
  }

  findById<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings>(
    historyQueryId: string
  ): HistoryQueryEntity<S, N, I> | null {
    return this.historyQueryRepository.findHistoryQueryById<S, N, I>(historyQueryId);
  }

  findAll(): Array<HistoryQueryEntityLight> {
    return this.historyQueryRepository.findAllHistoryQueries();
  }

  async createHistoryQuery<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings>(
    command: HistoryQueryCommandDTO<S, N, I>
  ): Promise<HistoryQueryEntity<S, N, I>> {
    const southManifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === command.southType);
    if (!southManifest) {
      throw new Error('South manifest does not exist');
    }
    const northManifest = this.northService.getInstalledNorthManifests().find(southManifest => southManifest.id === command.northType);
    if (!northManifest) {
      throw new Error('North manifest does not exist');
    }
    await this.validator.validateSettings(northManifest.settings, command.northSettings);
    await this.validator.validateSettings(southManifest.settings, command.southSettings);
    // Check if item settings match the item schema, throw an error otherwise
    for (const item of command.items) {
      await this.validator.validateSettings(southManifest.items.settings, item.settings);
    }

    const historyQuery = {} as HistoryQueryEntity<S, N, I>;
    await copyHistoryQueryCommandToHistoryQueryEntity<S, N, I>(
      historyQuery,
      command,
      null,
      this.encryptionService,
      this.scanModeRepository.findAll()
    );
    this.historyQueryRepository.saveHistoryQuery<S, N, I>(historyQuery);
    this.oIAnalyticsMessageService.createHistoryQueryMessage(historyQuery);

    await createFolder(this.getDefaultBaseFolder(historyQuery.id));

    await this.historyQueryEngine.createHistoryQuery(
      this.runHistoryQuery(historyQuery)
    );
    return historyQuery;
  }

  getHistoryQueryDataStream(historyQueryId: string): PassThrough | null {
    return this.historyQueryEngine.getHistoryQueryDataStream(historyQueryId);
  }

  async updateHistoryQuery<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings>(
    historyQueryId: string,
    command: HistoryQueryCommandDTO<S, N, I>,
    resetCache: boolean
  ): Promise<void> {
    const previousSettings = this.historyQueryRepository.findHistoryQueryById<S, N, I>(historyQueryId);
    if (!previousSettings) {
      throw new Error(`History query ${historyQueryId} not found`);
    }
    const southManifest = this.southService.getInstalledSouthManifests().find(manifest => manifest.id === command.southType);
    if (!southManifest) {
      throw new Error(`South manifest not found for type ${command.southType}`);
    }
    const northManifest = this.northService.getInstalledNorthManifests().find(manifest => manifest.id === command.northType);
    if (!northManifest) {
      throw new Error(`North manifest not found for type ${command.northType}`);
    }
    await this.validator.validateSettings(northManifest.settings, previousSettings.northSettings);
    await this.validator.validateSettings(southManifest.settings, previousSettings.southSettings);
    // Check if item settings match the item schema, throw an error otherwise
    for (const item of command.items) {
      await this.validator.validateSettings(southManifest.items.settings, item.settings);
    }

    const historyQuery = { id: previousSettings.id } as HistoryQueryEntity<S, N, I>;
    await copyHistoryQueryCommandToHistoryQueryEntity<S, N, I>(
      historyQuery,
      command,
      previousSettings,
      this.encryptionService,
      this.scanModeRepository.findAll()
    );
    this.historyQueryRepository.saveHistoryQuery<S, N, I>(historyQuery);
    this.oIAnalyticsMessageService.createHistoryQueryMessage(historyQuery);
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, resetCache);
  }

  async deleteHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} not found`);
    }

    await this.historyQueryEngine.deleteHistoryQuery(historyQuery);
    this.historyQueryRepository.deleteHistoryQuery(historyQuery.id);
    this.historyQueryMetricsRepository.removeMetrics(historyQuery.id);
    this.logRepository.deleteLogsByScopeId('history-query', historyQuery.id);
    this.oIAnalyticsMessageService.createHistoryQueryMessage(historyQuery);
  }

  async startHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} not found`);
    }

    this.historyQueryRepository.updateHistoryQueryStatus(historyQueryId, 'RUNNING');
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, historyQuery.status === 'FINISHED' || historyQuery.status === 'ERRORED');
  }

  async pauseHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} not found`);
    }

    this.historyQueryRepository.updateHistoryQueryStatus(historyQueryId, 'PAUSED');
    await this.historyQueryEngine.stopHistoryQuery(historyQuery.id);
  }

  listItems<I extends SouthItemSettings>(
    historyQueryId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Array<HistoryQueryItemEntity<I>> {
    return this.historyQueryRepository.listHistoryQueryItems<I>(historyQueryId, searchParams);
  }

  searchHistoryQueryItems<I extends SouthItemSettings>(
    historyQueryId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Page<HistoryQueryItemEntity<I>> {
    return this.historyQueryRepository.searchHistoryQueryItems<I>(historyQueryId, searchParams);
  }

  findAllItemsForHistoryQuery<I extends SouthItemSettings>(historyQueryId: string): Array<HistoryQueryItemEntity<I>> {
    return this.historyQueryRepository.findAllItemsForHistoryQuery<I>(historyQueryId);
  }

  findHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): HistoryQueryItemEntity<SouthItemSettings> | null {
    return this.historyQueryRepository.findHistoryQueryItemById(historyQueryId, historyQueryItemId);
  }

  async createHistoryQueryItem<I extends SouthItemSettings>(
    historyQueryId: string,
    command: HistoryQueryItemCommandDTO<I>
  ): Promise<HistoryQueryItemEntity<I>> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History Query ${historyQueryId} does not exist`);
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === historyQuery.southType);
    if (!manifest) {
      throw new Error('South manifest does not exist');
    }
    await this.validator.validateSettings(manifest.items.settings, command.settings);

    const historyQueryItemEntity = {} as HistoryQueryItemEntity<I>;
    await copyHistoryQueryItemCommandToHistoryQueryItemEntity<I>(
      historyQueryItemEntity,
      command,
      null,
      historyQuery.southType,
      this.encryptionService
    );
    this.historyQueryRepository.saveHistoryQueryItem<I>(historyQuery.id, historyQueryItemEntity);

    this.oIAnalyticsMessageService.createHistoryQueryMessage(historyQuery);

    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
    return historyQueryItemEntity;
  }

  async updateHistoryQueryItem<I extends SouthItemSettings>(
    historyQueryId: string,
    historyQueryItemId: string,
    command: HistoryQueryItemCommandDTO<I>
  ): Promise<void> {
    const previousSettings = this.historyQueryRepository.findHistoryQueryItemById<I>(historyQueryId, historyQueryItemId);
    if (!previousSettings) {
      throw new Error(`History query item ${historyQueryItemId} not found`);
    }
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History Query ${historyQueryId} does not exist`);
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === historyQuery.southType);
    if (!manifest) {
      throw new Error('South manifest does not exist');
    }
    await this.validator.validateSettings(manifest.items.settings, command.settings);

    const historyQueryItemEntity = { id: previousSettings.id } as HistoryQueryItemEntity<I>;
    await copyHistoryQueryItemCommandToHistoryQueryItemEntity<I>(
      historyQueryItemEntity,
      command,
      previousSettings,
      historyQuery.southType,
      this.encryptionService
    );
    this.historyQueryRepository.saveHistoryQueryItem<I>(historyQuery.id, historyQueryItemEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} does not exist`);
    }
    const historyQueryItem = this.historyQueryRepository.findHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) throw new Error('History Query item not found');

    this.historyQueryRepository.deleteHistoryQueryItem(historyQueryItem.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteAllItemsForHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} not found`);
    }
    this.historyQueryRepository.deleteAllHistoryQueryItemsByHistoryQuery(historyQueryId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, true);
  }

  async enableHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQueryItem = this.historyQueryRepository.findHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) {
      throw new Error(`History query item ${historyQueryItemId} not found`);
    }

    this.historyQueryRepository.enableHistoryQueryItem(historyQueryItem.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(this.historyQueryRepository.findHistoryQueryById(historyQueryId)!, false);
  }

  async disableHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQueryItem = this.historyQueryRepository.findHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) {
      throw new Error(`History query item ${historyQueryItemId} not found`);
    }

    this.historyQueryRepository.disableHistoryQueryItem(historyQueryItemId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(this.historyQueryRepository.findHistoryQueryById(historyQueryId)!, false);
  }

  async checkCsvImport<I extends SouthItemSettings>(
    southType: string,
    file: multer.File,
    delimiter: string,
    existingItems: Array<HistoryQueryItemDTO<I> | HistoryQueryItemCommandDTO<I>>
  ) {
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southType);
    if (!manifest) {
      throw new Error('South manifest not found');
    }

    const fileContent = await fs.readFile(file.path);
    const csvContent = csv.parse(fileContent.toString('utf8'), { header: true, delimiter });

    if (csvContent.meta.delimiter !== delimiter) {
      throw new Error('The entered delimiter does not correspond to the file delimiter');
    }

    const validItems: Array<HistoryQueryItemCommandDTO<I>> = [];
    const errors: Array<{ item: HistoryQueryItemCommandDTO<I>; error: string }> = [];
    for (const data of csvContent.data) {
      const item: HistoryQueryItemCommandDTO<I> = {
        id: '',
        name: (data as unknown as Record<string, string>).name,
        enabled: (data as unknown as Record<string, string>).enabled.toLowerCase() === 'true',
        settings: {} as I
      };
      if (existingItems.find(existingItem => existingItem.name === item.name)) {
        errors.push({ item, error: `Item name "${(data as Record<string, string>).name}" already used` });
        continue;
      }

      let hasSettingsError = false;
      const settings: Record<string, string | object> = {};
      for (const [key, value] of Object.entries(data as unknown as Record<string, string>)) {
        if (key.startsWith('settings_')) {
          const settingsKey = key.replace('settings_', '');
          const manifestSettings = manifest.items.settings.find(settings => settings.key === settingsKey);
          if (!manifestSettings) {
            hasSettingsError = true;
            errors.push({
              item: item,
              error: `Settings "${settingsKey}" not accepted in manifest`
            });
            break;
          }
          if ((manifestSettings.type === 'OibArray' || manifestSettings.type === 'OibFormGroup') && value) {
            settings[settingsKey] = JSON.parse(value as string);
          } else {
            settings[settingsKey] = value;
          }
        }
      }
      if (hasSettingsError) continue;
      item.settings = settings as unknown as I;

      try {
        await this.validator.validateSettings(manifest.items.settings, item.settings);
        validItems.push(item);
      } catch (itemError: unknown) {
        errors.push({ item, error: (itemError as Error).message });
      }
    }

    return { items: validItems, errors };
  }

  async importItems<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings>(
    historyQueryId: string,
    items: Array<HistoryQueryItemCommandDTO<I>>
  ) {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById<S, N, I>(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History Query ${historyQueryId} does not exist`);
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === historyQuery.southType)!;
    const itemsToAdd: Array<HistoryQueryItemEntity<I>> = [];
    for (const itemCommand of items) {
      await this.validator.validateSettings(manifest.items.settings, itemCommand.settings);
      const historyQueryItemEntity = {} as HistoryQueryItemEntity<I>;
      await copyHistoryQueryItemCommandToHistoryQueryItemEntity<I>(
        historyQueryItemEntity,
        itemCommand,
        null,
        historyQuery.southType,
        this.encryptionService
      );
      itemsToAdd.push(historyQueryItemEntity);
    }
    this.historyQueryRepository.saveAllItems<I>(historyQuery.id, itemsToAdd);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
  }

  private getDefaultBaseFolder(historyId: string) {
    return path.resolve(this.historyQueryEngine.baseFolder, `history-${historyId}`);
  }
}

export const toHistoryQueryDTO = <S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings>(
  historyQuery: HistoryQueryEntity<S, N, I>,
  encryptionService: EncryptionService
): HistoryQueryDTO<S, N, I> => {
  const southManifest = southManifestList.find(element => element.id === historyQuery.southType)!;
  const northManifest = northManifestList.find(element => element.id === historyQuery.northType)!;
  return {
    id: historyQuery.id,
    name: historyQuery.name,
    description: historyQuery.description,
    status: historyQuery.status,
    startTime: historyQuery.startTime,
    endTime: historyQuery.endTime,
    southType: historyQuery.southType,
    northType: historyQuery.northType,
    southSettings: encryptionService.filterSecrets<S>(historyQuery.southSettings, southManifest.settings),
    southSharedConnection: historyQuery.southSharedConnection,
    northSettings: encryptionService.filterSecrets<N>(historyQuery.northSettings, northManifest.settings),
    history: {
      maxInstantPerItem: historyQuery.history.maxInstantPerItem,
      maxReadInterval: historyQuery.history.maxReadInterval,
      readDelay: historyQuery.history.readDelay
    },
    caching: {
      scanModeId: historyQuery.caching.scanModeId,
      retryInterval: historyQuery.caching.retryInterval,
      retryCount: historyQuery.caching.retryCount,
      maxSize: historyQuery.caching.maxSize,
      oibusTimeValues: {
        groupCount: historyQuery.caching.oibusTimeValues.groupCount,
        maxSendCount: historyQuery.caching.oibusTimeValues.maxSendCount
      },
      rawFiles: {
        sendFileImmediately: historyQuery.caching.rawFiles.sendFileImmediately,
        archive: {
          enabled: historyQuery.caching.rawFiles.archive.enabled,
          retentionDuration: historyQuery.caching.rawFiles.archive.retentionDuration
        }
      }
    },
    items: historyQuery.items.map(item => toHistoryQueryItemDTO<I>(item, historyQuery.southType, encryptionService))
  };
};

export const toHistoryQueryLightDTO = (entity: HistoryQueryEntityLight): HistoryQueryLightDTO => {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    status: entity.status,
    startTime: entity.startTime,
    endTime: entity.endTime,
    southType: entity.southType,
    northType: entity.northType
  };
};

const copyHistoryQueryCommandToHistoryQueryEntity = async <S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings>(
  historyQueryEntity: HistoryQueryEntity<S, N, I>,
  command: HistoryQueryCommandDTO<S, N, I>,
  currentSettings: HistoryQueryEntity<S, N, I> | null,
  encryptionService: EncryptionService,
  scanModes: Array<ScanMode>
): Promise<void> => {
  const southManifest = southManifestList.find(element => element.id === command.southType)!;
  const northManifest = northManifestList.find(element => element.id === command.northType)!;
  historyQueryEntity.name = command.name;
  historyQueryEntity.southType = command.southType;
  historyQueryEntity.northType = command.northType;
  historyQueryEntity.description = command.description;
  historyQueryEntity.status = currentSettings?.status || 'PENDING';
  historyQueryEntity.startTime = command.startTime;
  historyQueryEntity.endTime = command.endTime;
  historyQueryEntity.northSettings = await encryptionService.encryptConnectorSecrets<N>(
    command.northSettings,
    currentSettings?.northSettings || null,
    northManifest.settings
  );
  historyQueryEntity.southSettings = await encryptionService.encryptConnectorSecrets<S>(
    command.southSettings,
    currentSettings?.southSettings || null,
    southManifest.settings
  );
  historyQueryEntity.southSharedConnection = command.southSharedConnection;
  historyQueryEntity.history = {
    maxInstantPerItem: southManifest.modes.forceMaxInstantPerItem ? true : command.history.maxInstantPerItem,
    maxReadInterval: command.history.maxReadInterval,
    readDelay: command.history.readDelay
  };
  historyQueryEntity.caching = {
    scanModeId: checkScanMode(scanModes, command.caching.scanModeId, command.caching.scanModeName),
    retryInterval: command.caching.retryInterval,
    retryCount: command.caching.retryCount,
    maxSize: command.caching.maxSize,
    oibusTimeValues: {
      groupCount: command.caching.oibusTimeValues.groupCount,
      maxSendCount: command.caching.oibusTimeValues.maxSendCount
    },
    rawFiles: {
      sendFileImmediately: command.caching.rawFiles.sendFileImmediately,
      archive: {
        enabled: command.caching.rawFiles.archive.enabled,
        retentionDuration: command.caching.rawFiles.archive.retentionDuration
      }
    }
  };

  historyQueryEntity.items = await Promise.all(
    command.items.map(async itemCommand => {
      const itemEntity = { id: itemCommand?.id } as HistoryQueryItemEntity<I>;
      await copyHistoryQueryItemCommandToHistoryQueryItemEntity<I>(
        itemEntity,
        itemCommand,
        historyQueryEntity.items?.find(element => element.id === itemCommand.id) || null,
        historyQueryEntity.southType,
        encryptionService
      );
      return itemEntity;
    })
  );
};

const copyHistoryQueryItemCommandToHistoryQueryItemEntity = async <I extends SouthItemSettings>(
  historyQueryItemEntity: HistoryQueryItemEntity<I>,
  command: HistoryQueryItemCommandDTO<I>,
  currentSettings: HistoryQueryItemEntity<I> | null,
  southType: string,
  encryptionService: EncryptionService
): Promise<void> => {
  const southManifest = southManifestList.find(element => element.id === southType)!;
  historyQueryItemEntity.id = command.id || '';
  historyQueryItemEntity.name = command.name;
  historyQueryItemEntity.enabled = command.enabled;
  historyQueryItemEntity.settings = await encryptionService.encryptConnectorSecrets<I>(
    command.settings,
    currentSettings?.settings || null,
    southManifest.items.settings
  );
};

export const toHistoryQueryItemDTO = <I extends SouthItemSettings>(
  historyQueryItem: HistoryQueryItemEntity<I>,
  southType: string,
  encryptionService: EncryptionService
): HistoryQueryItemDTO<I> => {
  const southManifest = southManifestList.find(element => element.id === southType)!;
  return {
    id: historyQueryItem.id,
    name: historyQueryItem.name,
    enabled: historyQueryItem.enabled,
    settings: encryptionService.filterSecrets<I>(historyQueryItem.settings, southManifest.settings)
  };
};
