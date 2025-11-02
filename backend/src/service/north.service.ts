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
import { TransformerDTOWithOptions } from '../../shared/model/transformer.model';
import { Transformer } from '../model/transformer.model';
import { toScanModeDTO } from './scan-mode.service';
import { buildNorth } from '../north/north-connector-factory';
import { NotFoundError, OIBusValidationError } from '../model/types';

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

  listManifest(): Array<NorthConnectorManifest> {
    return northManifestList;
  }

  getManifest(type: string): NorthConnectorManifest {
    const manifest = northManifestList.find(element => element.id === type);
    if (!manifest) {
      throw new NotFoundError(`North manifest "${type}" not found`);
    }
    return manifest;
  }

  list(): Array<NorthConnectorEntityLight> {
    return this.northConnectorRepository.findAllNorth();
  }

  findById(northId: string): NorthConnectorEntity<NorthSettings> {
    const north = this.northConnectorRepository.findNorthById(northId);
    if (!north) {
      throw new NotFoundError(`North "${northId}" not found`);
    }
    return north;
  }

  async create(command: NorthConnectorCommandDTO, retrieveSecretsFromNorth: string | null): Promise<NorthConnectorEntity<NorthSettings>> {
    const manifest = this.getManifest(command.type);
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

  async update(northId: string, command: NorthConnectorCommandDTO) {
    const previousSettings = this.findById(northId);
    const manifest = this.getManifest(command.type);
    await this.validator.validateSettings(manifest.settings, command.settings);

    const northEntity = { id: previousSettings.id } as NorthConnectorEntity<NorthSettings>;
    await copyNorthConnectorCommandToNorthEntity(
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

  async delete(northId: string) {
    const northConnector = this.findById(northId);
    await this.engine.deleteNorth(northConnector);
    this.northConnectorRepository.deleteNorth(northId);
    this.logRepository.deleteLogsByScopeId('north', northConnector.id);
    this.northMetricsRepository.removeMetrics(northConnector.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    this.engine.logger.info(`Deleted North connector "${northConnector.name}" (${northConnector.id})`);
  }

  async start(northId: string) {
    const northConnector = this.findById(northId);
    this.northConnectorRepository.startNorth(northId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.startNorth(northConnector.id);
  }

  async stop(northId: string) {
    const northConnector = this.findById(northId);
    this.northConnectorRepository.stopNorth(northId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.stopNorth(northConnector.id);
  }

  getNorthDataStream(northId: string): PassThrough | null {
    return this.engine.getNorthDataStream(northId);
  }

  async testNorth(northId: string, northType: OIBusNorthType, settingsToTest: NorthSettings): Promise<void> {
    let northConnector: NorthConnectorEntity<NorthSettings> | null = null;
    if (northId !== 'create' && northId !== 'history') {
      northConnector = this.findById(northId);
    }
    const manifest = this.getManifest(northType);
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

  addOrEditTransformer(northId: string, transformerWithOptions: TransformerDTOWithOptions): void {
    const northConnector = this.findById(northId);
    this.northConnectorRepository.addOrEditTransformer(northConnector.id, transformerWithOptions);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.engine.updateNorthConfiguration(northConnector.id);
  }

  removeTransformer(northId: string, transformerId: string): void {
    const northConnector = this.findById(northId);
    this.northConnectorRepository.removeTransformer(northConnector.id, transformerId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.engine.updateNorthConfiguration(northConnector.id);
  }

  checkSubscription(northId: string, southId: string): boolean {
    const northConnector = this.findById(northId);
    return this.northConnectorRepository.checkSubscription(northConnector.id, southId);
  }

  async subscribeToSouth(northId: string, southId: string): Promise<void> {
    const northConnector = this.findById(northId);

    const southConnector = this.southConnectorRepository.findSouthById(southId);
    if (!southConnector) {
      throw new NotFoundError(`South connector "${southId}" not found`);
    }

    if (this.checkSubscription(northConnector.id, southId)) {
      throw new OIBusValidationError(`North connector "${northConnector.name}" already subscribed to "${southConnector.name}"`);
    }

    this.northConnectorRepository.createSubscription(northId, southId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.engine.updateNorthConfiguration(northId);
  }

  async unsubscribeFromSouth(northId: string, southId: string): Promise<void> {
    const northConnector = this.findById(northId);

    const southConnector = this.southConnectorRepository.findSouthById(southId);
    if (!southConnector) {
      throw new NotFoundError(`South connector "${southId}" not found`);
    }

    this.northConnectorRepository.deleteSubscription(northConnector.id, southId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.engine.updateNorthConfiguration(northConnector.id);
  }

  async unsubscribeFromAllSouth(northId: string): Promise<void> {
    const northConnector = this.findById(northId);
    this.northConnectorRepository.deleteAllSubscriptionsByNorth(northConnector.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.engine.updateNorthConfiguration(northConnector.id);
  }

  async searchCacheContent(
    northId: string,
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    return await this.engine.searchCacheContent('north', northId, searchParams, folder);
  }

  async getCacheFileContent(northId: string, folder: 'cache' | 'archive' | 'error', filename: string): Promise<ReadStream> {
    const fileStream = await this.engine.getCacheContentFileStream('north', northId, folder, filename);
    if (!fileStream) {
      throw new NotFoundError(`File "${filename}" not found in ${folder}`);
    }
    return fileStream;
  }

  async removeCacheContent(northId: string, folder: 'cache' | 'archive' | 'error', metadataFilenameList: Array<string>): Promise<void> {
    return await this.engine.removeCacheContent('north', northId, folder, metadataFilenameList);
  }

  async removeAllCacheContent(northId: string, folder: 'cache' | 'archive' | 'error'): Promise<void> {
    return await this.engine.removeAllCacheContent('north', northId, folder);
  }

  async moveCacheContent(
    northId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    cacheContentList: Array<string>
  ): Promise<void> {
    return await this.engine.moveCacheContent('north', northId, originFolder, destinationFolder, cacheContentList);
  }

  async moveAllCacheContent(
    northId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error'
  ): Promise<void> {
    return await this.engine.moveAllCacheContent('north', northId, originFolder, destinationFolder);
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
      throw new NotFoundError(`North connector "${northConnectorId}" not found`);
    }

    if (!northConnector.isEnabled()) {
      throw new OIBusValidationError(`North connector "${northConnectorId}" disabled`);
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
    const source = this.findById(retrieveSecretsFromNorth);
    if (source.type !== manifest.id) {
      throw new Error(`North connector "${retrieveSecretsFromNorth}" (type "${source.type}") must be of the type "${manifest.id}"`);
    }
    return source;
  }
}

export const toNorthConnectorLightDTO = (northEntity: NorthConnectorEntityLight): NorthConnectorLightDTO => {
  return {
    id: northEntity.id,
    name: northEntity.name,
    type: northEntity.type,
    description: northEntity.description,
    enabled: northEntity.enabled
  };
};

export const toNorthConnectorDTO = (northEntity: NorthConnectorEntity<NorthSettings>): NorthConnectorDTO => {
  return {
    id: northEntity.id,
    name: northEntity.name,
    type: northEntity.type,
    description: northEntity.description,
    enabled: northEntity.enabled,
    settings: encryptionService.filterSecrets(
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

export const copyNorthConnectorCommandToNorthEntity = async (
  northEntity: NorthConnectorEntity<NorthSettings>,
  command: NorthConnectorCommandDTO,
  currentSettings: NorthConnectorEntity<NorthSettings> | null,
  scanModes: Array<ScanMode>,
  southConnectors: Array<SouthConnectorLightDTO>,
  transformers: Array<Transformer>
): Promise<void> => {
  northEntity.name = command.name;
  northEntity.type = command.type;
  northEntity.description = command.description;
  northEntity.enabled = command.enabled;
  northEntity.settings = await encryptionService.encryptConnectorSecrets(
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
      throw new NotFoundError(`Could not find south connector "${subscriptionId}"`);
    }
    return subscription;
  });
  northEntity.transformers = command.transformers.map(transformerIdWithOptions => {
    const foundTransformer = transformers.find(transformer => transformer.id === transformerIdWithOptions.transformerId);
    if (!foundTransformer) {
      throw new Error(`Could not find OIBus transformer "${transformerIdWithOptions.transformerId}"`);
    }
    return { transformer: foundTransformer, options: transformerIdWithOptions.options, inputType: transformerIdWithOptions.inputType };
  });
};
