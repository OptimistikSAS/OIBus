import {
  SouthConnectorCommandDTO,
  SouthConnectorManifest,
  SouthConnectorItemTestingSettings
} from '../../shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import {
  HistoryQueryEntity,
  HistoryQueryEntityLight,
  NorthHistoryQueryItemEntity,
  SouthHistoryQueryItemEntity
} from '../model/histor-query.model';
import { NorthItemSettings, NorthSettings } from '../../shared/model/north-settings.model';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQuerySouthItemCommandDTO,
  HistoryQuerySouthItemDTO,
  HistoryQueryItemSearchParam,
  HistoryQueryLightDTO,
  HistoryQueryNorthItemCommandDTO,
  HistoryQueryNorthItemDTO
} from '../../shared/model/history-query.model';
import { NorthConnectorCommandDTO, NorthConnectorManifest } from '../../shared/model/north-connector.model';
import EncryptionService from './encryption.service';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import { checkScanMode, createBaseFolders, filesExists } from './utils';
import SouthService, { southManifestList } from './south.service';
import NorthService, { northManifestList } from './north.service';
import LogRepository from '../repository/logs/log.repository';
import { Page } from '../../shared/model/types';
import pino from 'pino';
import { OIBusContent } from '../../shared/model/engine.model';
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
import { toTransformerDTO } from './transformer.service';

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
      this.historyQueryRepository,
      historyQueryBaseFolders,
      this.historyQueryEngine.logger.child({ scopeType: 'history-query', scopeId: settings.id, scopeName: settings.name })
    );
  }

  async testNorth(
    historyQueryId: string,
    retrieveSecretsFromNorth: string | null,
    command: NorthConnectorCommandDTO<NorthSettings, NorthItemSettings>,
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
    itemCommand: HistoryQuerySouthItemCommandDTO<SouthItemSettings>,
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

  findById<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings, J extends NorthItemSettings>(
    historyQueryId: string
  ): HistoryQueryEntity<S, N, I, J> | null {
    return this.historyQueryRepository.findHistoryQueryById<S, N, I, J>(historyQueryId);
  }

  findAll(): Array<HistoryQueryEntityLight> {
    return this.historyQueryRepository.findAllHistoryQueriesLight();
  }

  async createHistoryQuery<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings, J extends NorthItemSettings>(
    command: HistoryQueryCommandDTO<S, N, I, J>,
    retrieveSecretsFromSouth: string | null,
    retrieveSecretsFromNorth: string | null,
    retrieveSecretsFromHistoryQuery: string | null
  ): Promise<HistoryQueryEntity<S, N, I, J>> {
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
    for (const item of command.southItems) {
      await this.validator.validateSettings(southManifest.items.settings, item.settings);
      item.id = null;
    }

    const historyQuery = {} as HistoryQueryEntity<S, N, I, J>;
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

  async updateHistoryQuery<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings, J extends NorthItemSettings>(
    historyQueryId: string,
    command: HistoryQueryCommandDTO<S, N, I, J>,
    resetCache: boolean
  ): Promise<void> {
    const previousSettings = this.historyQueryRepository.findHistoryQueryById<S, N, I, J>(historyQueryId);
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
    for (const item of command.southItems) {
      await this.validator.validateSettings(southManifest.items.settings, item.settings);
    }

    const historyQuery = { id: previousSettings.id } as HistoryQueryEntity<S, N, I, J>;
    await copyHistoryQueryCommandToHistoryQueryEntity<S, N, I, J>(
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

  listSouthHistoryQueryItems<I extends SouthItemSettings>(
    historyQueryId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Array<SouthHistoryQueryItemEntity<I>> {
    return this.historyQueryRepository.listSouthHistoryQueryItems<I>(historyQueryId, searchParams);
  }

  listNorthHistoryQueryItems<I extends NorthItemSettings>(
    historyQueryId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Array<NorthHistoryQueryItemEntity<I>> {
    return this.historyQueryRepository.listNorthHistoryQueryItems<I>(historyQueryId, searchParams);
  }

  searchSouthHistoryQueryItems<I extends SouthItemSettings>(
    historyQueryId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Page<SouthHistoryQueryItemEntity<I>> {
    return this.historyQueryRepository.searchSouthHistoryQueryItems<I>(historyQueryId, searchParams);
  }

  searchNorthHistoryQueryItems<I extends NorthItemSettings>(
    historyQueryId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Page<NorthHistoryQueryItemEntity<I>> {
    return this.historyQueryRepository.searchNorthHistoryQueryItems<I>(historyQueryId, searchParams);
  }

  findAllSouthItemsForHistoryQuery<I extends SouthItemSettings>(historyQueryId: string): Array<SouthHistoryQueryItemEntity<I>> {
    return this.historyQueryRepository.findAllSouthItemsForHistoryQuery<I>(historyQueryId);
  }

  findAllNorthItemsForHistoryQuery<I extends NorthItemSettings>(historyQueryId: string): Array<NorthHistoryQueryItemEntity<I>> {
    return this.historyQueryRepository.findAllNorthItemsForHistoryQuery<I>(historyQueryId);
  }

  findSouthHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): SouthHistoryQueryItemEntity<SouthItemSettings> | null {
    return this.historyQueryRepository.findSouthHistoryQueryItemById(historyQueryId, historyQueryItemId);
  }

  findNorthHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): NorthHistoryQueryItemEntity<NorthItemSettings> | null {
    return this.historyQueryRepository.findNorthHistoryQueryItemById(historyQueryId, historyQueryItemId);
  }

  async createSouthHistoryQueryItem<I extends SouthItemSettings>(
    historyQueryId: string,
    command: HistoryQuerySouthItemCommandDTO<I>
  ): Promise<SouthHistoryQueryItemEntity<I>> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History Query ${historyQueryId} does not exist`);
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === historyQuery.southType);
    if (!manifest) {
      throw new Error(`South manifest does not exist for type ${historyQuery.southType}`);
    }
    await this.validator.validateSettings(manifest.items.settings, command.settings);

    const historyQueryItemEntity = {} as SouthHistoryQueryItemEntity<I>;
    await copySouthHistoryQueryItemCommandToSouthHistoryQueryItemEntity<I>(
      historyQueryItemEntity,
      command,
      null,
      historyQuery.southType,
      this.encryptionService
    );
    this.historyQueryRepository.saveSouthHistoryQueryItem<I>(historyQuery.id, historyQueryItemEntity);

    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();

    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
    return historyQueryItemEntity;
  }

  async createNorthHistoryQueryItem<I extends NorthItemSettings>(
    historyQueryId: string,
    command: HistoryQueryNorthItemCommandDTO<I>
  ): Promise<NorthHistoryQueryItemEntity<I>> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History Query ${historyQueryId} does not exist`);
    }
    const manifest = this.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === historyQuery.northType);
    if (!manifest) {
      throw new Error(`North manifest does not exist for type ${historyQuery.northType}`);
    }
    await this.validator.validateSettings(manifest.items.settings, command.settings);

    const historyQueryItemEntity = {} as NorthHistoryQueryItemEntity<I>;
    await copyNorthHistoryQueryItemCommandToNorthHistoryQueryItemEntity<I>(
      historyQueryItemEntity,
      command,
      null,
      historyQuery.northType,
      this.encryptionService
    );
    this.historyQueryRepository.saveNorthHistoryQueryItem<I>(historyQuery.id, historyQueryItemEntity);

    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
    return historyQueryItemEntity;
  }

  async updateSouthHistoryQueryItem<I extends SouthItemSettings>(
    historyQueryId: string,
    historyQueryItemId: string,
    command: HistoryQuerySouthItemCommandDTO<I>
  ): Promise<void> {
    const previousSettings = this.historyQueryRepository.findSouthHistoryQueryItemById<I>(historyQueryId, historyQueryItemId);
    if (!previousSettings) {
      throw new Error(`History query south item with ID ${historyQueryItemId} does not exist`);
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

    const historyQueryItemEntity = { id: previousSettings.id } as SouthHistoryQueryItemEntity<I>;
    await copySouthHistoryQueryItemCommandToSouthHistoryQueryItemEntity<I>(
      historyQueryItemEntity,
      command,
      previousSettings,
      historyQuery.southType,
      this.encryptionService
    );
    this.historyQueryRepository.saveSouthHistoryQueryItem<I>(historyQuery.id, historyQueryItemEntity);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
  }

  async updateNorthHistoryQueryItem<I extends NorthItemSettings>(
    historyQueryId: string,
    historyQueryItemId: string,
    command: HistoryQueryNorthItemCommandDTO<I>
  ): Promise<void> {
    const previousSettings = this.historyQueryRepository.findNorthHistoryQueryItemById<I>(historyQueryId, historyQueryItemId);
    if (!previousSettings) {
      throw new Error(`History query north item with ID ${historyQueryItemId} does not exist`);
    }
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} does not exist`);
    }
    const manifest = this.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === historyQuery.northType);
    if (!manifest) {
      throw new Error(`North manifest does not exist for type ${historyQuery.northType}`);
    }
    await this.validator.validateSettings(manifest.items.settings, command.settings);

    const historyQueryItemEntity = { id: previousSettings.id } as NorthHistoryQueryItemEntity<I>;
    await copyNorthHistoryQueryItemCommandToNorthHistoryQueryItemEntity<I>(
      historyQueryItemEntity,
      command,
      previousSettings,
      historyQuery.northType,
      this.encryptionService
    );
    this.historyQueryRepository.saveNorthHistoryQueryItem<I>(historyQuery.id, historyQueryItemEntity);
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteSouthHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} does not exist`);
    }
    const historyQueryItem = this.historyQueryRepository.findSouthHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) throw new Error(`History query south item ${historyQueryItemId} not found`);

    this.historyQueryRepository.deleteSouthHistoryQueryItem(historyQueryItem.id);
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteNorthHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} does not exist`);
    }
    const historyQueryItem = this.historyQueryRepository.findNorthHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) throw new Error(`History query north item ${historyQueryItemId} not found`);

    this.historyQueryRepository.deleteNorthHistoryQueryItem(historyQueryItem.id);

    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteAllSouthItemsForHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} not found`);
    }
    this.historyQueryRepository.deleteAllSouthHistoryQueryItemsByHistoryQuery(historyQueryId);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, true);
  }

  async deleteAllNorthItemsForHistoryQuery(historyQueryId: string): Promise<void> {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} not found`);
    }
    this.historyQueryRepository.deleteAllNorthHistoryQueryItemsByHistoryQuery(historyQueryId);
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, true);
  }

  async enableSouthHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQueryItem = this.historyQueryRepository.findSouthHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) {
      throw new Error(`History query south item ${historyQueryItemId} not found`);
    }

    this.historyQueryRepository.enableSouthHistoryQueryItem(historyQueryItem.id);
    await this.historyQueryEngine.reloadHistoryQuery(this.historyQueryRepository.findHistoryQueryById(historyQueryId)!, false);
  }

  async enableNorthHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQueryItem = this.historyQueryRepository.findNorthHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) {
      throw new Error(`History query north item ${historyQueryItemId} not found`);
    }

    this.historyQueryRepository.enableNorthHistoryQueryItem(historyQueryItem.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(this.historyQueryRepository.findHistoryQueryById(historyQueryId)!, false);
  }

  async disableSouthHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQueryItem = this.historyQueryRepository.findSouthHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) {
      throw new Error(`History query south item ${historyQueryItemId} not found`);
    }

    this.historyQueryRepository.disableSouthHistoryQueryItem(historyQueryItem.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(this.historyQueryRepository.findHistoryQueryById(historyQueryId)!, false);
  }

  async disableNorthHistoryQueryItem(historyQueryId: string, historyQueryItemId: string): Promise<void> {
    const historyQueryItem = this.historyQueryRepository.findNorthHistoryQueryItemById(historyQueryId, historyQueryItemId);
    if (!historyQueryItem) {
      throw new Error(`History query north item ${historyQueryItemId} not found`);
    }

    this.historyQueryRepository.disableNorthHistoryQueryItem(historyQueryItem.id);
    await this.historyQueryEngine.reloadHistoryQuery(this.historyQueryRepository.findHistoryQueryById(historyQueryId)!, false);
  }

  async checkSouthCsvFileImport<I extends SouthItemSettings>(
    southType: string,
    file: multer.File,
    delimiter: string,
    existingItems: Array<HistoryQuerySouthItemDTO<I> | HistoryQuerySouthItemCommandDTO<I>>
  ): Promise<{
    items: Array<HistoryQuerySouthItemCommandDTO<SouthItemSettings>>;
    errors: Array<{ item: HistoryQuerySouthItemCommandDTO<SouthItemSettings>; error: string }>;
  }> {
    const fileContent = await fs.readFile(file.path);
    return await this.checkSouthCsvContentImport(southType, fileContent.toString('utf8'), delimiter, existingItems);
  }

  async checkSouthCsvContentImport<I extends SouthItemSettings>(
    southType: string,
    fileContent: string,
    delimiter: string,
    existingItems: Array<HistoryQuerySouthItemDTO<I> | HistoryQuerySouthItemCommandDTO<I>>
  ): Promise<{
    items: Array<HistoryQuerySouthItemCommandDTO<SouthItemSettings>>;
    errors: Array<{ item: HistoryQuerySouthItemCommandDTO<SouthItemSettings>; error: string }>;
  }> {
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southType);
    if (!manifest) {
      throw new Error(`South manifest does not exist for type ${southType}`);
    }

    const csvContent = csv.parse(fileContent, { header: true, delimiter });

    if (csvContent.meta.delimiter !== delimiter) {
      throw new Error(`The entered delimiter "${delimiter}" does not correspond to the file delimiter "${csvContent.meta.delimiter}"`);
    }

    const validItems: Array<HistoryQuerySouthItemCommandDTO<I>> = [];
    const errors: Array<{ item: HistoryQuerySouthItemCommandDTO<I>; error: string }> = [];
    for (const data of csvContent.data) {
      const item: HistoryQuerySouthItemCommandDTO<I> = {
        id: '',
        name: (data as unknown as Record<string, string>).name,
        enabled: (data as unknown as Record<string, string>).enabled.toLowerCase() === 'true',
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

  async checkNorthCsvFileImport<I extends NorthItemSettings>(
    northType: string,
    file: multer.File,
    delimiter: string,
    existingItems: Array<HistoryQueryNorthItemDTO<I> | HistoryQueryNorthItemCommandDTO<I>>
  ): Promise<{
    items: Array<HistoryQueryNorthItemCommandDTO<NorthItemSettings>>;
    errors: Array<{ item: HistoryQueryNorthItemCommandDTO<NorthItemSettings>; error: string }>;
  }> {
    const fileContent = await fs.readFile(file.path);
    return await this.checkNorthCsvContentImport(northType, fileContent.toString('utf8'), delimiter, existingItems);
  }

  async checkNorthCsvContentImport<I extends NorthItemSettings>(
    northType: string,
    fileContent: string,
    delimiter: string,
    existingItems: Array<HistoryQueryNorthItemDTO<I> | HistoryQueryNorthItemCommandDTO<I>>
  ): Promise<{
    items: Array<HistoryQueryNorthItemCommandDTO<NorthItemSettings>>;
    errors: Array<{ item: HistoryQueryNorthItemCommandDTO<NorthItemSettings>; error: string }>;
  }> {
    const manifest = this.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === northType);
    if (!manifest) {
      throw new Error(`North manifest does not exist for type ${northType}`);
    }

    const csvContent = csv.parse(fileContent, { header: true, delimiter });

    if (csvContent.meta.delimiter !== delimiter) {
      throw new Error(`The entered delimiter "${delimiter}" does not correspond to the file delimiter "${csvContent.meta.delimiter}"`);
    }

    const validItems: Array<HistoryQueryNorthItemCommandDTO<I>> = [];
    const errors: Array<{ item: HistoryQueryNorthItemCommandDTO<I>; error: string }> = [];
    for (const data of csvContent.data) {
      const item: HistoryQueryNorthItemCommandDTO<I> = {
        id: '',
        name: (data as unknown as Record<string, string>).name,
        enabled: (data as unknown as Record<string, string>).enabled.toLowerCase() === 'true',
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

  async importSouthItems<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings, J extends NorthItemSettings>(
    historyQueryId: string,
    items: Array<HistoryQuerySouthItemCommandDTO<I>>,
    deleteItemsNotPresent = false
  ) {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById<S, N, I, J>(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} does not exist`);
    }
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === historyQuery.southType)!;
    const itemsToAdd: Array<SouthHistoryQueryItemEntity<I>> = [];
    for (const itemCommand of items) {
      await this.validator.validateSettings(manifest.items.settings, itemCommand.settings);
      const historyQueryItemEntity = {} as SouthHistoryQueryItemEntity<I>;
      await copySouthHistoryQueryItemCommandToSouthHistoryQueryItemEntity<I>(
        historyQueryItemEntity,
        itemCommand,
        null,
        historyQuery.southType,
        this.encryptionService
      );
      itemsToAdd.push(historyQueryItemEntity);
    }
    this.historyQueryRepository.saveAllSouthItems<I>(historyQuery.id, itemsToAdd, deleteItemsNotPresent);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
  }

  async importNorthItems<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings, J extends NorthItemSettings>(
    historyQueryId: string,
    items: Array<HistoryQueryNorthItemCommandDTO<J>>,
    deleteItemsNotPresent = false
  ) {
    const historyQuery = this.historyQueryRepository.findHistoryQueryById<S, N, I, J>(historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${historyQueryId} does not exist`);
    }
    const manifest = this.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === historyQuery.northType)!;
    const itemsToAdd: Array<NorthHistoryQueryItemEntity<J>> = [];
    for (const itemCommand of items) {
      await this.validator.validateSettings(manifest.items.settings, itemCommand.settings);
      const historyQueryItemEntity = {} as NorthHistoryQueryItemEntity<J>;
      await copyNorthHistoryQueryItemCommandToNorthHistoryQueryItemEntity<J>(
        historyQueryItemEntity,
        itemCommand,
        null,
        historyQuery.northType,
        this.encryptionService
      );
      itemsToAdd.push(historyQueryItemEntity);
    }
    this.historyQueryRepository.saveAllNorthItems<J>(historyQuery.id, itemsToAdd, deleteItemsNotPresent);
    await this.historyQueryEngine.reloadHistoryQuery(historyQuery, false);
  }

  private async deleteBaseFolders(historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>) {
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
  ): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings> | null {
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
      const source = {
        southItems: [] as Array<SouthHistoryQueryItemEntity<SouthItemSettings>>,
        northItems: [] as Array<NorthHistoryQueryItemEntity<NorthItemSettings>>
      } as HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>;
      if (retrieveSecretsFromSouth) {
        const south = this.southConnectorRepository.findSouthById(retrieveSecretsFromSouth);
        if (!south) {
          throw new Error(`Could not find south connector ${retrieveSecretsFromSouth} to retrieve secrets from`);
        }
        if (south.type !== southManifest.id) {
          throw new Error(`South connector ${retrieveSecretsFromSouth} (type ${south.type}) must be of the type ${southManifest.id}`);
        }
        source.southType = south.type;
        source.southItems = south.items;
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
        source.northItems = north.items;
        source.northSettings = north.settings;
      }
      return source;
    }
    return null;
  }
}

export const toHistoryQueryDTO = <
  S extends SouthSettings,
  N extends NorthSettings,
  I extends SouthItemSettings,
  J extends NorthItemSettings
>(
  historyQuery: HistoryQueryEntity<S, N, I, J>,
  encryptionService: EncryptionService
): HistoryQueryDTO<S, N, I, J> => {
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
    southItems: historyQuery.southItems.map(item => toSouthHistoryQueryItemDTO<I>(item, historyQuery.southType, encryptionService)),
    northItems: historyQuery.northItems.map(item => toNorthHistoryQueryItemDTO<J>(item, historyQuery.northType, encryptionService)),
    northTransformers: historyQuery.northTransformers.map(transformer => ({
      order: transformer.order,
      transformer: toTransformerDTO(transformer.transformer)
    })),
    southTransformers: historyQuery.southTransformers.map(transformer => ({
      order: transformer.order,
      transformer: toTransformerDTO(transformer.transformer)
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

const copyHistoryQueryCommandToHistoryQueryEntity = async <
  S extends SouthSettings,
  N extends NorthSettings,
  I extends SouthItemSettings,
  J extends NorthItemSettings
>(
  historyQueryEntity: HistoryQueryEntity<S, N, I, J>,
  command: HistoryQueryCommandDTO<S, N, I, J>,
  currentSettings: HistoryQueryEntity<S, N, I, J> | null,
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

  historyQueryEntity.southItems = await Promise.all(
    command.southItems.map(async itemCommand => {
      const itemEntity = { id: itemCommand.id } as SouthHistoryQueryItemEntity<I>;
      await copySouthHistoryQueryItemCommandToSouthHistoryQueryItemEntity<I>(
        itemEntity,
        itemCommand,
        currentSettings?.southItems.find(element => element.id === itemCommand.id) || null,
        historyQueryEntity.southType,
        encryptionService,
        retrieveSecrets
      );
      return itemEntity;
    })
  );

  historyQueryEntity.northItems = await Promise.all(
    command.northItems.map(async itemCommand => {
      const itemEntity = { id: itemCommand.id } as NorthHistoryQueryItemEntity<J>;
      await copyNorthHistoryQueryItemCommandToNorthHistoryQueryItemEntity<J>(
        itemEntity,
        itemCommand,
        currentSettings?.northItems.find(element => element.id === itemCommand.id) || null,
        historyQueryEntity.northType,
        encryptionService,
        retrieveSecrets
      );
      return itemEntity;
    })
  );
};

const copySouthHistoryQueryItemCommandToSouthHistoryQueryItemEntity = async <I extends SouthItemSettings>(
  historyQueryItemEntity: SouthHistoryQueryItemEntity<I>,
  command: HistoryQuerySouthItemCommandDTO<I>,
  currentSettings: SouthHistoryQueryItemEntity<I> | null,
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

const copyNorthHistoryQueryItemCommandToNorthHistoryQueryItemEntity = async <I extends NorthItemSettings>(
  historyQueryItemEntity: NorthHistoryQueryItemEntity<I>,
  command: HistoryQueryNorthItemCommandDTO<I>,
  currentSettings: NorthHistoryQueryItemEntity<I> | null,
  northType: string,
  encryptionService: EncryptionService,
  retrieveSecrets = false
): Promise<void> => {
  const northManifest = northManifestList.find(element => element.id === northType)!;
  historyQueryItemEntity.id = retrieveSecrets ? '' : command.id || ''; // reset id if it is a copy from another history query
  historyQueryItemEntity.name = command.name;
  historyQueryItemEntity.enabled = command.enabled;
  historyQueryItemEntity.settings = await encryptionService.encryptConnectorSecrets<I>(
    command.settings,
    currentSettings?.settings || null,
    northManifest.items.settings
  );
};

export const toSouthHistoryQueryItemDTO = <I extends SouthItemSettings>(
  historyQueryItem: SouthHistoryQueryItemEntity<I>,
  southType: string,
  encryptionService: EncryptionService
): HistoryQuerySouthItemDTO<I> => {
  const southManifest = southManifestList.find(element => element.id === southType)!;
  return {
    id: historyQueryItem.id,
    name: historyQueryItem.name,
    enabled: historyQueryItem.enabled,
    settings: encryptionService.filterSecrets<I>(historyQueryItem.settings, southManifest.items.settings)
  };
};

export const toNorthHistoryQueryItemDTO = <I extends NorthItemSettings>(
  historyQueryItem: NorthHistoryQueryItemEntity<I>,
  northType: string,
  encryptionService: EncryptionService
): HistoryQueryNorthItemDTO<I> => {
  const northManifest = northManifestList.find(element => element.id === northType)!;
  return {
    id: historyQueryItem.id,
    name: historyQueryItem.name,
    enabled: historyQueryItem.enabled,
    settings: encryptionService.filterSecrets<I>(historyQueryItem.settings, northManifest.settings)
  };
};
