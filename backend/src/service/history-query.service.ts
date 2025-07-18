import {
  SouthConnectorCommandDTO,
  SouthConnectorItemTestingSettings,
  SouthConnectorManifest
} from '../../shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { HistoryQueryEntity, HistoryQueryEntityLight, HistoryQueryItemEntity } from '../model/histor-query.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryItemDTO,
  HistoryQueryItemSearchParam,
  HistoryQueryLightDTO
} from '../../shared/model/history-query.model';
import { NorthConnectorCommandDTO, NorthConnectorManifest } from '../../shared/model/north-connector.model';
import EncryptionService from './encryption.service';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import { checkScanMode, createBaseFolders, filesExists, stringToBoolean } from './utils';
import SouthService, { southManifestList } from './south.service';
import NorthService, { northManifestList } from './north.service';
import LogRepository from '../repository/logs/log.repository';
import { Page } from '../../shared/model/types';
import pino from 'pino';
import { CacheMetadata, CacheSearchParam, OIBusContent } from '../../shared/model/engine.model';
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
import { BaseFolders } from '../model/types';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import { ReadStream } from 'node:fs';

export default class HistoryQueryService {
  constructor(
    private readonly validator: JoiValidator,
    private readonly historyQueryRepository: HistoryQueryRepository,
    private readonly northConnectorRepository: NorthConnectorRepository,
    private readonly southConnectorRepository: SouthConnectorRepository,
    private readonly scanModeRepository: ScanModeRepository,
    private readonly logRepository: LogRepository,
    private readonly historyQueryMetricsRepository: HistoryQueryMetricsRepository,
    private readonly southService: SouthService,
    private readonly northService: NorthService,
    private readonly oIAnalyticsMessageService: OIAnalyticsMessageService,
    private readonly encryptionService: EncryptionService,
    private readonly historyQueryEngine: HistoryQueryEngine
  ) {}

  runHistoryQuery(settings: HistoryQueryEntityLight, baseFolders: BaseFolders | undefined = undefined) {
    const historyQueryBaseFolders = baseFolders ?? this.getDefaultBaseFolders(settings.id);

    return new HistoryQuery(
      this.findById(settings.id)!,
      this.southService,
      this.northService,
      this.oIAnalyticsMessageService,
      this.historyQueryRepository,
      historyQueryBaseFolders,
      this.historyQueryEngine.logger.child({ scopeType: 'history-query', scopeId: settings.id, scopeName: settings.name })
    );
  }

  async testNorth(
    historyQueryId: string,
    retrieveSecretsFromNorth: string | null,
    command: NorthConnectorCommandDTO<NorthSettings>,
    logger: pino.Logger
  ): Promise<void> {
    let northSettings: NorthSettings | null = null;
    if (historyQueryId !== 'create') {
      const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
      if (!historyQuery) {
        throw new Error(`History query ${historyQueryId} not found`);
      }
      northSettings = historyQuery.northSettings;
    } else if (retrieveSecretsFromNorth) {
      const north = this.northConnectorRepository.findNorthById(retrieveSecretsFromNorth);
      if (!north) {
        throw new Error(`North connector ${retrieveSecretsFromNorth} not found`);
      }
      northSettings = north.settings;
    }
    const manifest = this.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
    if (!manifest) {
      throw new Error(`North manifest ${command.type} not found`);
    }

    await this.validator.validateSettings(manifest.settings, command.settings);
    command.settings = await this.encryptionService.decryptConnectorSecrets(
      await this.encryptionService.encryptConnectorSecrets(command.settings, northSettings, manifest.settings),
      manifest.settings
    );

    return await this.northService.testNorth('create', command, logger);
  }

