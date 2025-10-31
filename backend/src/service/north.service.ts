import { encryptionService } from './encryption.service';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  OIBusNorthType
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
import { checkScanMode } from './utils';
import { ScanMode } from '../model/scan-mode.model';
import { SouthConnectorLightDTO } from '../../shared/model/south-connector.model';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import { NorthSettings } from '../../shared/model/north-settings.model';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import DataStreamEngine from '../engine/data-stream-engine';
import { PassThrough } from 'node:stream';
import { ReadStream } from 'node:fs';
import { CacheMetadata, CacheSearchParam, OIBusSetpointContent } from '../../shared/model/engine.model';
import TransformerService, { toTransformerDTO } from './transformer.service';
import { TransformerDTO, TransformerDTOWithOptions } from '../../shared/model/transformer.model';
import { Transformer } from '../model/transformer.model';
import { toScanModeDTO } from './scan-mode.service';
import { buildNorth } from '../north/north-connector-factory';

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
    private readonly transformerService: TransformerService,
    private readonly engine: DataStreamEngine
  ) {}

  async testNorth(id: string, northType: OIBusNorthType, settingsToTest: NorthSettings): Promise<void> {
    let northConnector: NorthConnectorEntity<NorthSettings> | null = null;
    if (id !== 'create') {
      northConnector = this.northConnectorRepository.findNorthById(id);
      if (!northConnector) {
        throw new Error(`North connector "${id}" not found`);
      }
    }

    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === northType);
    if (!manifest) {
      throw new Error(`North manifest "${northType}" not found`);
    }

    await this.validator.validateSettings(manifest.settings, settingsToTest);

    const testToRun: NorthConnectorEntity<NorthSettings> = {
      id: northConnector?.id || 'test',
      type: northType,
      description: '',
      enabled: false,
      settings: await encryptionService.encryptConnectorSecrets(settingsToTest, northConnector?.settings || null, manifest.settings),
      name: northConnector ? northConnector.name : `${northType}:test-connection`,
      subscriptions: [],
      transformers: [],
      caching: {
        trigger: {
          scanMode: {
            id: 'test',
            name: 'test',
            description: '',
            cron: ''
          },
          numberOfElements: 0,
          numberOfFiles: 0
        },
        throttling: {
          runMinDelay: 0,
          maxSize: 0,
          maxNumberOfElements: 0
        },
        error: {
          retryInterval: 0,
          retryCount: 0,
          retentionDuration: 0
        },
        archive: {
          enabled: false,
          retentionDuration: 0
        }
      }
    };

    const north = buildNorth(
      testToRun,
      this.engine.logger.child(
        {
          scopeType: 'north',
          scopeId: 'test',
          scopeName: 'test'
        },
        { level: 'silent' }
      ),
      '',
      '',
      '',
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository
    );
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

  async createNorth(
    command: NorthConnectorCommandDTO<NorthSettings>,
    retrieveSecretsFromNorth: string | null
  ): Promise<NorthConnectorEntity<NorthSettings>> {
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
    if (!manifest) {
      throw new Error(`North manifest does not exist for type ${command.type}`);
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const northEntity = {} as NorthConnectorEntity<NorthSettings>;
    await copyNorthConnectorCommandToNorthEntity(
      northEntity,
      command,
      this.retrieveSecretsFromNorth(retrieveSecretsFromNorth, manifest),
      this.scanModeRepository.findAll(),
      this.southConnectorRepository.findAllSouth(),
      this.transformerService.findAll()
    );
    this.northConnectorRepository.saveNorthConnector(northEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    await this.engine.createNorth(northEntity.id);
    if (northEntity.enabled) {
      await this.engine.startNorth(northEntity.id);
    }
    return northEntity;
  }

  getNorthDataStream(northConnectorId: string): PassThrough | null {
    return this.engine.getNorthDataStream(northConnectorId);
  }

  async searchCacheContent(
    northConnectorId: string,
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    return await this.engine.searchCacheContent('north', northConnectorId, searchParams, folder);
  }

  async getCacheContentFileStream(
    northConnectorId: string,
    folder: 'cache' | 'archive' | 'error',
    filename: string
  ): Promise<ReadStream | null> {
    return await this.engine.getCacheContentFileStream('north', northConnectorId, folder, filename);
  }

  async removeCacheContent(
    northConnectorId: string,
    folder: 'cache' | 'archive' | 'error',
    metadataFilenameList: Array<string>
  ): Promise<void> {
    return await this.engine.removeCacheContent('north', northConnectorId, folder, metadataFilenameList);
  }

  async removeAllCacheContent(northConnectorId: string, folder: 'cache' | 'archive' | 'error'): Promise<void> {
    return await this.engine.removeAllCacheContent('north', northConnectorId, folder);
  }

  async moveCacheContent(
    northConnectorId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    cacheContentList: Array<string>
  ): Promise<void> {
    return await this.engine.moveCacheContent('north', northConnectorId, originFolder, destinationFolder, cacheContentList);
  }

  async moveAllCacheContent(
    northConnectorId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error'
  ): Promise<void> {
    return await this.engine.moveAllCacheContent('north', northConnectorId, originFolder, destinationFolder);
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
      this.scanModeRepository.findAll(),
      this.southConnectorRepository.findAllSouth(),
      this.transformerService.findAll()
    );
    this.northConnectorRepository.saveNorthConnector(northEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadNorth(northEntity);
  }

  async deleteNorth(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
    await this.engine.deleteNorth(northConnector);
    this.northConnectorRepository.deleteNorth(northConnectorId);
    this.logRepository.deleteLogsByScopeId('north', northConnector.id);
    this.northMetricsRepository.removeMetrics(northConnector.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    this.engine.logger.info(`Deleted North connector "${northConnector.name}" (${northConnector.id})`);
  }

  async startNorth(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }

    this.northConnectorRepository.startNorth(northConnectorId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.startNorth(northConnector.id);
  }

  async stopNorth(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }

    this.northConnectorRepository.stopNorth(northConnectorId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.stopNorth(northConnector.id);
  }

  addOrEditTransformer(northId: string, transformerWithOptions: TransformerDTOWithOptions): void {
    const northConnector = this.northConnectorRepository.findNorthById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    this.northConnectorRepository.addOrEditTransformer(northId, transformerWithOptions);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.engine.updateNorthConfiguration(northId);
  }

  removeTransformer(northId: string, transformerId: string): void {
    const northConnector = this.northConnectorRepository.findNorthById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    this.northConnectorRepository.removeTransformer(northId, transformerId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.engine.updateNorthConfiguration(northId);
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
    this.engine.updateNorthConfiguration(northId);
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
    this.engine.updateNorthConfiguration(northId);
  }

  async deleteAllSubscriptionsByNorth(northId: string): Promise<void> {
    const northConnector = this.northConnectorRepository.findNorthById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    this.northConnectorRepository.deleteAllSubscriptionsByNorth(northId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.engine.updateNorthConfiguration(northId);
  }

  async executeSetpoint(
    northConnectorId: string,
    commandContent: Array<{
      reference: string;
      value: string;
    }>,
    callback: (result: string) => void
  ) {
    const northConnector = this.engine.getNorth(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} not found`);
    }

    if (!northConnector.isEnabled()) {
      throw new Error(`North connector ${northConnectorId} disabled`);
    }

    const setpointContent: OIBusSetpointContent = {
      type: 'setpoint',
      content: commandContent
    };

    await northConnector.cacheContent(setpointContent, 'oianalytics');

    callback(`Setpoint ${JSON.stringify(commandContent)} properly sent into the cache of ${northConnectorId}`);
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

export const toNorthConnectorDTO = <N extends NorthSettings>(northEntity: NorthConnectorEntity<N>): NorthConnectorDTO<N> => {
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
        scanMode: toScanModeDTO(northEntity.caching.trigger.scanMode),
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
  northEntity.subscriptions = command.subscriptions.map(subscriptionId => {
    const subscription = southConnectors.find(southConnector => southConnector.id === subscriptionId);
    if (!subscription) {
      throw new Error(`Could not find South connector "${subscriptionId}"`);
    }
    return subscription;
  });
  northEntity.transformers = command.transformers.map(transformerIdWithOptions => {
    const foundTransformer = transformers.find(transformer => transformer.id === transformerIdWithOptions.transformerId);
    if (!foundTransformer) {
      throw new Error(`Could not find OIBus Transformer "${transformerIdWithOptions.transformerId}"`);
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
