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
import { CacheMetadata, CacheSearchParam, OIBusContent } from '../../shared/model/engine.model';
import { ScanMode } from '../model/scan-mode.model';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
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
import { TransformerDTOWithOptions } from '../../shared/model/transformer.model';
import { NotFoundError, OIBusValidationError } from '../model/types';

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
    private readonly engine: DataStreamEngine
  ) {}

  list(): Array<HistoryQueryEntityLight> {
    return this.historyQueryRepository.findAllHistoryQueriesLight();
  }

  findById(historyId: string): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyId);
    if (!historyQuery) {
      throw new NotFoundError(`History query "${historyId}" not found`);
    }
    return historyQuery;
  }

  async create(
    command: HistoryQueryCommandDTO,
    retrieveSecretsFromSouth: string | undefined,
    retrieveSecretsFromNorth: string | undefined,
    retrieveSecretsFromHistoryQuery: string | undefined
  ): Promise<HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>> {
    const northManifest = this.northService.getManifest(command.northType);
    const southManifest = this.southService.getManifest(command.southType);
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

    await this.engine.createHistoryQuery(historyQuery.id);
    return historyQuery;
  }

  async update(historyId: string, command: HistoryQueryCommandDTO, resetCache: boolean): Promise<void> {
    const previousSettings = this.findById(historyId);
    const northManifest = this.northService.getManifest(command.northType);
    const southManifest = this.southService.getManifest(command.southType);
    await this.validator.validateSettings(northManifest.settings, previousSettings.northSettings);
    await this.validator.validateSettings(southManifest.settings, previousSettings.southSettings);
    // Check if item settings match the item schema, throw an error otherwise
    const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    for (const item of command.items) {
      await this.validator.validateSettings(itemSettingsManifest, item.settings);
    }

    const historyQuery = { id: previousSettings.id } as HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>;
    await copyHistoryQueryCommandToHistoryQueryEntity(
      historyQuery,
      command,
      previousSettings,
      this.scanModeRepository.findAll(),
      this.transformerService.findAll()
    );
    this.historyQueryRepository.saveHistoryQuery(historyQuery);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, resetCache);
  }

  async delete(historyId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    await this.engine.deleteHistoryQuery(historyQuery);
    this.historyQueryRepository.deleteHistoryQuery(historyQuery.id);
    this.logRepository.deleteLogsByScopeId('history-query', historyQuery.id);
    this.historyQueryMetricsRepository.removeMetrics(historyQuery.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();

    this.engine.logger.info(`Deleted History query "${historyQuery.name}" (${historyQuery.id})`);
  }

  async start(historyId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    this.historyQueryRepository.updateHistoryQueryStatus(historyId, 'RUNNING');
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, historyQuery.status === 'FINISHED' || historyQuery.status === 'ERRORED');
  }

  async pause(historyId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    this.historyQueryRepository.updateHistoryQueryStatus(historyId, 'PAUSED');
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.stopHistoryQuery(historyQuery.id);
  }

  getHistoryDataStream(historyId: string): PassThrough | null {
    return this.engine.getHistoryQueryDataStream(historyId);
  }

  async testNorth(
    historyId: string,
    northType: OIBusNorthType,
    retrieveSecretsFromNorth: string | undefined,
    settingsToTest: NorthSettings
  ): Promise<void> {
    let northSettings: NorthSettings | null = null;
    if (historyId !== 'create') {
      const historyQuery = this.findById(historyId);
      northSettings = historyQuery.northSettings;
    } else if (retrieveSecretsFromNorth) {
      const north = this.northService.findById(retrieveSecretsFromNorth);
      northSettings = north.settings;
    }
    const northManifest = this.northService.getManifest(northType);
    await this.validator.validateSettings(northManifest.settings, settingsToTest);
    return await this.northService.testNorth(
      'history',
      northType,
      await encryptionService.decryptConnectorSecrets(
        await encryptionService.encryptConnectorSecrets(settingsToTest, northSettings, northManifest.settings),
        northManifest.settings
      )
    );
  }

  async testSouth(
    historyId: string,
    southType: OIBusSouthType,
    retrieveSecretsFromSouth: string | undefined,
    settingsToTest: SouthSettings
  ): Promise<void> {
    let southSettings: SouthSettings | null = null;
    if (historyId !== 'create') {
      const historyQuery = this.findById(historyId);
      southSettings = historyQuery.southSettings;
    } else if (retrieveSecretsFromSouth) {
      const south = this.southService.findById(retrieveSecretsFromSouth);
      southSettings = south.settings;
    }
    const southManifest = this.southService.getManifest(southType);
    await this.validator.validateSettings(southManifest.settings, settingsToTest);
    return await this.southService.testSouth(
      'history',
      southType,
      await encryptionService.decryptConnectorSecrets(
        await encryptionService.encryptConnectorSecrets(settingsToTest, southSettings, southManifest.settings),
        southManifest.settings
      )
    );
  }

  async testItem(
    historyId: string,
    southType: OIBusSouthType,
    itemName: string,
    retrieveSecretsFromSouth: string | undefined,
    southSettings: SouthSettings,
    itemSettings: SouthItemSettings,
    testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void
  ): Promise<void> {
    let southSettingsFrom: SouthSettings | null = null;
    if (historyId !== 'create') {
      const historyQuery = this.findById(historyId);
      southSettingsFrom = historyQuery.southSettings;
    } else if (retrieveSecretsFromSouth) {
      const south = this.southService.findById(retrieveSecretsFromSouth);
      southSettingsFrom = south.settings;
    }
    const southManifest = this.southService.getManifest(southType);
    await this.validator.validateSettings(southManifest.settings, southSettings);
    const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, itemSettings);
    return await this.southService.testItem(
      'history',
      southType,
      itemName,
      await encryptionService.decryptConnectorSecrets(
        await encryptionService.encryptConnectorSecrets(southSettings, southSettingsFrom, southManifest.settings),
        southManifest.settings
      ),
      itemSettings,
      testingSettings,
      callback
    );
  }

  listItems(historyId: string): Array<HistoryQueryItemEntity<SouthItemSettings>> {
    return this.historyQueryRepository.findAllItemsForHistoryQuery(historyId);
  }

  searchItems(historyId: string, searchParams: HistoryQueryItemSearchParam): Page<HistoryQueryItemEntity<SouthItemSettings>> {
    return this.historyQueryRepository.searchHistoryQueryItems(historyId, searchParams);
  }

  findItemById(historyId: string, itemId: string): HistoryQueryItemEntity<SouthItemSettings> {
    const item = this.historyQueryRepository.findHistoryQueryItemById(historyId, itemId);
    if (!item) {
      throw new NotFoundError(`Item "${itemId}" not found`);
    }
    return item;
  }

  async createItem(historyId: string, command: HistoryQueryItemCommandDTO): Promise<HistoryQueryItemEntity<SouthItemSettings>> {
    const historyQuery = this.findById(historyId);
    const manifest = this.southService.getManifest(historyQuery.southType);
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, command.settings);

    const historyQueryItemEntity = {} as HistoryQueryItemEntity<SouthItemSettings>;
    await copyHistoryQueryItemCommandToHistoryQueryItemEntity(historyQueryItemEntity, command, null, historyQuery.southType);
    this.historyQueryRepository.saveHistoryQueryItem(historyQuery.id, historyQueryItemEntity);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
    return historyQueryItemEntity;
  }

  async updateItem(historyId: string, itemId: string, command: HistoryQueryItemCommandDTO): Promise<void> {
    const historyQuery = this.findById(historyId);
    const existingItem = this.findItemById(historyId, itemId);
    const manifest = this.southService.getManifest(historyQuery.southType);
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, command.settings);

    const historyQueryItemEntity = { id: existingItem.id } as HistoryQueryItemEntity<SouthItemSettings>;
    await copyHistoryQueryItemCommandToHistoryQueryItemEntity(historyQueryItemEntity, command, existingItem, historyQuery.southType);
    this.historyQueryRepository.saveHistoryQueryItem(historyQuery.id, historyQueryItemEntity);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async enableItem(historyId: string, itemId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    const item = this.findItemById(historyId, itemId);
    this.historyQueryRepository.enableHistoryQueryItem(item.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async disableItem(historyId: string, itemId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    const item = this.findItemById(historyId, itemId);
    this.historyQueryRepository.disableHistoryQueryItem(item.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async enableItems(historyId: string, itemIds: Array<string>): Promise<void> {
    const historyQuery = this.findById(historyId);

    for (const itemId of itemIds) {
      const item = this.findItemById(historyId, itemId);
      this.historyQueryRepository.enableHistoryQueryItem(item.id);
    }

    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteItem(historyId: string, itemId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    const item = this.findItemById(historyId, itemId);
    this.historyQueryRepository.deleteHistoryQueryItem(item.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async disableItems(historyId: string, itemIds: Array<string>): Promise<void> {
    const historyQuery = this.findById(historyId);
    for (const itemId of itemIds) {
      const item = this.findItemById(historyId, itemId);
      this.historyQueryRepository.disableHistoryQueryItem(item.id);
    }
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteItems(historyId: string, itemIds: Array<string>): Promise<void> {
    const historyQuery = this.findById(historyId);
    for (const itemId of itemIds) {
      const item = this.findItemById(historyId, itemId);
      this.historyQueryRepository.deleteHistoryQueryItem(item.id);
    }
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteAllItems(historyId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    this.historyQueryRepository.deleteAllHistoryQueryItemsByHistoryQuery(historyId);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, true);
  }

  async checkImportItems(
    southType: string,
    fileContent: string,
    delimiter: string,
    existingItems: Array<HistoryQueryItemDTO>
  ): Promise<{
    items: Array<HistoryQueryItemDTO>;
    errors: Array<{ item: Record<string, string>; error: string }>;
  }> {
    const manifest = this.southService.getManifest(southType);
    const csvContent = csv.parse(fileContent, { header: true, delimiter, skipEmptyLines: true });
    if (csvContent.meta.delimiter !== delimiter) {
      throw new OIBusValidationError(
        `The entered delimiter "${delimiter}" does not correspond to the file delimiter "${csvContent.meta.delimiter}"`
      );
    }

    const validItems: Array<HistoryQueryItemDTO> = [];
    const errors: Array<{ item: Record<string, string>; error: string }> = [];
    for (const data of csvContent.data) {
      const item: HistoryQueryItemDTO = {
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

  async importItems(historyId: string, items: Array<HistoryQueryItemCommandDTO>, deleteItemsNotPresent = false) {
    const historyQuery = this.findById(historyId);
    const manifest = this.southService.getManifest(historyQuery.southType);
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
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async addOrEditTransformer(historyId: string, transformerWithOptions: TransformerDTOWithOptions): Promise<void> {
    const historyQuery = this.findById(historyId);
    this.historyQueryRepository.addOrEditTransformer(historyQuery.id, transformerWithOptions);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.stopHistoryQuery(historyQuery.id);
  }

  async removeTransformer(historyId: string, transformerId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    this.historyQueryRepository.removeTransformer(historyQuery.id, transformerId);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.stopHistoryQuery(historyQuery.id);
  }

  async searchCacheContent(
    historyQueryId: string,
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    return await this.engine.searchCacheContent('history', historyQueryId, searchParams, folder);
  }

  async getCacheFileContent(historyId: string, folder: 'cache' | 'archive' | 'error', filename: string): Promise<ReadStream> {
    const fileStream = await this.engine.getCacheContentFileStream('history', historyId, folder, filename);
    if (!fileStream) {
      throw new NotFoundError(`File "${filename}" not found in ${folder}`);
    }
    return fileStream;
  }

  async removeCacheContent(historyId: string, folder: 'cache' | 'archive' | 'error', metadataFilenameList: Array<string>): Promise<void> {
    return await this.engine.removeCacheContent('history', historyId, folder, metadataFilenameList);
  }

  async removeAllCacheContent(historyId: string, folder: 'cache' | 'archive' | 'error'): Promise<void> {
    return await this.engine.removeAllCacheContent('history', historyId, folder);
  }

  async moveCacheContent(
    historyId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    cacheContentList: Array<string>
  ): Promise<void> {
    return await this.engine.moveCacheContent('history', historyId, originFolder, destinationFolder, cacheContentList);
  }

  async moveAllCacheContent(
    historyId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error'
  ): Promise<void> {
    return await this.engine.moveAllCacheContent('history', historyId, originFolder, destinationFolder);
  }

  retrieveSecrets(
    retrieveSecretsFromSouth: string | undefined,
    retrieveSecretsFromNorth: string | undefined,
    retrieveSecretsFromHistoryQuery: string | undefined,
    southManifest: SouthConnectorManifest,
    northManifest: NorthConnectorManifest
  ): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null {
    if (retrieveSecretsFromHistoryQuery) {
      const source = this.findById(retrieveSecretsFromHistoryQuery);
      if (source.southType !== southManifest.id) {
        throw new OIBusValidationError(
          `History query "${retrieveSecretsFromHistoryQuery}" (South type "${source.southType}") must be of the South type "${southManifest.id}"`
        );
      }
      if (source.northType !== northManifest.id) {
        throw new OIBusValidationError(
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
        const south = this.southService.findById(retrieveSecretsFromSouth);
        if (south.type !== southManifest.id) {
          throw new OIBusValidationError(
            `South connector "${retrieveSecretsFromSouth}" (type "${south.type}") must be of the type "${southManifest.id}"`
          );
        }
        source.southType = south.type;
        source.items = south.items;
        source.southSettings = south.settings;
      }
      if (retrieveSecretsFromNorth) {
        const north = this.northService.findById(retrieveSecretsFromNorth);
        if (north.type !== northManifest.id) {
          throw new OIBusValidationError(
            `North connector "${retrieveSecretsFromNorth}" (type "${north.type}") must be of the type "${northManifest.id}"`
          );
        }
        source.northType = north.type;
        source.northSettings = north.settings;
      }
      return source;
    }
    return null;
  }
}

const copyHistoryQueryCommandToHistoryQueryEntity = async (
  historyQueryEntity: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>,
  command: HistoryQueryCommandDTO,
  currentSettings: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null,
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
  historyQueryEntity.northSettings = await encryptionService.encryptConnectorSecrets(
    command.northSettings,
    currentSettings?.northSettings || null,
    northManifest.settings
  );
  historyQueryEntity.southSettings = await encryptionService.encryptConnectorSecrets(
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
      const itemEntity = { id: itemCommand.id } as HistoryQueryItemEntity<SouthItemSettings>;
      await copyHistoryQueryItemCommandToHistoryQueryItemEntity(
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

const copyHistoryQueryItemCommandToHistoryQueryItemEntity = async (
  historyQueryItemEntity: HistoryQueryItemEntity<SouthItemSettings>,
  command: HistoryQueryItemCommandDTO,
  currentSettings: HistoryQueryItemEntity<SouthItemSettings> | null,
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
  historyQueryItemEntity.settings = await encryptionService.encryptConnectorSecrets(
    command.settings,
    currentSettings?.settings || null,
    itemSettingsManifest
  );
};

export const toHistoryQueryLightDTO = (historyQuery: HistoryQueryEntityLight): HistoryQueryLightDTO => {
  return {
    id: historyQuery.id,
    name: historyQuery.name,
    description: historyQuery.description,
    status: historyQuery.status,
    startTime: historyQuery.startTime,
    endTime: historyQuery.endTime,
    southType: historyQuery.southType,
    northType: historyQuery.northType
  };
};

export const toHistoryQueryDTO = (historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>): HistoryQueryDTO => {
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
    southSettings: encryptionService.filterSecrets(historyQuery.southSettings, southManifest.settings),
    northSettings: encryptionService.filterSecrets(historyQuery.northSettings, northManifest.settings),
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
    items: historyQuery.items.map(item => toHistoryQueryItemDTO(item, historyQuery.southType)),
    northTransformers: historyQuery.northTransformers.map(transformerWithOptions => ({
      transformer: toTransformerDTO(transformerWithOptions.transformer),
      options: transformerWithOptions.options,
      inputType: transformerWithOptions.inputType
    }))
  };
};

export const toHistoryQueryItemDTO = (
  historyQueryItem: HistoryQueryItemEntity<SouthItemSettings>,
  southType: string
): HistoryQueryItemDTO => {
  const southManifest = southManifestList.find(element => element.id === southType)!;
  const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
    attribute => attribute.key === 'settings'
  )! as OIBusObjectAttribute;
  return {
    id: historyQueryItem.id,
    name: historyQueryItem.name,
    enabled: historyQueryItem.enabled,
    settings: encryptionService.filterSecrets<SouthItemSettings>(historyQueryItem.settings, itemSettingsManifest)
  };
};