  async testSouth(
    historyQueryId: string,
    retrieveSecretsFromSouth: string | null,
    command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>,
    logger: pino.Logger
  ): Promise<void> {
    let southSettings: SouthSettings | null = null;
    if (historyQueryId !== 'create') {
      const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
      if (!historyQuery) {
        throw new Error(`History query ${historyQueryId} not found`);
      }
      southSettings = historyQuery.southSettings;
    } else if (retrieveSecretsFromSouth) {
      const south = this.southConnectorRepository.findSouthById(retrieveSecretsFromSouth);
      if (!south) {
        throw new Error(`South connector ${retrieveSecretsFromSouth} not found`);
      }
      southSettings = south.settings;
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === command.type);
    if (!manifest) {
      throw new Error(`South manifest ${command.type} not found`);
    }

    await this.validator.validateSettings(manifest.settings, command.settings);
    command.settings = await this.encryptionService.decryptConnectorSecrets(
      await this.encryptionService.encryptConnectorSecrets(command.settings, southSettings, manifest.settings),
      manifest.settings
    );
    return await this.southService.testSouth('create', command, logger);
  }

  async testSouthItem(
    historyQueryId: string,
    retrieveSecretsFromSouth: string | null,
    command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>,
    itemCommand: HistoryQueryItemCommandDTO<SouthItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void,
    logger: pino.Logger
  ): Promise<void> {
    let southSettings: SouthSettings | null = null;
    if (historyQueryId !== 'create') {
      const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
      if (!historyQuery) {
        throw new Error(`History query ${historyQueryId} not found`);
      }
      southSettings = historyQuery.southSettings;
    } else if (retrieveSecretsFromSouth) {
      const south = this.southConnectorRepository.findSouthById(retrieveSecretsFromSouth);
      if (!south) {
        throw new Error(`South connector ${retrieveSecretsFromSouth} not found`);
      }
      southSettings = south.settings;
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === command.type);
    if (!manifest) {
      throw new Error(`South manifest ${command.type} not found`);
    }
    await this.validator.validateSettings(manifest.settings, command.settings);
    await this.validator.validateSettings(manifest.items.settings, itemCommand.settings);
    command.settings = await this.encryptionService.decryptConnectorSecrets(
      await this.encryptionService.encryptConnectorSecrets(command.settings, southSettings, manifest.settings),
      manifest.settings
    );
    return await this.southService.testSouthItem(
      'create',
      command,
      { ...itemCommand, scanModeId: 'history', scanModeName: null },
      testingSettings,
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
    return this.historyQueryRepository.findAllHistoryQueriesLight();
  }

  async createHistoryQuery<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings>(
    command: HistoryQueryCommandDTO<S, N, I>,
    retrieveSecretsFromSouth: string | null,
    retrieveSecretsFromNorth: string | null,
    retrieveSecretsFromHistoryQuery: string | null
  ): Promise<HistoryQueryEntity<S, N, I>> {
    const southManifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === command.southType);
    if (!southManifest) {
      throw new Error(`South manifest ${command.southType} does not exist`);
    }
    const northManifest = this.northService.getInstalledNorthManifests().find(southManifest => southManifest.id === command.northType);
    if (!northManifest) {
      throw new Error(`North manifest ${command.northType} does not exist`);
    }
    await this.validator.validateSettings(northManifest.settings, command.northSettings);
    await this.validator.validateSettings(southManifest.settings, command.southSettings);
    // Check if item settings match the item schema, throw an error otherwise
    for (const item of command.items) {
      await this.validator.validateSettings(southManifest.items.settings, item.settings);
      item.id = null;
    }

    const historyQuery = {} as HistoryQueryEntity<S, N, I>;
    await copyHistoryQueryCommandToHistoryQueryEntity(
      historyQuery,
      command,
      this.retrieveSecrets(
        retrieveSecretsFromSouth,
        retrieveSecretsFromNorth,
        retrieveSecretsFromHistoryQuery,
        southManifest,
        northManifest
      ),
      this.encryptionService,
      this.scanModeRepository.findAll(),
      !!retrieveSecretsFromHistoryQuery || !!retrieveSecretsFromSouth
    );
    this.historyQueryRepository.saveHistoryQuery(historyQuery);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();

    const baseFolders = this.getDefaultBaseFolders(historyQuery.id);
    await createBaseFolders(baseFolders);

    await this.historyQueryEngine.createHistoryQuery(this.runHistoryQuery(historyQuery));
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
    this.historyQueryRepository.saveHistoryQuery(historyQuery);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();

    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, resetCache);
  }

  async deleteHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} not found`);
    }

    await this.historyQueryEngine.deleteHistoryQuery(historyQuery);
    await this.deleteBaseFolders(historyQuery);
    this.historyQueryRepository.deleteHistoryQuery(historyQuery.id);
    this.historyQueryMetricsRepository.removeMetrics(historyQuery.id);
    this.logRepository.deleteLogsByScopeId('history-query', historyQuery.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();

    this.historyQueryEngine.logger.info(`Deleted History query "${historyQuery.name}" (${historyQuery.id})`);
  }

  async startHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} not found`);
    }

    this.historyQueryRepository.updateHistoryQueryStatus(historyQueryId, 'RUNNING');
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, historyQuery.status === 'FINISHED' || historyQuery.status === 'ERRORED');
  }

  async pauseHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} not found`);
    }

    this.historyQueryRepository.updateHistoryQueryStatus(historyQueryId, 'PAUSED');
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
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
      throw new Error(`South manifest does not exist for type ${historyQuery.southType}`);
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

    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
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
      throw new Error(`History query item with ID ${historyQueryItemId} does not exist`);
    }
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} does not exist`);
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === historyQuery.southType);
    if (!manifest) {
      throw new Error(`South manifest does not exist for type ${historyQuery.southType}`);
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

    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} does not exist`);
    }
    const historyQueryItem = this.historyQueryRepository.findHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) throw new Error(`History query item ${historyQueryItemId} not found`);

    this.historyQueryRepository.deleteHistoryQueryItem(historyQueryItem.id);

    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteAllItemsForHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} not found`);
    }
    this.historyQueryRepository.deleteAllHistoryQueryItemsByHistoryQuery(historyQueryId);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, true);
  }

  async enableHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQueryItem = this.historyQueryRepository.findHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) {
      throw new Error(`History query item ${historyQueryItemId} not found`);
    }

    this.historyQueryRepository.enableHistoryQueryItem(historyQueryItem.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(this.historyQueryRepository.findHistoryQueryById(historyQueryId)!, false);
  }

  async disableHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQueryItem = this.historyQueryRepository.findHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) {
      throw new Error(`History query item ${historyQueryItemId} not found`);
    }

    this.historyQueryRepository.disableHistoryQueryItem(historyQueryItem.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(this.historyQueryRepository.findHistoryQueryById(historyQueryId)!, false);
  }

  async checkCsvFileImport<I extends SouthItemSettings>(
    southType: string,
    file: multer.File,
    delimiter: string,
    existingItems: multer.File
  ): Promise<{
    items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>>;
    errors: Array<{ item: HistoryQueryItemCommandDTO<SouthItemSettings>; error: string }>;
  }> {
    const fileContent = await fs.readFile(file.path);
    const existingItemsContent: Array<HistoryQueryItemDTO<I> | HistoryQueryItemCommandDTO<I>> = JSON.parse(
      (await fs.readFile(existingItems.path)).toString('utf8')
    );

    return await this.checkCsvContentImport(southType, fileContent.toString('utf8'), delimiter, existingItemsContent);
  }

  async checkCsvContentImport<I extends SouthItemSettings>(
    southType: string,
    fileContent: string,
    delimiter: string,
    existingItems: Array<HistoryQueryItemDTO<I> | HistoryQueryItemCommandDTO<I>>
  ): Promise<{
    items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>>;
    errors: Array<{ item: HistoryQueryItemCommandDTO<SouthItemSettings>; error: string }>;
  }> {
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southType);
    if (!manifest) {
      throw new Error(`South manifest does not exist for type ${southType}`);
    }

    const csvContent = csv.parse(fileContent, { header: true, delimiter, skipEmptyLines: true });

    if (csvContent.meta.delimiter !== delimiter) {
      throw new Error(`The entered delimiter "${delimiter}" does not correspond to the file delimiter "${csvContent.meta.delimiter}"`);
    }

    const validItems: Array<HistoryQueryItemCommandDTO<I>> = [];
    const errors: Array<{ item: HistoryQueryItemCommandDTO<I>; error: string }> = [];
    for (const data of csvContent.data) {
      const item: HistoryQueryItemCommandDTO<I> = {
        id: '',
        name: (data as unknown as Record<string, string>).name,
        enabled: stringToBoolean((data as unknown as Record<string, string>).enabled),
        settings: {} as I
      };
      if (existingItems.find(existingItem => existingItem.name === item.name)) {
        errors.push({
          item: item,
          error: `Item name "${(data as unknown as Record<string, string>).name}" already used`
        });
        continue;
      }

      let hasSettingsError = false;
      const settings: Record<string, string | object | boolean> = {};
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
          } else if (manifestSettings.type === 'OibCheckbox') {
            settings[settingsKey] = stringToBoolean(value);
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
    items: Array<HistoryQueryItemCommandDTO<I>>,
    deleteItemsNotPresent = false
  ) {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById<S, N, I>(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} does not exist`);
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
    this.historyQueryRepository.saveAllItems<I>(historyQuery.id, itemsToAdd, deleteItemsNotPresent);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
  }

  private async deleteBaseFolders(historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>) {
    const folders = this.getDefaultBaseFolders(historyQuery.id);

    for (const type of Object.keys(folders) as Array<keyof BaseFolders>) {
      const baseFolder = folders[type];

      try {
        this.historyQueryEngine.logger.trace(
          `Deleting "${type}" base folder "${baseFolder}" of History query "${historyQuery.name}" (${historyQuery.id})`
        );
        if (await filesExists(baseFolder)) {
          await fs.rm(baseFolder, { recursive: true });
        }
      } catch (error) {
        this.historyQueryEngine.logger.error(
          `Unable to delete History query "${historyQuery.name}" (${historyQuery.id}) "${type}" base folder: ${error}`
        );
      }
    }
  }

  async searchCacheContent(
    historyQueryId: string,
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    return await this.historyQueryEngine.searchCacheContent(historyQueryId, searchParams, folder);
  }

  async getCacheContentFileStream(
    historyQueryId: string,
    folder: 'cache' | 'archive' | 'error',
    filename: string
  ): Promise<ReadStream | null> {
    return await this.historyQueryEngine.getCacheContentFileStream(historyQueryId, folder, filename);
  }

  async removeCacheContent(
    historyQueryId: string,
    folder: 'cache' | 'archive' | 'error',
    metadataFilenameList: Array<string>
  ): Promise<void> {
    return await this.historyQueryEngine.removeCacheContent(historyQueryId, folder, metadataFilenameList);
  }

  async removeAllCacheContent(historyQueryId: string, folder: 'cache' | 'archive' | 'error'): Promise<void> {
    return await this.historyQueryEngine.removeAllCacheContent(historyQueryId, folder);
  }

  async moveCacheContent(
    historyQueryId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    cacheContentList: Array<string>
  ): Promise<void> {
    return await this.historyQueryEngine.moveCacheContent(historyQueryId, originFolder, destinationFolder, cacheContentList);
  }

  async moveAllCacheContent(
    historyQueryId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error'
  ): Promise<void> {
    return await this.historyQueryEngine.moveAllCacheContent(historyQueryId, originFolder, destinationFolder);
  }

  private getDefaultBaseFolders(historyId: string) {
    const folders = structuredClone(this.historyQueryEngine.baseFolders);

    for (const type of Object.keys(this.historyQueryEngine.baseFolders) as Array<keyof BaseFolders>) {
      folders[type] = path.resolve(folders[type], `history-${historyId}`);
    }

    return folders;
  }

  retrieveSecrets(
    retrieveSecretsFromSouth: string | null,
    retrieveSecretsFromNorth: string | null,
    retrieveSecretsFromHistoryQuery: string | null,
    southManifest: SouthConnectorManifest,
    northManifest: NorthConnectorManifest
  ): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null {
    if (retrieveSecretsFromHistoryQuery) {
      const source = this.historyQueryRepository.findHistoryQueryById(retrieveSecretsFromHistoryQuery);
      if (!source) {
        throw new Error(`Could not find history query ${retrieveSecretsFromHistoryQuery} to retrieve secrets from`);
      }
      if (source.southType !== southManifest.id) {
        throw new Error(
          `History query ${retrieveSecretsFromHistoryQuery} (south type ${source.southType}) must be of the south type ${southManifest.id}`
        );
      }
      if (source.northType !== northManifest.id) {
        throw new Error(
          `History query ${retrieveSecretsFromHistoryQuery} (north type ${source.northType}) must be of the north type ${northManifest.id}`
        );
      }
      return source;
    }
    if (retrieveSecretsFromSouth || retrieveSecretsFromNorth) {
      const source = { items: [] as Array<HistoryQueryItemEntity<SouthItemSettings>> } as HistoryQueryEntity<
        SouthSettings,
        NorthSettings,
        SouthItemSettings
      >;
      if (retrieveSecretsFromSouth) {
        const south = this.southConnectorRepository.findSouthById(retrieveSecretsFromSouth);
        if (!south) {
          throw new Error(`Could not find south connector ${retrieveSecretsFromSouth} to retrieve secrets from`);
        }
        if (south.type !== southManifest.id) {
          throw new Error(`South connector ${retrieveSecretsFromSouth} (type ${south.type}) must be of the type ${southManifest.id}`);
        }
        source.southType = south.type;
        source.items = south.items;
        source.southSettings = south.settings;
      }
      if (retrieveSecretsFromNorth) {
        const north = this.northConnectorRepository.findNorthById(retrieveSecretsFromNorth);
        if (!north) {
          throw new Error(`Could not find north connector ${retrieveSecretsFromNorth} to retrieve secrets from`);
        }
        if (north.type !== northManifest.id) {
          throw new Error(`North connector ${retrieveSecretsFromNorth} (type ${north.type}) must be of the type ${northManifest.id}`);
        }
        source.northType = north.type;
        source.northSettings = north.settings;
      }
      return source;
    }
    return null;
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
    northSettings: encryptionService.filterSecrets<N>(historyQuery.northSettings, northManifest.settings),
    caching: {
      trigger: {
        scanModeId: historyQuery.caching.trigger.scanModeId,
        numberOfElements: historyQuery.caching.trigger.numberOfElements,
        numberOfFiles: historyQuery.caching.trigger.numberOfFiles
      },
      throttling: {
        runMinDelay: historyQuery.caching.throttling.runMinDelay,
        maxSize: historyQuery.caching.throttling.maxSize,
        maxNumberOfElements: historyQuery.caching.throttling.maxNumberOfElements
      },
      error: {
        retryInterval: historyQuery.caching.error.retryInterval,
        retryCount: historyQuery.caching.error.retryCount,
        retentionDuration: historyQuery.caching.error.retentionDuration
      },
      archive: {
        enabled: historyQuery.caching.archive.enabled,
        retentionDuration: historyQuery.caching.archive.retentionDuration
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
  scanModes: Array<ScanMode>,
  retrieveSecrets = false
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
  historyQueryEntity.caching = {
    trigger: {
      scanModeId: checkScanMode(scanModes, command.caching.trigger.scanModeId, command.caching.trigger.scanModeName),
      numberOfElements: command.caching.trigger.numberOfElements,
      numberOfFiles: command.caching.trigger.numberOfFiles
    },
    throttling: {
      runMinDelay: command.caching.throttling.runMinDelay,
      maxSize: command.caching.throttling.maxSize,
      maxNumberOfElements: command.caching.throttling.maxNumberOfElements
    },
    error: {
      retryInterval: command.caching.error.retryInterval,
      retryCount: command.caching.error.retryCount,
      retentionDuration: command.caching.error.retentionDuration
    },
    archive: {
      enabled: command.caching.archive.enabled,
      retentionDuration: command.caching.archive.retentionDuration
    }
  };

  historyQueryEntity.items = await Promise.all(
    command.items.map(async itemCommand => {
      const itemEntity = { id: itemCommand.id } as HistoryQueryItemEntity<I>;
      await copyHistoryQueryItemCommandToHistoryQueryItemEntity<I>(
        itemEntity,
        itemCommand,
        currentSettings?.items.find(element => element.id === itemCommand.id) || null,
        historyQueryEntity.southType,
        encryptionService,
        retrieveSecrets
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
  encryptionService: EncryptionService,
  retrieveSecrets = false
): Promise<void> => {
  const southManifest = southManifestList.find(element => element.id === southType)!;
  historyQueryItemEntity.id = retrieveSecrets ? '' : command.id || ''; // reset id if it is a copy from another history query
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
    settings: encryptionService.filterSecrets<I>(historyQueryItem.settings, southManifest.items.settings)
  };
};
