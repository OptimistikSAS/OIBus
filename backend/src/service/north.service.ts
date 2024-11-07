import EncryptionService from './encryption.service';
import pino from 'pino';
import NorthConnector from '../north/north-connector';
import NorthConsole from '../north/north-console/north-console';
import {
  NorthCacheFiles,
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest
} from '../../shared/model/north-connector.model';
import azureManifest from '../north/north-azure-blob/manifest';
import oianalyticsManifest from '../north/north-oianalytics/manifest';
import fileWriterManifest from '../north/north-file-writer/manifest';
import consoleManifest from '../north/north-console/manifest';
import amazonManifest from '../north/north-amazon-s3/manifest';
import sftpManifest from '../north/north-sftp/manifest';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../model/north-connector.model';
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
  NorthAmazonS3Settings,
  NorthAzureBlobSettings,
  NorthConsoleSettings,
  NorthFileWriterSettings,
  NorthOIAnalyticsSettings,
  NorthSettings,
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
import { Instant } from '../../shared/model/types';
import { ReadStream } from 'node:fs';

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
    private logRepository: LogRepository,
    private readonly certificateRepository: CertificateRepository,
    private readonly oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
    private readonly encryptionService: EncryptionService,
    private readonly dataStreamEngine: DataStreamEngine
  ) {}

  runNorth(
    settings: NorthConnectorEntity<NorthSettings>,
    logger: pino.Logger,
    baseFolders: BaseFolders | undefined = undefined
  ): NorthConnector<NorthSettings> {
    const northBaseFolders = baseFolders ?? this.getDefaultBaseFolders(settings.id);

    switch (settings.type) {
      case 'aws-s3':
        return new NorthAmazonS3(
          settings as NorthConnectorEntity<NorthAmazonS3Settings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'azure-blob':
        return new NorthAzureBlob(
          settings as NorthConnectorEntity<NorthAzureBlobSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'console':
        return new NorthConsole(
          settings as NorthConnectorEntity<NorthConsoleSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'file-writer':
        return new NorthFileWriter(
          settings as NorthConnectorEntity<NorthFileWriterSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'oianalytics':
        return new NorthOIAnalytics(
          settings as NorthConnectorEntity<NorthOIAnalyticsSettings>,
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
          settings as NorthConnectorEntity<NorthSFTPSettings>,
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

  async testNorth<N extends NorthSettings>(id: string, command: NorthConnectorCommandDTO<N>, logger: pino.Logger): Promise<void> {
    let northConnector: NorthConnectorEntity<N> | null = null;
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

    const testToRun: NorthConnectorEntity<NorthSettings> = {
      id: northConnector?.id || 'test',
      ...command,
      caching: { ...command.caching, scanModeId: command.caching.scanModeId! },
      settings: await this.encryptionService.encryptConnectorSecrets<N>(
        command.settings,
        northConnector?.settings || null,
        manifest.settings
      ),
      name: northConnector ? northConnector.name : `${command!.type}:test-connection`,
      subscriptions: []
    };

    const north = this.runNorth(testToRun, logger, { cache: 'baseCacheFolder', archive: 'baseArchiveFolder', error: 'baseErrorFolder' });
    return await north.testConnection();
  }

  findById(northId: string): NorthConnectorEntity<NorthSettings> | null {
    return this.northConnectorRepository.findNorthById(northId);
  }

  findAll(): Array<NorthConnectorEntityLight> {
    return this.northConnectorRepository.findAllNorth();
  }

  getInstalledNorthManifests(): Array<NorthConnectorManifest> {
    return northManifestList;
  }

  async createNorth<N extends NorthSettings>(command: NorthConnectorCommandDTO<N>): Promise<NorthConnectorEntity<N>> {
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
    if (!manifest) {
      throw new Error(`North manifest does not exist for type ${command.type}`);
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const northEntity = {} as NorthConnectorEntity<N>;
    await copyNorthConnectorCommandToNorthEntity<N>(
      northEntity,
      command,
      null,
      this.encryptionService,
      this.scanModeRepository.findAll(),
      this.southConnectorRepository.findAllSouth()
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

  async updateNorth<N extends NorthSettings>(northConnectorId: string, command: NorthConnectorCommandDTO<N>) {
    const previousSettings = this.northConnectorRepository.findNorthById<N>(northConnectorId);
    if (!previousSettings) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
    if (!manifest) {
      throw new Error(`North manifest does not exist for type ${command.type}`);
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const northEntity = { id: previousSettings.id } as NorthConnectorEntity<N>;
    await copyNorthConnectorCommandToNorthEntity<N>(
      northEntity,
      command,
      previousSettings,
      this.encryptionService,
      this.scanModeRepository.findAll(),
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

  private async deleteBaseFolders(north: NorthConnectorEntity<NorthSettings>) {
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
}

export const toNorthConnectorDTO = <N extends NorthSettings>(
  northEntity: NorthConnectorEntity<N>,
  encryptionService: EncryptionService
): NorthConnectorDTO<N> => {
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
      maxSize: northEntity.caching.retryCount,
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
    subscriptions: northEntity.subscriptions
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

export const copyNorthConnectorCommandToNorthEntity = async <N extends NorthSettings>(
  northEntity: NorthConnectorEntity<N>,
  command: NorthConnectorCommandDTO<N>,
  currentSettings: NorthConnectorEntity<N> | null,
  encryptionService: EncryptionService,
  scanModes: Array<ScanMode>,
  southConnectors: Array<SouthConnectorLightDTO>
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
    maxSize: command.caching.retryCount,
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
};
