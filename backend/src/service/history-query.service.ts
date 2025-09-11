import { OIBusSouthType, SouthConnectorItemTestingSettings, SouthConnectorManifest } from '../../shared/model/south-connector.model';
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
import { NorthConnectorManifest, OIBusNorthType } from '../../shared/model/north-connector.model';
import { encryptionService } from './encryption.service';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import { checkScanMode, stringToBoolean } from './utils';
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
import csv from 'papaparse';
import HistoryQueryMetricsRepository from '../repository/metrics/history-query-metrics.repository';
import { PassThrough } from 'node:stream';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import { ReadStream } from 'node:fs';
import TransformerService, { toTransformerDTO } from './transformer.service';
import { Transformer } from '../model/transformer.model';
import { OIBusObjectAttribute } from '../../shared/model/form.model';
import DataStreamEngine from '../engine/data-stream-engine';

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
    private readonly transformerService: TransformerService,
    private readonly oIAnalyticsMessageService: OIAnalyticsMessageService,
    private readonly dataStreamEngine: DataStreamEngine
  ) {}

  async testNorth(
    historyQueryId: string,
    northType: OIBusNorthType,
    retrieveSecretsFromNorth: string | null,
    settingsToTest: NorthSettings,
    logger: pino.Logger
  ): Promise<void> {
    let northSettings: NorthSettings | null = null;
    if (historyQueryId !== 'create') {
      const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
      if (!historyQuery) {
        throw new Error(`History query "${historyQueryId}" not found`);
      }
      northSettings = historyQuery.northSettings;
    } else if (retrieveSecretsFromNorth) {
      const north = this.northConnectorRepository.findNorthById(retrieveSecretsFromNorth);
      if (!north) {
        throw new Error(`North connector "${retrieveSecretsFromNorth}" not found`);
      }
      northSettings = north.settings;
    }
    const manifest = this.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === northType);
    if (!manifest) {
      throw new Error(`North manifest "${northType}" not found`);
    }
    await this.validator.validateSettings(manifest.settings, settingsToTest);
    return await this.northService.testNorth(
      'create',
      northType,
      await encryptionService.decryptConnectorSecrets(
        await encryptionService.encryptConnectorSecrets(settingsToTest, northSettings, manifest.settings),
        manifest.settings
      ),
      logger
    );
  }

  async testSouth(
    historyQueryId: string,
    southType: OIBusSouthType,
    retrieveSecretsFromSouth: string | null,
    settingsToTest: SouthSettings,
    logger: pino.Logger
  ): Promise<void> {
    let southSettings: SouthSettings | null = null;
    if (historyQueryId !== 'create') {
      const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
      if (!historyQuery) {
        throw new Error(`History query "${historyQueryId}" not found`);
      }
      southSettings = historyQuery.southSettings;
    } else if (retrieveSecretsFromSouth) {
      const south = this.southConnectorRepository.findSouthById(retrieveSecretsFromSouth);
      if (!south) {
        throw new Error(`South connector "${retrieveSecretsFromSouth}" not found`);
      }
      southSettings = south.settings;
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southType);
    if (!manifest) {
      throw new Error(`South manifest "${southType}" not found`);
    }
    await this.validator.validateSettings(manifest.settings, settingsToTest);
    return await this.southService.testSouth(
      'create',
      southType,
      await encryptionService.decryptConnectorSecrets(
        await encryptionService.encryptConnectorSecrets(settingsToTest, southSettings, manifest.settings),
        manifest.settings
      ),
      logger
    );
  }

  async testSouthItem(
    historyQueryId: string,
    southType: OIBusSouthType,
    retrieveSecretsFromSouth: string | null,
    southSettings: SouthSettings,
    itemSettings: SouthItemSettings,
    testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void,
    logger: pino.Logger
  ): Promise<void> {
    let southSettingsFrom: SouthSettings | null = null;
    if (historyQueryId !== 'create') {
      const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
      if (!historyQuery) {
        throw new Error(`History query "${historyQueryId}" not found`);
      }
      southSettingsFrom = historyQuery.southSettings;
    } else if (retrieveSecretsFromSouth) {
      const south = this.southConnectorRepository.findSouthById(retrieveSecretsFromSouth);
      if (!south) {
        throw new Error(`South connector "${retrieveSecretsFromSouth}" not found`);
      }
      southSettingsFrom = south.settings;
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southType);
    if (!manifest) {
      throw new Error(`South manifest "${southType}" not found`);
    }
    await this.validator.validateSettings(manifest.settings, southSettings);
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, itemSettings);
    return await this.southService.testSouthItem(
      'create',
      southType,
      await encryptionService.decryptConnectorSecrets(
        await encryptionService.encryptConnectorSecrets(southSettings, southSettingsFrom, manifest.settings),
        manifest.settings
      ),
      itemSettings,
      testingSettings,
      callback,
      logger
    );
  }

  findById(historyQueryId: string): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null {
    return this.historyQueryRepository.findHistoryQueryById<SouthSettings, NorthSettings, SouthItemSettings>(historyQueryId);
  }

  findAll(): Array<HistoryQueryEntityLight> {
    return this.historyQueryRepository.findAllHistoryQueriesLight();
  }

  async createHistoryQuery(
    command: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>,
    retrieveSecretsFromSouth: string | null,
    retrieveSecretsFromNorth: string | null,
    retrieveSecretsFromHistoryQuery: string | null
  ): Promise<HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>> {
    const southManifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === command.southType);
    if (!southManifest) {
      throw new Error(`South manifest "${command.southType}" does not exist`);
    }
    const northManifest = this.northService.getInstalledNorthManifests().find(southManifest => southManifest.id === command.northType);
    if (!northManifest) {
      throw new Error(`North manifest "${command.northType}" does not exist`);
    }
    await this.validator.validateSettings(northManifest.settings, command.northSettings);
    await this.validator.validateSettings(southManifest.settings, command.southSettings);
    // Check if item settings match the item schema, throw an error otherwise
    const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    for (const item of command.items) {
      await this.validator.validateSettings(itemSettingsManifest, item.settings);
      item.id = null;
    }

    const historyQuery = {} as HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>;
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
      this.scanModeRepository.findAll(),
      this.transformerService.findAll(),
      !!retrieveSecretsFromHistoryQuery || !!retrieveSecretsFromSouth
    );
    this.historyQueryRepository.saveHistoryQuery(historyQuery);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();

    await this.dataStreamEngine.createHistoryQuery(historyQuery.id);
    return historyQuery;
  }

  getHistoryQueryDataStream(historyQueryId: string): PassThrough | null {
    return this.dataStreamEngine.getHistoryQueryDataStream(historyQueryId);
  }

  async updateHistoryQuery<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings>(
    historyQueryId: string,
    command: HistoryQueryCommandDTO<S, N, I>,
    resetCache: boolean
  ): Promise<void> {
    const previousSettings = this.historyQueryRepository.findHistoryQueryById<S, N, I>(historyQueryId);
    if (!previousSettings) {
      throw new Error(`History query "${historyQueryId}" not found`);
    }
    const southManifest = this.southService.getInstalledSouthManifests().find(manifest => manifest.id === command.southType);
    if (!southManifest) {
      throw new Error(`South manifest not found for type "${command.southType}"`);
    }
    const northManifest = this.northService.getInstalledNorthManifests().find(manifest => manifest.id === command.northType);
    if (!northManifest) {
      throw new Error(`North manifest not found for type "${command.northType}"`);
    }
    await this.validator.validateSettings(northManifest.settings, previousSettings.northSettings);
    await this.validator.validateSettings(southManifest.settings, previousSettings.southSettings);
    // Check if item settings match the item schema, throw an error otherwise
    const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    for (const item of command.items) {
      await this.validator.validateSettings(itemSettingsManifest, item.settings);
    }

    const historyQuery = { id: previousSettings.id } as HistoryQueryEntity<S, N, I>;
    await copyHistoryQueryCommandToHistoryQueryEntity<S, N, I>(
      historyQuery,
      command,
      previousSettings,
      this.scanModeRepository.findAll(),
      this.transformerService.findAll()
    );
    this.historyQueryRepository.saveHistoryQuery(historyQuery);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();

    await this.dataStreamEngine.reloadHistoryQuery(historyQuery, resetCache);
  }

  async deleteHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query "${historyQueryId}" not found`);
    }

    await this.dataStreamEngine.deleteHistoryQuery(historyQuery);
    this.historyQueryRepository.deleteHistoryQuery(historyQuery.id);
    this.logRepository.deleteLogsByScopeId('history-query', historyQuery.id);
    this.historyQueryMetricsRepository.removeMetrics(historyQuery.id);

    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();

    this.dataStreamEngine.logger.info(`Deleted History query "${historyQuery.name}" (${historyQuery.id})`);
  }

  async startHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query "${historyQueryId}" not found`);
    }

    this.historyQueryRepository.updateHistoryQueryStatus(historyQueryId, 'RUNNING');
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.dataStreamEngine.reloadHistoryQuery(historyQuery, historyQuery.status === 'FINISHED' || historyQuery.status === 'ERRORED');
  }

  async pauseHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query "${historyQueryId}" not found`);
    }

    this.historyQueryRepository.updateHistoryQueryStatus(historyQueryId, 'PAUSED');
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.dataStreamEngine.stopHistoryQuery(historyQuery.id);
  }

  getHistoryQueryItems(historyQueryId: string): Array<HistoryQueryItemEntity<SouthItemSettings>> {
    return this.historyQueryRepository.findAllItemsForHistoryQuery(historyQueryId);
  }

  searchHistoryQueryItems(
    historyQueryId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Page<HistoryQueryItemEntity<SouthItemSettings>> {
    return this.historyQueryRepository.searchHistoryQueryItems(historyQueryId, searchParams);
  }

  findHistoryQueryItemById(historyQueryId: string, historyQueryItemId: string): HistoryQueryItemEntity<SouthItemSettings> | null {
    return this.historyQueryRepository.findHistoryQueryItemById(historyQueryId, historyQueryItemId);
  }

  async createHistoryQueryItem(
    historyQueryId: string,
    command: HistoryQueryItemCommandDTO<SouthItemSettings>
  ): Promise<HistoryQueryItemEntity<SouthItemSettings>> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query "${historyQueryId}" does not exist`);
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === historyQuery.southType);
    if (!manifest) {
      throw new Error(`South manifest does not exist for type "${historyQuery.southType}"`);
    }
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, command.settings);

    const historyQueryItemEntity = {} as HistoryQueryItemEntity<SouthItemSettings>;
    await copyHistoryQueryItemCommandToHistoryQueryItemEntity(historyQueryItemEntity, command, null, historyQuery.southType);
    this.historyQueryRepository.saveHistoryQueryItem(historyQuery.id, historyQueryItemEntity);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.dataStreamEngine.reloadHistoryQuery(historyQuery, false);
    return historyQueryItemEntity;
  }

  async updateHistoryQueryItem(
    historyQueryId: string,
    historyQueryItemId: string,
    command: HistoryQueryItemCommandDTO<SouthItemSettings>
  ): Promise<void> {
    const previousSettings = this.historyQueryRepository.findHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!previousSettings) {
      throw new Error(`History query item with ID "${historyQueryItemId}" does not exist`);
    }
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query "${historyQueryId}" does not exist`);
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === historyQuery.southType);
    if (!manifest) {
      throw new Error(`South manifest does not exist for type "${historyQuery.southType}"`);
    }
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, command.settings);

    const historyQueryItemEntity = { id: previousSettings.id } as HistoryQueryItemEntity<SouthItemSettings>;
    await copyHistoryQueryItemCommandToHistoryQueryItemEntity(historyQueryItemEntity, command, previousSettings, historyQuery.southType);
    this.historyQueryRepository.saveHistoryQueryItem(historyQuery.id, historyQueryItemEntity);

    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.dataStreamEngine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query "${historyQueryId}" does not exist`);
    }
    const historyQueryItem = this.historyQueryRepository.findHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) throw new Error(`History query item "${historyQueryItemId}" not found`);
    this.historyQueryRepository.deleteHistoryQueryItem(historyQueryItem.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.dataStreamEngine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteAllItemsForHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query "${historyQueryId}" not found`);
    }
    this.historyQueryRepository.deleteAllHistoryQueryItemsByHistoryQuery(historyQueryId);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.dataStreamEngine.reloadHistoryQuery(historyQuery, true);
  }

  async enableHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query "${historyQueryId}" does not exist`);
    }
    const historyQueryItem = this.historyQueryRepository.findHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) {
      throw new Error(`History query item "${historyQueryItemId}" not found`);
    }
    this.historyQueryRepository.enableHistoryQueryItem(historyQueryItem.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.dataStreamEngine.reloadHistoryQuery(historyQuery, false);
  }

  async disableHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query "${historyQueryId}" does not exist`);
    }
    const historyQueryItem = this.historyQueryRepository.findHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) {
      throw new Error(`History query item "${historyQueryItemId}" not found`);
    }
    this.historyQueryRepository.disableHistoryQueryItem(historyQueryItem.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.dataStreamEngine.reloadHistoryQuery(historyQuery, false);
  }

  async checkCsvFileImport(
    southType: string,
    file: multer.File,
    delimiter: string,
    existingItems: multer.File
  ): Promise<{
    items: Array<HistoryQueryItemDTO<SouthItemSettings>>;
    errors: Array<{ item: Record<string, string>; error: string }>;
  }> {
    const fileContent = await fs.readFile(file.path);
    const existingItemsContent: Array<HistoryQueryItemDTO<SouthItemSettings>> = JSON.parse(
      (await fs.readFile(existingItems.path)).toString('utf8')
    );
    return await this.checkCsvContentImport(southType, fileContent.toString('utf8'), delimiter, existingItemsContent);
  }

  async checkCsvContentImport(
    southType: string,
    fileContent: string,
    delimiter: string,
    existingItems: Array<HistoryQueryItemDTO<SouthItemSettings>>
  ): Promise<{
    items: Array<HistoryQueryItemDTO<SouthItemSettings>>;
    errors: Array<{ item: Record<string, string>; error: string }>;
  }> {
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southType);
    if (!manifest) {
      throw new Error(`South manifest does not exist for type "${southType}"`);
    }

    const csvContent = csv.parse(fileContent, { header: true, delimiter, skipEmptyLines: true });
    if (csvContent.meta.delimiter !== delimiter) {
      throw new Error(`The entered delimiter "${delimiter}" does not correspond to the file delimiter "${csvContent.meta.delimiter}"`);
    }

    const validItems: Array<HistoryQueryItemDTO<SouthItemSettings>> = [];
    const errors: Array<{ item: Record<string, string>; error: string }> = [];
    for (const data of csvContent.data) {
      const item: HistoryQueryItemDTO<SouthItemSettings> = {
        id: '',
        name: (data as unknown as Record<string, string>).name,
        enabled: stringToBoolean((data as unknown as Record<string, string>).enabled),
        settings: {} as SouthItemSettings
      };
      if (existingItems.find(existingItem => existingItem.name === item.name)) {
        errors.push({
          item: data as Record<string, string>,
          error: `Item name "${(data as unknown as Record<string, string>).name}" already used`
        });
        continue;
      }

      let hasSettingsError = false;
      const settings: Record<string, string | object | boolean> = {};
      const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
        attribute => attribute.key === 'settings'
      )! as OIBusObjectAttribute;
      for (const [key, value] of Object.entries(data as unknown as Record<string, string>)) {
        if (key.startsWith('settings_')) {
          const settingsKey = key.replace('settings_', '');
          const fieldManifest = itemSettingsManifest.attributes.find(settings => settings.key === settingsKey);
          if (!fieldManifest) {
            hasSettingsError = true;
            errors.push({
              item: data as Record<string, string>,
              error: `Settings "${settingsKey}" not accepted in manifest`
            });
            break;
          }
          if ((fieldManifest.type === 'array' || fieldManifest.type === 'object') && value) {
            settings[settingsKey] = JSON.parse(value as string);
          } else if (fieldManifest.type === 'boolean') {
            settings[settingsKey] = stringToBoolean(value);
          } else {
            settings[settingsKey] = value;
          }
        }
      }
      if (hasSettingsError) continue;
      item.settings = settings as unknown as SouthItemSettings;

      try {
        await this.validator.validateSettings(itemSettingsManifest, item.settings);
        validItems.push(item);
      } catch (itemError: unknown) {
        errors.push({ item: data as Record<string, string>, error: (itemError as Error).message });
      }
    }
    return { items: validItems, errors };
  }

  async importItems(historyQueryId: string, items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>>, deleteItemsNotPresent = false) {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query "${historyQueryId}" does not exist`);
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === historyQuery.southType)!;
    const itemsToAdd: Array<HistoryQueryItemEntity<SouthItemSettings>> = [];
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    for (const itemCommand of items) {
      await this.validator.validateSettings(itemSettingsManifest, itemCommand.settings);
      const historyQueryItemEntity = {} as HistoryQueryItemEntity<SouthItemSettings>;
      await copyHistoryQueryItemCommandToHistoryQueryItemEntity(historyQueryItemEntity, itemCommand, null, historyQuery.southType);
      itemsToAdd.push(historyQueryItemEntity);
    }

    this.historyQueryRepository.saveAllItems(historyQuery.id, itemsToAdd, deleteItemsNotPresent);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.dataStreamEngine.reloadHistoryQuery(historyQuery, false);
  }

  async searchCacheContent(
    historyQueryId: string,
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    return await this.dataStreamEngine.searchCacheContent('history', historyQueryId, searchParams, folder);
  }

  async getCacheContentFileStream(
    historyQueryId: string,
    folder: 'cache' | 'archive' | 'error',
    filename: string
  ): Promise<ReadStream | null> {
    return await this.dataStreamEngine.getCacheContentFileStream('history', historyQueryId, folder, filename);
  }

  async removeCacheContent(
    historyQueryId: string,
    folder: 'cache' | 'archive' | 'error',
    metadataFilenameList: Array<string>
  ): Promise<void> {
    return await this.dataStreamEngine.removeCacheContent('history', historyQueryId, folder, metadataFilenameList);
  }

  async removeAllCacheContent(historyQueryId: string, folder: 'cache' | 'archive' | 'error'): Promise<void> {
    return await this.dataStreamEngine.removeAllCacheContent('history', historyQueryId, folder);
  }

  async moveCacheContent(
    historyQueryId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    cacheContentList: Array<string>
  ): Promise<void> {
    return await this.dataStreamEngine.moveCacheContent('history', historyQueryId, originFolder, destinationFolder, cacheContentList);
  }

  async moveAllCacheContent(
    historyQueryId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error'
  ): Promise<void> {
    return await this.dataStreamEngine.moveAllCacheContent('history', historyQueryId, originFolder, destinationFolder);
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
        throw new Error(`Could not find History query "${retrieveSecretsFromHistoryQuery}" to retrieve secrets from`);
      }
      if (source.southType !== southManifest.id) {
        throw new Error(
          `History query "${retrieveSecretsFromHistoryQuery}" (South type "${source.southType}") must be of the South type "${southManifest.id}"`
        );
      }
      if (source.northType !== northManifest.id) {
        throw new Error(
          `History query "${retrieveSecretsFromHistoryQuery}" (North type "${source.northType}") must be of the North type "${northManifest.id}"`
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
          throw new Error(`Could not find South connector "${retrieveSecretsFromSouth}" to retrieve secrets from`);
        }
        if (south.type !== southManifest.id) {
          throw new Error(`South connector "${retrieveSecretsFromSouth}" (type "${south.type}") must be of the type "${southManifest.id}"`);
        }
        source.southType = south.type;
        source.items = south.items;
        source.southSettings = south.settings;
      }
      if (retrieveSecretsFromNorth) {
        const north = this.northConnectorRepository.findNorthById(retrieveSecretsFromNorth);
        if (!north) {
          throw new Error(`Could not find North connector "${retrieveSecretsFromNorth}" to retrieve secrets from`);
        }
        if (north.type !== northManifest.id) {
          throw new Error(`North connector "${retrieveSecretsFromNorth}" (type "${north.type}") must be of the type "${northManifest.id}"`);
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
  historyQuery: HistoryQueryEntity<S, N, I>
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
        scanMode: historyQuery.caching.trigger.scanMode,
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
    items: historyQuery.items.map(item => toHistoryQueryItemDTO<I>(item, historyQuery.southType)),
    northTransformers: historyQuery.northTransformers.map(transformerWithOptions => ({
      transformer: toTransformerDTO(transformerWithOptions.transformer),
      options: transformerWithOptions.options,
      inputType: transformerWithOptions.inputType
    }))
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
  scanModes: Array<ScanMode>,
  transformers: Array<Transformer>,
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
      scanMode: checkScanMode(scanModes, command.caching.trigger.scanModeId, command.caching.trigger.scanModeName),
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
  historyQueryEntity.northTransformers = command.northTransformers.map(transformerIdWithOptions => {
    const foundTransformer = transformers.find(transformer => transformer.id === transformerIdWithOptions.transformerId);
    if (!foundTransformer) {
      throw new Error(`Could not find OIBus Transformer "${transformerIdWithOptions.transformerId}"`);
    }
    return { transformer: foundTransformer, options: transformerIdWithOptions.options, inputType: transformerIdWithOptions.inputType };
  });
  historyQueryEntity.items = await Promise.all(
    command.items.map(async itemCommand => {
      const itemEntity = { id: itemCommand.id } as HistoryQueryItemEntity<I>;
      await copyHistoryQueryItemCommandToHistoryQueryItemEntity<I>(
        itemEntity,
        itemCommand,
        currentSettings?.items.find(element => element.id === itemCommand.id) || null,
        historyQueryEntity.southType,
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
  retrieveSecrets = false
): Promise<void> => {
  const southManifest = southManifestList.find(element => element.id === southType)!;
  const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
    attribute => attribute.key === 'settings'
  )! as OIBusObjectAttribute;
  historyQueryItemEntity.id = retrieveSecrets ? '' : command.id || ''; // reset id if it is a copy from another history query
  historyQueryItemEntity.name = command.name;
  historyQueryItemEntity.enabled = command.enabled;
  historyQueryItemEntity.settings = await encryptionService.encryptConnectorSecrets<I>(
    command.settings,
    currentSettings?.settings || null,
    itemSettingsManifest
  );
};

export const toHistoryQueryItemDTO = <I extends SouthItemSettings>(
  historyQueryItem: HistoryQueryItemEntity<I>,
  southType: string
): HistoryQueryItemDTO<I> => {
  const southManifest = southManifestList.find(element => element.id === southType)!;
  const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
    attribute => attribute.key === 'settings'
  )! as OIBusObjectAttribute;
  return {
    id: historyQueryItem.id,
    name: historyQueryItem.name,
    enabled: historyQueryItem.enabled,
    settings: encryptionService.filterSecrets<I>(historyQueryItem.settings, itemSettingsManifest)
  };
};
