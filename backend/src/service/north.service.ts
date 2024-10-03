import EncryptionService from './encryption.service';
import pino from 'pino';
import NorthConnector from '../north/north-connector';
import NorthConsole from '../north/north-console/north-console';
import {
  NorthCacheFiles,
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorItemCommandDTO,
  NorthConnectorItemDTO,
  NorthConnectorItemSearchParam,
  NorthConnectorLightDTO,
  NorthConnectorManifest
} from '../../shared/model/north-connector.model';
import azureManifest from '../north/north-azure-blob/manifest';
import oianalyticsManifest from '../north/north-oianalytics/manifest';
import fileWriterManifest from '../north/north-file-writer/manifest';
import consoleManifest from '../north/north-console/manifest';
import amazonManifest from '../north/north-amazon-s3/manifest';
import sftpManifest from '../north/north-sftp/manifest';
import { NorthConnectorEntity, NorthConnectorEntityLight, NorthConnectorItemEntity } from '../model/north-connector.model';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';
import LogRepository from '../repository/logs/log.repository';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { checkScanMode, createBaseFolders, filesExists } from './utils';
import { ScanMode } from '../model/scan-mode.model';
import { SouthConnectorLightDTO } from '../../shared/model/south-connector.model';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import {
  NorthAmazonS3ItemSettings,
  NorthAmazonS3Settings,
  NorthAzureBlobItemSettings,
  NorthAzureBlobSettings,
  NorthConsoleItemSettings,
  NorthConsoleSettings,
  NorthFileWriterItemSettings,
  NorthFileWriterSettings,
  NorthItemSettings,
  NorthOIAnalyticsItemSettings,
  NorthOIAnalyticsSettings,
  NorthSettings,
  NorthSFTPItemSettings,
  NorthSFTPSettings
} from '../../shared/model/north-settings.model';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import NorthAmazonS3 from '../north/north-amazon-s3/north-amazon-s3';
import NorthAzureBlob from '../north/north-azure-blob/north-azure-blob';
import NorthFileWriter from '../north/north-file-writer/north-file-writer';
import NorthOIAnalytics from '../north/north-oianalytics/north-oianalytics';
import NorthSFTP from '../north/north-sftp/north-sftp';
import DataStreamEngine from '../engine/data-stream-engine';
import { SouthConnectorEntityLight } from '../model/south-connector.model';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import fs from 'node:fs/promises';
import { BaseFolders } from '../model/types';
import { Instant, Page } from '../../shared/model/types';
import { ReadStream } from 'node:fs';
import { toTransformerDTO } from './transformer.service';
import multer from '@koa/multer';
import csv from 'papaparse';
import { Transformer } from '../model/transformer.model';
import TransformerRepository from '../repository/config/transformer.repository';

export const northManifestList: Array<NorthConnectorManifest> = [
  consoleManifest,
  oianalyticsManifest,
  azureManifest,
  amazonManifest,
  fileWriterManifest,
  sftpManifest
];

export default class NorthService {
  constructor(
    protected readonly validator: JoiValidator,
    private northConnectorRepository: NorthConnectorRepository,
    private southConnectorRepository: SouthConnectorRepository,
    private northMetricsRepository: NorthConnectorMetricsRepository,
    private scanModeRepository: ScanModeRepository,
    private transformerRepository: TransformerRepository,
    private logRepository: LogRepository,
    private readonly certificateRepository: CertificateRepository,
    private readonly oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
    private readonly encryptionService: EncryptionService,
    private readonly dataStreamEngine: DataStreamEngine
  ) {}

