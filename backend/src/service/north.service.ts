import { encryptionService } from './encryption.service';
import {
  NorthConnectorCommandDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthConnectorTypedDTO,
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
import { GetUserInfo } from '../../shared/model/types';
import { ScanMode } from '../model/scan-mode.model';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import { NorthSettings } from '../../shared/model/north-settings.model';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import DataStreamEngine from '../engine/data-stream-engine';
import { PassThrough } from 'node:stream';
import {
  CacheMetadataSource,
  NorthConnectorMetrics,
  OIBusConnectionTestResult,
  OIBusSetpointContent
} from '../../shared/model/engine.model';
import TransformerService, { toTransformerDTO } from './transformer.service';
import { toScanModeDTO } from './scan-mode.service';
import { buildNorth, createNorthOrchestrator } from '../north/north-connector-factory';
import { NotFoundError, OIBusValidationError } from '../model/types';
import { NorthTransformerWithOptions, TransformerSource } from '../model/transformer.model';
import { toSouthConnectorLightDTO, toSouthItemLightDTO } from './south.service';
import { TransformerSourceDTO } from '../../shared/model/transformer.model';
import { SouthConnectorItemEntityLight, SouthItemGroupEntity, SouthItemGroupEntityLight } from '../model/south-connector.model';
import SouthItemGroupRepository from '../repository/config/south-item-group.repository';
import { SouthItemGroupLightDTO } from '../../shared/model/south-connector.model';

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
    private southItemGroupRepository: SouthItemGroupRepository,
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

  async create(
    command: NorthConnectorCommandDTO,
    retrieveSecretsFromNorth: string | null,
    createdBy: string
  ): Promise<NorthConnectorEntity<NorthSettings>> {
    const manifest = this.getManifest(command.type);
    await this.validator.validateSettings(manifest.settings, command.settings);

    // Check for unique name
    const existingNorths = this.northConnectorRepository.findAllNorth();
    if (existingNorths.some(north => north.name === command.name)) {
      throw new OIBusValidationError(`North connector name "${command.name}" already exists`);
    }

    const northEntity = {} as NorthConnectorEntity<NorthSettings>;
    await copyNorthConnectorCommandToNorthEntity(
      northEntity,
      command,
      this.retrieveSecretsFromNorth(retrieveSecretsFromNorth, manifest),
      this.scanModeRepository.findAll()
    );
    northEntity.createdBy = createdBy;
    northEntity.updatedBy = createdBy;
    const transformers = this.transformerService.findAll();
    northEntity.transformers = command.transformers.map(transformerWithOptions => {
      const foundTransformer = transformers.find(transformer => transformer.id === transformerWithOptions.transformer.id);
      if (!foundTransformer) {
        throw new NotFoundError(`Could not find OIBus transformer "${transformerWithOptions.transformer.id}"`);
      }
      return {
        id: '',
        transformer: foundTransformer,
        options: transformerWithOptions.options,
        source: this.transformerSourceFromCommand(transformerWithOptions.source)
      };
    });
    this.northConnectorRepository.saveNorth(northEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    await this.engine.createNorth(northEntity.id);
    if (northEntity.enabled) {
      await this.engine.startNorth(northEntity.id);
    }
    return northEntity;
  }

  async update(northId: string, command: NorthConnectorCommandDTO, updatedBy: string) {
    const previousSettings = this.findById(northId);
    const manifest = this.getManifest(command.type);
    await this.validator.validateSettings(manifest.settings, command.settings);

    // Check for unique name (excluding current entity)
    if (command.name !== previousSettings.name) {
      const existingNorths = this.northConnectorRepository.findAllNorth();
      if (existingNorths.some(north => north.id !== northId && north.name === command.name)) {
        throw new OIBusValidationError(`North connector name "${command.name}" already exists`);
      }
    }

    const northEntity = { id: previousSettings.id } as NorthConnectorEntity<NorthSettings>;
    await copyNorthConnectorCommandToNorthEntity(northEntity, command, previousSettings, this.scanModeRepository.findAll());
    northEntity.createdBy = previousSettings.createdBy;
    northEntity.updatedBy = updatedBy;
    const transformers = this.transformerService.findAll();
    northEntity.transformers = command.transformers.map(transformerWithOptions => {
      const foundTransformer = transformers.find(transformer => transformer.id === transformerWithOptions.transformer.id);
      if (!foundTransformer) {
        throw new NotFoundError(`Could not find OIBus transformer "${transformerWithOptions.transformer.id}"`);
      }
      return {
        id: transformerWithOptions.id,
        transformer: foundTransformer,
        options: transformerWithOptions.options,
        source: this.transformerSourceFromCommand(transformerWithOptions.source)
      };
    });

    this.northConnectorRepository.saveNorth(northEntity);
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
    return this.engine.getNorthSSE(northId);
  }

  getNorthMetric(northId: string): NorthConnectorMetrics | null {
    return this.engine.getNorthMetrics(northId);
  }

  async testNorth(northId: string, northType: OIBusNorthType, settingsToTest: NorthSettings): Promise<OIBusConnectionTestResult> {
    let northConnector: NorthConnectorEntity<NorthSettings> | null = null;
    if (northId !== 'create' && northId !== 'history') {
      northConnector = this.findById(northId);
    }
    const manifest = this.getManifest(northType);
    await this.validator.validateSettings(manifest.settings, settingsToTest);

    const testToRun: NorthConnectorEntity<NorthSettings> = {
      id: 'test',
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: '',
      type: northType,
      description: '',
      enabled: false,
      settings: await encryptionService.encryptConnectorSecrets(settingsToTest, northConnector?.settings || null, manifest.settings),
      name: `${northType}:test-connection`,
      transformers: [],
      caching: {
        trigger: {
          scanMode: {
            id: 'test',
            name: 'test',
            description: '',
            cron: '',
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
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

    const childLoggerForTest = this.engine.logger.child(
      {
        scopeType: 'north',
        scopeId: 'test',
        scopeName: `${northType}:test-connection`
      },
      { level: 'silent' }
    );
    const north = buildNorth(
      testToRun,
      childLoggerForTest,
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository,
      createNorthOrchestrator(this.engine.baseFolder, 'test', childLoggerForTest)
    );
    return await north.testConnection();
  }

  addOrEditTransformer(northId: string, transformerWithOptions: NorthTransformerWithOptions): void {
    const northConnector = this.findById(northId);
    this.northConnectorRepository.addOrEditTransformer(northConnector.id, transformerWithOptions);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.engine.updateNorthConfiguration(northConnector.id);
  }

  removeTransformer(northId: string, northTransformerId: string): void {
    const northConnector = this.findById(northId);
    this.northConnectorRepository.removeTransformer(northTransformerId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.engine.updateNorthConfiguration(northConnector.id);
  }

  async executeSetpoint(
    northConnectorId: string,
    commandContent: Array<{
      reference: string;
      value: string;
    }>,
    callback: (result: string) => void
  ) {
    const northConnector = this.engine.getNorth(northConnectorId).north;
    if (!northConnector.isEnabled()) {
      throw new OIBusValidationError(`North connector "${northConnectorId}" disabled`);
    }

    const setpointContent: OIBusSetpointContent = {
      type: 'setpoint',
      content: commandContent
    };

    const source: CacheMetadataSource = {
      source: 'oianalytics-setpoints'
    };
    await northConnector.cacheContent(setpointContent, source);

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

  transformerSourceFromCommand(sourceCommand: TransformerSourceDTO): TransformerSource {
    switch (sourceCommand.type) {
      case 'south': {
        const south = this.southConnectorRepository.findSouthById(sourceCommand.south.id);
        if (!south) {
          throw new NotFoundError(`Could not find South connector "${sourceCommand.south.id}"`);
        }
        let group: SouthItemGroupEntity | undefined;
        if (sourceCommand.group) {
          const result = this.southItemGroupRepository.findById(sourceCommand.group.id);
          if (!result) {
            throw new NotFoundError(`Could not find Group "${sourceCommand.group.id}"`);
          }
          group = result;
        }
        const items: Array<SouthConnectorItemEntityLight> = sourceCommand.items.map(item => {
          if (!south.items.map(element => element.id).includes(item.id)) {
            throw new NotFoundError(`Could not find South connector item "${item.name}" (${item.id})`);
          }
          return {
            id: item.id,
            enabled: item.enabled,
            createdBy: item.createdBy.id,
            updatedBy: item.updatedBy.id,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            name: item.name
          };
        });
        return {
          type: 'south',
          south: {
            id: south.id,
            createdBy: south.createdBy,
            updatedBy: south.updatedBy,
            createdAt: south.createdAt,
            updatedAt: south.updatedAt,
            name: south.name,
            type: south.type,
            description: south.description,
            enabled: south.enabled
          },
          group,
          items
        };
      }
      case 'oianalytics-setpoint':
      case 'oibus-api':
        return sourceCommand;
    }
  }
}

export const toNorthConnectorLightDTO = (northEntity: NorthConnectorEntityLight, getUserInfo: GetUserInfo): NorthConnectorLightDTO => {
  return {
    id: northEntity.id,
    name: northEntity.name,
    type: northEntity.type,
    description: northEntity.description,
    enabled: northEntity.enabled,
    createdBy: getUserInfo(northEntity.createdBy),
    updatedBy: getUserInfo(northEntity.updatedBy),
    createdAt: northEntity.createdAt,
    updatedAt: northEntity.updatedAt
  };
};

export const toNorthConnectorDTO = (
  northEntity: NorthConnectorEntity<NorthSettings>,
  getUserInfo: GetUserInfo
): NorthConnectorTypedDTO<OIBusNorthType, NorthSettings> => {
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
        scanMode: toScanModeDTO(northEntity.caching.trigger.scanMode, getUserInfo),
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
    transformers: northEntity.transformers.map(transformerWithOptions => ({
      id: transformerWithOptions.id,
      transformer: toTransformerDTO(transformerWithOptions.transformer, getUserInfo),
      options: transformerWithOptions.options,
      source: toTransformerSourceDTO(transformerWithOptions.source, getUserInfo)
    })),
    createdBy: getUserInfo(northEntity.createdBy),
    updatedBy: getUserInfo(northEntity.updatedBy),
    createdAt: northEntity.createdAt,
    updatedAt: northEntity.updatedAt
  };
};

export const toTransformerSourceDTO = (source: TransformerSource, getUserInfo: GetUserInfo): TransformerSourceDTO => {
  switch (source.type) {
    case 'south':
      return {
        type: 'south',
        south: toSouthConnectorLightDTO(source.south, getUserInfo),
        group: source.group ? toSouthItemGroupLightDTO(source.group, getUserInfo) : undefined,
        items: source.items.map(item => toSouthItemLightDTO(item, getUserInfo))
      };
    case 'oibus-api':
    case 'oianalytics-setpoint':
      return source;
  }
};

export const copyNorthConnectorCommandToNorthEntity = async (
  northEntity: NorthConnectorEntity<NorthSettings>,
  command: NorthConnectorCommandDTO,
  currentSettings: NorthConnectorEntity<NorthSettings> | null,
  scanModes: Array<ScanMode>
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
};

export const toSouthItemGroupLightDTO = (entity: SouthItemGroupEntityLight, getUserInfo: GetUserInfo): SouthItemGroupLightDTO => {
  return {
    id: entity.id,
    name: entity.name,
    createdBy: getUserInfo(entity.createdBy),
    updatedBy: getUserInfo(entity.updatedBy),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
};
