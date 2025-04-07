import EncryptionService from './encryption.service';
import pino from 'pino';
import NorthConnector from '../north/north-connector';
import NorthConsole from '../north/north-console/north-console';
import {
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
import restManifest from '../north/north-rest/manifest';
import opcuaManifest from '../north/north-opcua/manifest';
import mqttManifest from '../north/north-mqtt/manifest';
import modbusManifest from '../north/north-modbus/manifest';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../model/north-connector.model';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import NorthConnectorMetricsRepository from '../repository/metrics/north-connector-metrics.repository';
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
  NorthModbusSettings,
  NorthMQTTSettings,
  NorthOIAnalyticsSettings,
  NorthOPCUASettings,
  NorthRESTSettings,
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
import NorthREST from '../north/north-rest/north-rest';
import DataStreamEngine from '../engine/data-stream-engine';
import { SouthConnectorEntityLight } from '../model/south-connector.model';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import fs from 'node:fs/promises';
import { BaseFolders } from '../model/types';
import { ReadStream } from 'node:fs';
import { CacheMetadata, CacheSearchParam } from '../../shared/model/engine.model';
import TransformerService, { toTransformerDTO } from './transformer.service';
import { TransformerDTO } from '../../shared/model/transformer.model';
import NorthOPCUA from '../north/north-opcua/north-opcua';
import NorthMQTT from '../north/north-mqtt/north-mqtt';
import NorthModbus from '../north/north-modbus/north-modbus';
import { Transformer } from '../model/transformer.model';

export const northManifestList: Array<NorthConnectorManifest> = [
  consoleManifest,
  oianalyticsManifest,
  azureManifest,
  amazonManifest,
  fileWriterManifest,
  sftpManifest,
  restManifest,
  opcuaManifest,
  modbusManifest,
  mqttManifest
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
    private readonly transformerService: TransformerService,
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
          this.transformerService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'azure-blob':
        return new NorthAzureBlob(
          settings as NorthConnectorEntity<NorthAzureBlobSettings>,
          this.encryptionService,
          this.transformerService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'console':
        return new NorthConsole(
          settings as NorthConnectorEntity<NorthConsoleSettings>,
          this.encryptionService,
          this.transformerService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'file-writer':
        return new NorthFileWriter(
          settings as NorthConnectorEntity<NorthFileWriterSettings>,
          this.encryptionService,
          this.transformerService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'oianalytics':
        return new NorthOIAnalytics(
          settings as NorthConnectorEntity<NorthOIAnalyticsSettings>,
          this.encryptionService,
          this.transformerService,
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
          this.transformerService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'rest':
        return new NorthREST(
          settings as NorthConnectorEntity<NorthRESTSettings>,
          this.encryptionService,
          this.transformerService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'opcua':
        return new NorthOPCUA(
          settings as NorthConnectorEntity<NorthOPCUASettings>,
          this.encryptionService,
          this.transformerService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'mqtt':
        return new NorthMQTT(
          settings as NorthConnectorEntity<NorthMQTTSettings>,
          this.encryptionService,
          this.transformerService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolders
        );
      case 'modbus':
        return new NorthModbus(
          settings as NorthConnectorEntity<NorthModbusSettings>,
          this.encryptionService,
          this.transformerService,
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
      caching: { ...command.caching, trigger: { ...command.caching.trigger, scanModeId: command.caching.trigger.scanModeId! } },
      settings: await this.encryptionService.encryptConnectorSecrets<N>(
        command.settings,
        northConnector?.settings || null,
        manifest.settings
      ),
      name: northConnector ? northConnector.name : `${command!.type}:test-connection`,
      subscriptions: [],
      transformers: []
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

  async createNorth<N extends NorthSettings>(
    command: NorthConnectorCommandDTO<N>,
    retrieveSecretsFromNorth: string | null
  ): Promise<NorthConnectorEntity<N>> {
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
    if (!manifest) {
      throw new Error(`North manifest does not exist for type ${command.type}`);
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const northEntity = {} as NorthConnectorEntity<N>;
    await copyNorthConnectorCommandToNorthEntity(
      northEntity,
      command,
      this.retrieveSecretsFromNorth(retrieveSecretsFromNorth, manifest),
      this.encryptionService,
      this.scanModeRepository.findAll(),
      this.southConnectorRepository.findAllSouth(),
      this.transformerService.findAll()
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

  async searchCacheContent(
    northConnectorId: string,
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    return await this.dataStreamEngine.searchCacheContent(northConnectorId, searchParams, folder);
  }

  async getCacheContentFileStream(
    northConnectorId: string,
    folder: 'cache' | 'archive' | 'error',
    filename: string
  ): Promise<ReadStream | null> {
    return await this.dataStreamEngine.getCacheContentFileStream(northConnectorId, folder, filename);
  }

  async removeCacheContent(
    northConnectorId: string,
    folder: 'cache' | 'archive' | 'error',
    metadataFilenameList: Array<string>
  ): Promise<void> {
    return await this.dataStreamEngine.removeCacheContent(northConnectorId, folder, metadataFilenameList);
  }

  async removeAllCacheContent(northConnectorId: string, folder: 'cache' | 'archive' | 'error'): Promise<void> {
    return await this.dataStreamEngine.removeAllCacheContent(northConnectorId, folder);
  }

  async moveCacheContent(
    northConnectorId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    cacheContentList: Array<string>
  ): Promise<void> {
    return await this.dataStreamEngine.moveCacheContent(northConnectorId, originFolder, destinationFolder, cacheContentList);
  }

  async moveAllCacheContent(
    northConnectorId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error'
  ): Promise<void> {
    return await this.dataStreamEngine.moveAllCacheContent(northConnectorId, originFolder, destinationFolder);
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
      this.southConnectorRepository.findAllSouth(),
      this.transformerService.findAll()
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

  retrieveSecretsFromNorth(
    retrieveSecretsFromNorth: string | null,
    manifest: NorthConnectorManifest
  ): NorthConnectorEntity<NorthSettings> | null {
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
      trigger: {
        scanModeId: northEntity.caching.trigger.scanModeId,
        numberOfElements: northEntity.caching.trigger.numberOfElements,
        numberOfFiles: northEntity.caching.trigger.numberOfFiles
      },
      throttling: {
        runMinDelay: northEntity.caching.throttling.runMinDelay,
        maxSize: northEntity.caching.throttling.maxSize,
        maxNumberOfElements: northEntity.caching.throttling.maxNumberOfElements
      },
      error: {
        retryInterval: northEntity.caching.error.retryInterval,
        retryCount: northEntity.caching.error.retryCount,
        retentionDuration: northEntity.caching.error.retentionDuration
      },
      archive: {
        enabled: northEntity.caching.archive.enabled,
        retentionDuration: northEntity.caching.archive.retentionDuration
      }
    },
    subscriptions: northEntity.subscriptions,
    transformers: northEntity.transformers.map(transformerWithOptions => ({
      transformer: toTransformerDTO(transformerWithOptions.transformer),
      options: transformerWithOptions.options,
      inputType: transformerWithOptions.inputType
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

export const copyNorthConnectorCommandToNorthEntity = async <N extends NorthSettings>(
  northEntity: NorthConnectorEntity<N>,
  command: NorthConnectorCommandDTO<N>,
  currentSettings: NorthConnectorEntity<N> | null,
  encryptionService: EncryptionService,
  scanModes: Array<ScanMode>,
  southConnectors: Array<SouthConnectorLightDTO>,
  transformers: Array<Transformer>
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
  northEntity.subscriptions = command.subscriptions.map(subscriptionId => {
    const subscription = southConnectors.find(southConnector => southConnector.id === subscriptionId);
    if (!subscription) {
      throw new Error(`Could not find South Connector ${subscriptionId}`);
    }
    return subscription;
  });
  northEntity.transformers = command.transformers.map(transformerIdWithOptions => {
    const foundTransformer = transformers.find(transformer => transformer.id === transformerIdWithOptions.transformerId);
    if (!foundTransformer) {
      throw new Error(`Could not find OIBus Transformer ${transformerIdWithOptions.transformerId}`);
    }
    return { transformer: foundTransformer, options: transformerIdWithOptions.options, inputType: transformerIdWithOptions.inputType };
  });
};

export const getTransformer = (id: string | null, transformers: Array<TransformerDTO>): TransformerDTO | null => {
  if (!id) return null;
  const transformer = transformers.find(element => element.id === id);
  if (!transformer) {
    throw new Error(`Could not find OIBus Transformer ${id}`);
  }
  return transformer;
};