  runNorth(
    settings: NorthConnectorEntity<NorthSettings, NorthItemSettings>,
    logger: pino.Logger,
    baseFolders: BaseFolders | undefined = undefined
  ): NorthConnector<NorthSettings, NorthItemSettings> {
    const northBaseFolders = baseFolders ?? this.getDefaultBaseFolders(settings.id);

    switch (settings.type) {
      case 'aws-s3':
        return new NorthAmazonS3(
          settings as NorthConnectorEntity<NorthAmazonS3Settings, NorthAmazonS3ItemSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'azure-blob':
        return new NorthAzureBlob(
          settings as NorthConnectorEntity<NorthAzureBlobSettings, NorthAzureBlobItemSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'console':
        return new NorthConsole(
          settings as NorthConnectorEntity<NorthConsoleSettings, NorthConsoleItemSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'file-writer':
        return new NorthFileWriter(
          settings as NorthConnectorEntity<NorthFileWriterSettings, NorthFileWriterItemSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'oianalytics':
        return new NorthOIAnalytics(
          settings as NorthConnectorEntity<NorthOIAnalyticsSettings, NorthOIAnalyticsItemSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          this.certificateRepository,
          this.oIAnalyticsRegistrationRepository,
          logger,
          northBaseFolders
        );
      case 'sftp':
        return new NorthSFTP(
          settings as NorthConnectorEntity<NorthSFTPSettings, NorthSFTPItemSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      default:
        throw Error(`North connector of type ${settings.type} not installed`);
    }
  }

  async testNorth<N extends NorthSettings, I extends NorthItemSettings>(
    id: string,
    command: NorthConnectorCommandDTO<N, I>,
    logger: pino.Logger
  ): Promise<void> {
    let northConnector: NorthConnectorEntity<N, I> | null = null;
    if (id !== 'create') {
      northConnector = this.northConnectorRepository.findNorthById(id);
      if (!northConnector) {
        throw new Error(`North connector ${id} not found`);
      }
    }

    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
    if (!manifest) {
      throw new Error(`North manifest ${command.type} not found`);
    }

    await this.validator.validateSettings(manifest.settings, command.settings);

    const testToRun: NorthConnectorEntity<NorthSettings, NorthItemSettings> = {
      id: northConnector?.id || 'test',
      ...command,
      caching: { ...command.caching, scanModeId: command.caching.scanModeId! },
      settings: await this.encryptionService.encryptConnectorSecrets<N>(
        command.settings,
        northConnector?.settings || null,
        manifest.settings
      ),
      name: northConnector ? northConnector.name : `${command!.type}:test-connection`,
      subscriptions: [],
      items: [],
      transformers: command.transformers.map(element => {
        const foundTransformer = this.transformerRepository.searchTransformers({}).find(transformer => transformer.id === element.id);
        if (!foundTransformer) throw new Error(`Transformer ${element.id} not found`);
        return {
          transformer: foundTransformer,
          order: element.order
        };
      })
    };

    const north = this.runNorth(testToRun, logger, {
      cache: 'baseCacheFolder',
      archive: 'baseArchiveFolder',
      error: 'baseErrorFolder'
    });
    return await north.testConnection();
  }

  findById(northId: string): NorthConnectorEntity<NorthSettings, NorthItemSettings> | null {
    return this.northConnectorRepository.findNorthById(northId);
  }

  findAll(): Array<NorthConnectorEntityLight> {
    return this.northConnectorRepository.findAllNorth();
  }

  getInstalledNorthManifests(): Array<NorthConnectorManifest> {
    return northManifestList;
  }

  async createNorth<N extends NorthSettings, I extends NorthItemSettings>(
    command: NorthConnectorCommandDTO<N, I>,
    retrieveSecretsFromNorth: string | null
  ): Promise<NorthConnectorEntity<N, I>> {
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
    if (!manifest) {
      throw new Error(`North manifest does not exist for type ${command.type}`);
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const northEntity = {} as NorthConnectorEntity<N, I>;
    await copyNorthConnectorCommandToNorthEntity(
      northEntity,
      command,
      this.retrieveSecretsFromNorth(retrieveSecretsFromNorth, manifest),
      this.encryptionService,
      this.scanModeRepository.findAll(),
      this.transformerRepository.searchTransformers({}),
      this.southConnectorRepository.findAllSouth(),
      !!retrieveSecretsFromNorth
    );
    this.northConnectorRepository.saveNorthConnector(northEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    const baseFolders = this.getDefaultBaseFolders(northEntity.id);
    await createBaseFolders(baseFolders);

    await this.dataStreamEngine.createNorth(
      this.runNorth(
        this.findById(northEntity.id)!,
        this.dataStreamEngine.logger.child({ scopeType: 'north', scopeId: northEntity.id, scopeName: northEntity.name })
      )
    );
    if (northEntity.enabled) {
      await this.dataStreamEngine.startNorth(northEntity.id);
    }
    return northEntity;
  }

  getNorthDataStream(northConnectorId: string): PassThrough | null {
    return this.dataStreamEngine.getNorthDataStream(northConnectorId);
  }

  async getErrorFiles(
    northConnectorId: string,
    start: Instant | null,
    end: Instant | null,
    filenameContains: string | null
  ): Promise<Array<NorthCacheFiles>> {
    return await this.dataStreamEngine.getErrorFiles(northConnectorId, start, end, filenameContains);
  }

  async getErrorFileContent(northConnectorId: string, filename: string): Promise<ReadStream | null> {
    return await this.dataStreamEngine.getErrorFileContent(northConnectorId, filename);
  }

  async removeErrorFiles(northConnectorId: string, filenames: Array<string>): Promise<void> {
    return await this.dataStreamEngine.removeErrorFiles(northConnectorId, filenames);
  }

  async retryErrorFiles(northConnectorId: string, filenames: Array<string>): Promise<void> {
    return await this.dataStreamEngine.retryErrorFiles(northConnectorId, filenames);
  }

  async removeAllErrorFiles(northConnectorId: string): Promise<void> {
    return await this.dataStreamEngine.removeAllErrorFiles(northConnectorId);
  }

  async retryAllErrorFiles(northConnectorId: string): Promise<void> {
    return await this.dataStreamEngine.retryAllErrorFiles(northConnectorId);
  }

  async getCacheFiles(
    northConnectorId: string,
    start: Instant | null,
    end: Instant | null,
    filenameContains: string | null
  ): Promise<Array<NorthCacheFiles>> {
    return await this.dataStreamEngine.getCacheFiles(northConnectorId, start, end, filenameContains);
  }

  async getCacheFileContent(northConnectorId: string, filename: string): Promise<ReadStream | null> {
    return await this.dataStreamEngine.getCacheFileContent(northConnectorId, filename);
  }

  async removeCacheFiles(northConnectorId: string, filenames: Array<string>): Promise<void> {
    return await this.dataStreamEngine.removeCacheFiles(northConnectorId, filenames);
  }

  async archiveCacheFiles(northConnectorId: string, filenames: Array<string>): Promise<void> {
    return await this.dataStreamEngine.archiveCacheFiles(northConnectorId, filenames);
  }

  async removeAllCacheFiles(northConnectorId: string): Promise<void> {
    return await this.dataStreamEngine.removeAllCacheFiles(northConnectorId);
  }

  async getArchiveFiles(
    northConnectorId: string,
    start: Instant | null,
    end: Instant | null,
    filenameContains: string | null
  ): Promise<Array<NorthCacheFiles>> {
    return await this.dataStreamEngine.getArchiveFiles(northConnectorId, start, end, filenameContains);
  }

  async getArchiveFileContent(northConnectorId: string, filename: string): Promise<ReadStream | null> {
    return await this.dataStreamEngine.getArchiveFileContent(northConnectorId, filename);
  }

  async removeArchiveFiles(northConnectorId: string, filenames: Array<string>): Promise<void> {
    return await this.dataStreamEngine.removeArchiveFiles(northConnectorId, filenames);
  }

  async retryArchiveFiles(northConnectorId: string, filenames: Array<string>): Promise<void> {
    return await this.dataStreamEngine.retryArchiveFiles(northConnectorId, filenames);
  }

  async removeAllArchiveFiles(northConnectorId: string): Promise<void> {
    return await this.dataStreamEngine.removeAllArchiveFiles(northConnectorId);
  }

  async retryAllArchiveFiles(northConnectorId: string): Promise<void> {
    return await this.dataStreamEngine.retryAllArchiveFiles(northConnectorId);
  }

  async getCacheValues(northConnectorId: string, filenameContains: string): Promise<Array<NorthCacheFiles>> {
    return await this.dataStreamEngine.getCacheValues(northConnectorId, filenameContains);
  }

  async removeCacheValues(northConnectorId: string, filenames: Array<string>): Promise<void> {
    return await this.dataStreamEngine.removeCacheValues(northConnectorId, filenames);
  }

  async removeAllCacheValues(northConnectorId: string): Promise<void> {
    return await this.dataStreamEngine.removeAllCacheValues(northConnectorId);
  }

  async getErrorValues(
    northConnectorId: string,
    start: Instant | null,
    end: Instant | null,
    filenameContains: string | null
  ): Promise<Array<NorthCacheFiles>> {
    return await this.dataStreamEngine.getErrorValues(northConnectorId, start, end, filenameContains);
  }

  async removeErrorValues(northConnectorId: string, filenames: Array<string>): Promise<void> {
    return await this.dataStreamEngine.removeErrorValues(northConnectorId, filenames);
  }

  async retryErrorValues(northConnectorId: string, filenames: Array<string>): Promise<void> {
    return await this.dataStreamEngine.retryErrorValues(northConnectorId, filenames);
  }

  async removeAllErrorValues(northConnectorId: string): Promise<void> {
    return await this.dataStreamEngine.removeAllErrorValues(northConnectorId);
  }

  async retryAllErrorValues(northConnectorId: string): Promise<void> {
    return await this.dataStreamEngine.retryAllErrorValues(northConnectorId);
  }

  async updateNorth<N extends NorthSettings, I extends NorthItemSettings>(
    northConnectorId: string,
    command: NorthConnectorCommandDTO<N, I>
  ) {
    const previousSettings = this.northConnectorRepository.findNorthById<N, I>(northConnectorId);
    if (!previousSettings) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
    if (!manifest) {
      throw new Error(`North manifest does not exist for type ${command.type}`);
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const northEntity = { id: previousSettings.id } as NorthConnectorEntity<N, I>;
    await copyNorthConnectorCommandToNorthEntity<N, I>(
      northEntity,
      command,
      previousSettings,
      this.encryptionService,
      this.scanModeRepository.findAll(),
      this.transformerRepository.searchTransformers({}),
      this.southConnectorRepository.findAllSouth()
    );
    this.northConnectorRepository.saveNorthConnector(northEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.dataStreamEngine.reloadNorth(northEntity);
  }

  async deleteNorth(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
    await this.dataStreamEngine.deleteNorth(northConnector);
    await this.deleteBaseFolders(northConnector);
    this.northConnectorRepository.deleteNorth(northConnectorId);
    this.logRepository.deleteLogsByScopeId('north', northConnector.id);
    this.northMetricsRepository.removeMetrics(northConnector.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    this.dataStreamEngine.logger.info(`Deleted North connector "${northConnector.name}" (${northConnector.id})`);
  }

  async startNorth(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }

    this.northConnectorRepository.startNorth(northConnectorId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.dataStreamEngine.startNorth(northConnector.id);
  }

  async stopNorth(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }

    this.northConnectorRepository.stopNorth(northConnectorId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.dataStreamEngine.stopNorth(northConnector.id);
  }

  async findSubscriptionsByNorth(northId: string): Promise<Array<SouthConnectorEntityLight>> {
    const northConnector = this.northConnectorRepository.findNorthById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    return this.northConnectorRepository.listNorthSubscriptions(northConnector.id);
  }

  checkSubscription(northId: string, southId: string): boolean {
    return this.northConnectorRepository.checkSubscription(northId, southId);
  }

  async createSubscription(northId: string, southId: string): Promise<void> {
    const northConnector = this.northConnectorRepository.findNorthById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    const southConnector = this.southConnectorRepository.findSouthById(southId);
    if (!southConnector) {
      throw new Error('South connector not found');
    }

    if (this.checkSubscription(northId, southId)) {
      throw new Error('Subscription already exists');
    }

    this.northConnectorRepository.createSubscription(northId, southId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.dataStreamEngine.updateSubscription(northId);
  }

  async deleteSubscription(northId: string, southId: string): Promise<void> {
    const northConnector = this.northConnectorRepository.findNorthById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    const southConnector = this.southConnectorRepository.findSouthById(southId);
    if (!southConnector) {
      throw new Error('South connector not found');
    }

    this.northConnectorRepository.deleteSubscription(northId, southId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.dataStreamEngine.updateSubscription(northId);
  }

  async deleteAllSubscriptionsByNorth(northId: string): Promise<void> {
    const northConnector = this.northConnectorRepository.findNorthById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    this.northConnectorRepository.deleteAllSubscriptionsByNorth(northId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.dataStreamEngine.updateSubscription(northId);
  }

  getNorthItems<I extends NorthItemSettings>(northId: string): Array<NorthConnectorItemEntity<I>> {
    return this.northConnectorRepository.findAllItemsForNorth<I>(northId);
  }

  searchNorthItems<I extends NorthItemSettings>(
    northConnectorId: string,
    searchParams: NorthConnectorItemSearchParam
  ): Page<NorthConnectorItemEntity<I>> {
    return this.northConnectorRepository.searchItems<I>(northConnectorId, searchParams);
  }

  findNorthConnectorItemById(northConnectorId: string, itemId: string): NorthConnectorItemEntity<NorthItemSettings> | null {
    return this.northConnectorRepository.findItemById(northConnectorId, itemId);
  }

  async createItem<I extends NorthItemSettings>(
    northConnectorId: string,
    command: NorthConnectorItemCommandDTO<I>
  ): Promise<NorthConnectorItemEntity<I>> {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === northConnector.type);
    if (!manifest) {
      throw new Error(`North manifest does not exist for type ${northConnector.type}`);
    }
    await this.validator.validateSettings(manifest.items.settings, command.settings);

    const northItemEntity = {} as NorthConnectorItemEntity<I>;
    await copyNorthItemCommandToNorthItemEntity<I>(northItemEntity, command, null, northConnector.type, this.encryptionService);
    this.northConnectorRepository.saveItem<I>(northConnector.id, northItemEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.dataStreamEngine.reloadNorthItems(northConnector.id);
    return northItemEntity;
  }

  async updateItem<I extends NorthItemSettings>(
    northConnectorId: string,
    itemId: string,
    command: NorthConnectorItemCommandDTO<I>
  ): Promise<void> {
    const previousSettings = this.northConnectorRepository.findItemById<I>(northConnectorId, itemId);
    if (!previousSettings) {
      throw new Error(`North item with ID ${itemId} does not exist`);
    }
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId)!;
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === northConnector.type);
    if (!manifest) {
      throw new Error(`North manifest does not exist for type ${northConnector.type}`);
    }

    await this.validator.validateSettings(manifest.items.settings, command.settings);

    const northItemEntity = { id: previousSettings.id } as NorthConnectorItemEntity<I>;
    await copyNorthItemCommandToNorthItemEntity<I>(northItemEntity, command, previousSettings, northConnector.type, this.encryptionService);
    this.northConnectorRepository.saveItem<I>(northConnectorId, northItemEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.dataStreamEngine.reloadNorthItems(northConnector.id);
  }

  async deleteItem(northConnectorId: string, itemId: string): Promise<void> {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
    const northItem = this.northConnectorRepository.findItemById(northConnectorId, itemId);
    if (!northItem) throw new Error(`North item ${itemId} not found`);
    this.northConnectorRepository.deleteItem(northItem.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.dataStreamEngine.reloadNorthItems(northConnector.id);
  }

  async deleteAllItemsForNorthConnector(northConnectorId: string): Promise<void> {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
    this.northConnectorRepository.deleteAllItemsByNorth(northConnectorId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    await this.dataStreamEngine.reloadNorthItems(northConnector.id);
  }

  async enableItem(northConnectorId: string, itemId: string): Promise<void> {
    const northItem = this.northConnectorRepository.findItemById(northConnectorId, itemId);
    if (!northItem) throw new Error(`North item ${itemId} not found`);
    this.northConnectorRepository.enableItem(northItem.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    await this.dataStreamEngine.reloadNorthItems(northConnectorId);
  }

  async disableItem(northConnectorId: string, itemId: string): Promise<void> {
    const northItem = this.northConnectorRepository.findItemById(northConnectorId, itemId);
    if (!northItem) throw new Error(`North item ${itemId} not found`);
    this.northConnectorRepository.disableItem(northItem.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    await this.dataStreamEngine.reloadNorthItems(northConnectorId);
  }

  async checkCsvFileImport<I extends NorthItemSettings>(
    northType: string,
    file: multer.File,
    delimiter: string,
    existingItems: Array<NorthConnectorItemDTO<I> | NorthConnectorItemCommandDTO<I>>
  ): Promise<{
    items: Array<NorthConnectorItemCommandDTO<NorthItemSettings>>;
    errors: Array<{ item: NorthConnectorItemCommandDTO<NorthItemSettings>; error: string }>;
  }> {
    const fileContent = await fs.readFile(file.path);
    return await this.checkCsvContentImport(northType, fileContent.toString('utf8'), delimiter, existingItems);
  }

  async checkCsvContentImport<I extends NorthItemSettings>(
    northType: string,
    fileContent: string,
    delimiter: string,
    existingItems: Array<NorthConnectorItemDTO<I> | NorthConnectorItemCommandDTO<I>>
  ): Promise<{
    items: Array<NorthConnectorItemCommandDTO<NorthItemSettings>>;
    errors: Array<{ item: NorthConnectorItemCommandDTO<NorthItemSettings>; error: string }>;
  }> {
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === northType);
    if (!manifest) {
      throw new Error(`North manifest does not exist for type ${northType}`);
    }

    const csvContent = csv.parse(fileContent, { header: true, delimiter });

    if (csvContent.meta.delimiter !== delimiter) {
      throw new Error(`The entered delimiter "${delimiter}" does not correspond to the file delimiter "${csvContent.meta.delimiter}"`);
    }

    const validItems: Array<NorthConnectorItemCommandDTO<I>> = [];
    const errors: Array<{ item: NorthConnectorItemCommandDTO<I>; error: string }> = [];
    for (const data of csvContent.data) {
      const item: NorthConnectorItemCommandDTO<I> = {
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

  async importItems<I extends NorthItemSettings>(
    northConnectorId: string,
    items: Array<NorthConnectorItemCommandDTO<I>>,
    deleteItemsNotPresent = false
  ) {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === northConnector.type)!;
    const itemsToAdd: Array<NorthConnectorItemEntity<I>> = [];

    for (const itemCommand of items) {
      await this.validator.validateSettings(manifest.items.settings, itemCommand.settings);
      const northItemEntity = {} as NorthConnectorItemEntity<I>;
      await copyNorthItemCommandToNorthItemEntity(northItemEntity, itemCommand, null, northConnector.type, this.encryptionService);
      itemsToAdd.push(northItemEntity);
    }

    this.northConnectorRepository.saveAllItems(northConnector.id, itemsToAdd, deleteItemsNotPresent);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    await this.dataStreamEngine.reloadNorthItems(northConnectorId);
  }

  private async deleteBaseFolders(north: NorthConnectorEntity<NorthSettings, NorthItemSettings>) {
    const folders = this.getDefaultBaseFolders(north.id);

    for (const type of Object.keys(folders) as Array<keyof BaseFolders>) {
      try {
        const baseFolder = folders[type];
        this.dataStreamEngine.logger.trace(
          `Deleting "${type}" base folder "${baseFolder}" of North connector "${north.name}" (${north.id})`
        );

        if (await filesExists(baseFolder)) {
          await fs.rm(baseFolder, { recursive: true });
        }
      } catch (error: unknown) {
        this.dataStreamEngine.logger.error(
          `Unable to delete North connector "${north.name}" (${north.id}) "${type}" base folder: ${(error as Error).message}`
        );
      }
    }
  }

  private getDefaultBaseFolders(northId: string): BaseFolders {
    const folders = structuredClone(this.dataStreamEngine.baseFolders);

    for (const type of Object.keys(this.dataStreamEngine.baseFolders) as Array<keyof BaseFolders>) {
      folders[type] = path.resolve(folders[type], `north-${northId}`);
    }

    return folders;
  }

  retrieveSecretsFromNorth(
    retrieveSecretsFromNorth: string | null,
    manifest: NorthConnectorManifest
  ): NorthConnectorEntity<NorthSettings, NorthItemSettings> | null {
    if (!retrieveSecretsFromNorth) return null;
    const source = this.northConnectorRepository.findNorthById(retrieveSecretsFromNorth);
    if (!source) {
      throw new Error(`Could not find north connector ${retrieveSecretsFromNorth} to retrieve secrets from`);
    }
    if (source.type !== manifest.id) {
      throw new Error(`North connector ${retrieveSecretsFromNorth} (type ${source.type}) must be of the type ${manifest.id}`);
    }
    return source;
  }
}

const copyNorthItemCommandToNorthItemEntity = async <I extends NorthItemSettings>(
  northItemEntity: NorthConnectorItemEntity<I>,
  command: NorthConnectorItemCommandDTO<I>,
  currentSettings: NorthConnectorItemEntity<I> | null,
  northType: string,
  encryptionService: EncryptionService,
  retrieveSecretsFromNorth = false
): Promise<void> => {
  const manifest = northManifestList.find(element => element.id === northType)!;
  northItemEntity.id = retrieveSecretsFromNorth ? '' : command.id || ''; // reset id if it is a copy from another connector
  northItemEntity.name = command.name;
  northItemEntity.enabled = command.enabled;
  northItemEntity.settings = await encryptionService.encryptConnectorSecrets<I>(
    command.settings,
    currentSettings?.settings || null,
    manifest.items.settings
  );
};

export const toNorthConnectorDTO = <N extends NorthSettings, I extends NorthItemSettings>(
  northEntity: NorthConnectorEntity<N, I>,
  encryptionService: EncryptionService
): NorthConnectorDTO<N, I> => {
  return {
    id: northEntity.id,
    name: northEntity.name,
    type: northEntity.type,
    description: northEntity.description,
    enabled: northEntity.enabled,
    settings: encryptionService.filterSecrets<N>(
      northEntity.settings,
      northManifestList.find(element => element.id === northEntity.type)!.settings
    ),
    caching: {
      scanModeId: northEntity.caching.scanModeId,
      retryInterval: northEntity.caching.retryInterval,
      retryCount: northEntity.caching.retryCount,
      maxSize: northEntity.caching.maxSize,
      oibusTimeValues: {
        groupCount: northEntity.caching.oibusTimeValues.groupCount,
        maxSendCount: northEntity.caching.oibusTimeValues.maxSendCount
      },
      rawFiles: {
        sendFileImmediately: northEntity.caching.rawFiles.sendFileImmediately,
        archive: {
          enabled: northEntity.caching.rawFiles.archive.enabled,
          retentionDuration: northEntity.caching.rawFiles.archive.retentionDuration
        }
      }
    },
    subscriptions: northEntity.subscriptions,
    items: northEntity.items.map(item => toNorthConnectorItemDTO<I>(item, northEntity.type, encryptionService)),
    transformers: northEntity.transformers.map(transformer => ({
      order: transformer.order,
      transformer: toTransformerDTO(transformer.transformer)
    }))
  };
};

export const toNorthConnectorLightDTO = (entity: NorthConnectorEntityLight): NorthConnectorLightDTO => {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    description: entity.description,
    enabled: entity.enabled
  };
};

export const copyNorthConnectorCommandToNorthEntity = async <N extends NorthSettings, I extends NorthItemSettings>(
  northEntity: NorthConnectorEntity<N, I>,
  command: NorthConnectorCommandDTO<N, I>,
  currentSettings: NorthConnectorEntity<N, I> | null,
  encryptionService: EncryptionService,
  scanModes: Array<ScanMode>,
  transformers: Array<Transformer>,
  southConnectors: Array<SouthConnectorLightDTO>,
  retrieveSecretsFromNorth = false
): Promise<void> => {
  northEntity.name = command.name;
  northEntity.type = command.type;
  northEntity.description = command.description;
  northEntity.enabled = command.enabled;
  northEntity.settings = await encryptionService.encryptConnectorSecrets<N>(
    command.settings,
    currentSettings?.settings || null,
    northManifestList.find(element => element.id === northEntity.type)!.settings
  );
  northEntity.caching = {
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
  northEntity.subscriptions = command.subscriptions.map(subscriptionId => {
    const subscription = southConnectors.find(southConnector => southConnector.id === subscriptionId);
    if (!subscription) {
      throw new Error(`Could not find South Connector ${subscriptionId}`);
    }
    return subscription;
  });
  northEntity.items = await Promise.all(
    command.items.map(async itemCommand => {
      const itemEntity = {} as NorthConnectorItemEntity<I>;
      await copyNorthItemCommandToNorthItemEntity(
        itemEntity,
        itemCommand,
        currentSettings?.items.find(element => element.id === itemCommand.id) || null,
        northEntity.type,
        encryptionService,
        retrieveSecretsFromNorth
      );
      return itemEntity;
    })
  );
  northEntity.transformers = command.transformers.map(element => {
    const foundTransformer = transformers.find(transformer => transformer.id === element.id);
    if (!foundTransformer) throw new Error(`Transformer ${element.id} not found`);
    return {
      transformer: foundTransformer,
      order: element.order
    };
  });
};

export const toNorthConnectorItemDTO = <I extends NorthItemSettings>(
  entity: NorthConnectorItemEntity<I>,
  northType: string,
  encryptionService: EncryptionService
): NorthConnectorItemDTO<I> => {
  const manifest = northManifestList.find(element => element.id === northType)!;
  return {
    id: entity.id,
    name: entity.name,
    enabled: entity.enabled,
    settings: encryptionService.filterSecrets<I>(entity.settings, manifest.items.settings)
  };
};
