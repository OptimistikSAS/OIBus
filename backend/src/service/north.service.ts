import { DateTime } from 'luxon';

import { NorthConnectorCommandDTO, NorthConnectorLightDTO, NorthConnectorTypedDTO } from '../../shared/model/api/north-connector.model';
import { NorthConnectorManifest, OIBusNorthType } from '../../shared/model/connector/north-manifest.model';

import { encryptionService } from './encryption.service';
import { northManifestList } from './north-manifests';
export { northManifestList } from './north-manifests';
import { SouthItemGroupLightDTO } from '../../shared/model/api/south-connector.model';
import { TransformerSourceCommandDTO, TransformerSourceDTO } from '../../shared/model/api/transformer.model';
import { OIBusRecordListContent } from '../../shared/model/common/content.model';
import { GetUserInfo } from '../../shared/model/common/types';
import { NorthSettings } from '../../shared/model/connector/north-settings.model';
import { NorthConnectorMetrics, OIBusConnectionTestResult } from '../../shared/model/domain/engine.model';
import { PresentedServerIdentity, ServerTrust, ServerTrustState } from '../../shared/model/domain/server-identity.model';

import type DataStreamEngine from '../engine/data-stream-engine';
import { CacheMetadataSource } from '../model/engine.model';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../model/north-connector.model';
import { ScanMode } from '../model/scan-mode.model';
import { SouthConnectorItemEntityLight, SouthItemGroupEntity, SouthItemGroupEntityLight } from '../model/south-connector.model';
import { NorthTransformerWithOptions, TransformerSource } from '../model/transformer.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import type NorthConnector from '../north/north-connector';
import { buildNorth, createNorthOrchestrator } from '../north/north-connector-factory';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthItemGroupRepository from '../repository/config/south-item-group.repository';
import LogRepository from '../repository/logs/log.repository';
import NorthConnectorMetricsRepository from '../repository/metrics/north-connector-metrics.repository';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import type CertificateService from './certificate.service';
import type OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { toScanModeDTO } from './scan-mode.service';
import {
  resolveTestedServerTrust,
  retrievePresentedServerIdentity,
  retrieveServerIdentityToTrust,
  testConnectionWithServerIdentity,
  toServerTrust,
  toServerTrustDTO
} from './server-trust.utils';
import { toSouthConnectorLightDTO, toSouthItemLightDTO } from './south.service';
import TransformerService, { toTransformerDTO } from './transformer.service';
import { checkScanMode } from './utils';
import { NO_SERVER_TRUST, toTrustedServerIdentity } from './utils-server-identity';

export default class NorthService {
  constructor(
    protected readonly validator: JoiValidator,
    private northConnectorRepository: NorthConnectorRepository,
    private southConnectorRepository: SouthConnectorRepository,
    private southItemGroupRepository: SouthItemGroupRepository,
    private northMetricsRepository: NorthConnectorMetricsRepository,
    private scanModeRepository: ScanModeRepository,
    private logRepository: LogRepository,
    private readonly certificateService: CertificateService,
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
    copyNorthConnectorCommandToNorthEntity(
      northEntity,
      command,
      this.retrieveSecretsFromNorth(retrieveSecretsFromNorth, manifest),
      this.scanModeRepository.findAll(),
      createdBy
    );
    // A new connector, even copied from another one, only trusts the identity its command sends: the one the connector
    // copied trusts may not be the identity of the server of the copy
    northEntity.serverTrust = toServerTrust(command.serverTrust, null, createdBy);
    northEntity.createdBy = createdBy;
    northEntity.updatedBy = createdBy;
    const transformers = this.transformerService.findAll();
    northEntity.transformers = command.transformers.map(transformerWithOptions => {
      const foundTransformer = transformers.find(transformer => transformer.id === transformerWithOptions.transformerId);
      if (!foundTransformer) {
        throw new NotFoundError(`Could not find OIBus transformer "${transformerWithOptions.transformerId}"`);
      }
      return {
        id: '',
        transformer: foundTransformer,
        options: transformerWithOptions.options,
        source: this.transformerSourceFromCommand(transformerWithOptions.source)
      };
    });
    this.northConnectorRepository.saveNorth(northEntity, true);
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
    copyNorthConnectorCommandToNorthEntity(northEntity, command, previousSettings, this.scanModeRepository.findAll(), updatedBy);
    northEntity.createdBy = previousSettings.createdBy;
    northEntity.updatedBy = updatedBy;
    const transformers = this.transformerService.findAll();
    northEntity.transformers = command.transformers.map(transformerWithOptions => {
      const foundTransformer = transformers.find(transformer => transformer.id === transformerWithOptions.transformerId);
      if (!foundTransformer) {
        throw new NotFoundError(`Could not find OIBus transformer "${transformerWithOptions.transformerId}"`);
      }
      return {
        id: transformerWithOptions.id,
        transformer: foundTransformer,
        options: transformerWithOptions.options,
        source: this.transformerSourceFromCommand(transformerWithOptions.source)
      };
    });

    this.northConnectorRepository.saveNorth(northEntity, false);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadNorth(northEntity);
  }

  async delete(northId: string, userId: string) {
    const northConnector = this.findById(northId);
    await this.engine.deleteNorth(northConnector);
    this.northConnectorRepository.deleteNorth(northId, userId);
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

  getNorthMetric(northId: string): NorthConnectorMetrics {
    return this.engine.getNorthMetrics(northId);
  }

  /**
   * The trust of the connector in the identity of its server, with the identity the connector refused at its last
   * connection (pending, until a user trusts it).
   */
  getServerTrustState(northId: string): ServerTrustState {
    const northConnector = this.findById(northId);
    let pending = null;
    try {
      pending = this.engine.getNorth(northId).north.getPendingServerIdentity();
    } catch {
      // Not in the engine
    }
    return { ...northConnector.serverTrust, pending };
  }

  /**
   * The identity the server of the saved connector presents now, and how it compares with the identity trusted, without
   * connecting further (no credential is sent). `null` when the connector does not check it.
   */
  async retrieveSavedServerIdentity(northId: string): Promise<PresentedServerIdentity | null> {
    const northConnector = this.findById(northId);
    const north = this.buildThrowawayNorth({ ...northConnector, enabled: false, transformers: [] });
    return await retrievePresentedServerIdentity(north, northConnector.serverTrust.identity);
  }

  /**
   * Trust the identity the server of the connector presents, when its fingerprint is the one the user reviewed, and restart
   * the connector so that it connects with it.
   */
  async trustServerIdentity(northId: string, fingerprint: string, trustedBy: string): Promise<void> {
    const northConnector = this.findById(northId);
    const north = this.buildThrowawayNorth({ ...northConnector, enabled: false, transformers: [] });
    const identity = await retrieveServerIdentityToTrust(north, fingerprint);
    this.northConnectorRepository.updateServerTrust(
      northId,
      { identity: toTrustedServerIdentity(identity, trustedBy, DateTime.now().toUTC().toISO()!), trustOnFirstUse: false },
      trustedBy
    );
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadNorth(northConnector);
    this.engine.logger.info(
      `Server identity ${identity.fingerprint} trusted by "${trustedBy}" for North connector "${northConnector.name}" (${northId})`
    );
  }

  /**
   * Test the connection with these settings. For a connector checking the identity of its server, the connection is only
   * tested further when the server is trusted (see `testConnectionWithServerIdentity`), by the connector, by the history
   * query (`historyServerTrust`), or in the form of the connector (`trustedFingerprint`, not saved yet).
   */
  async testNorth(
    northId: string,
    northType: OIBusNorthType,
    settingsToTest: NorthSettings,
    trustedFingerprint: string | null = null,
    historyServerTrust: ServerTrust | null = null,
    // Whether the caller shows the identity of a server not trusted (otherwise, the test fails)
    withServerIdentity = false
  ): Promise<OIBusConnectionTestResult> {
    const { north, serverTrust } = await this.buildEphemeralNorth(
      northId,
      northType,
      settingsToTest,
      trustedFingerprint,
      historyServerTrust
    );
    return await testConnectionWithServerIdentity(north, serverTrust.identity, withServerIdentity);
  }

  /**
   * The identity the server presents with these settings, and how it compares with the identity trusted (as for
   * `testNorth`), without connecting further: no credential is sent. `null` when the connector does not check it.
   */
  async retrieveServerIdentity(
    northId: string,
    northType: OIBusNorthType,
    settingsToTest: NorthSettings,
    trustedFingerprint: string | null = null,
    historyServerTrust: ServerTrust | null = null
  ): Promise<PresentedServerIdentity | null> {
    const { north, serverTrust } = await this.buildEphemeralNorth(
      northId,
      northType,
      settingsToTest,
      trustedFingerprint,
      historyServerTrust
    );
    return await retrievePresentedServerIdentity(north, serverTrust.identity);
  }

  /**
   * A throwaway North connector built from raw settings, the secrets left blank taken from the saved connector, which trusts
   * the identity saved for the connector (or the history query) or trusted in its form (`trustedFingerprint`).
   */
  private async buildEphemeralNorth(
    northId: string,
    northType: OIBusNorthType,
    settingsToTest: NorthSettings,
    trustedFingerprint: string | null,
    historyServerTrust: ServerTrust | null
  ): Promise<{ north: NorthConnector<NorthSettings>; serverTrust: ServerTrust }> {
    let northConnector: NorthConnectorEntity<NorthSettings> | null = null;
    if (northId !== 'create' && northId !== 'history') {
      northConnector = this.findById(northId);
    }
    const manifest = this.getManifest(northType);
    await this.validator.validateSettings(manifest.settings, settingsToTest);

    const savedServerTrust = northConnector?.serverTrust ?? historyServerTrust ?? NO_SERVER_TRUST;
    const north = this.buildThrowawayNorth({
      id: 'test',
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: '',
      type: northType,
      description: '',
      enabled: false,
      settings: encryptionService.encryptConnectorSecrets(settingsToTest, northConnector?.settings || null, manifest.settings),
      // A connector of a former version trusts the identity of its first connection, not a throwaway one: the identity is
      // reviewed first (see testConnectionWithServerIdentity)
      serverTrust: { ...savedServerTrust, trustOnFirstUse: false },
      name: `${northType}:test-connection`,
      transformers: [],
      caching: {
        trigger: {
          scanMode: {
            id: 'test',
            name: 'test',
            description: '',
            type: 'cron',
            cron: '',
            interval: null,
            activationWindow: null,
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
          retentionDuration: 0,
          maxSize: 0
        },
        archive: {
          enabled: false,
          retentionDuration: 0,
          maxSize: 0
        }
      }
    });
    const serverTrust = await resolveTestedServerTrust(savedServerTrust, trustedFingerprint, () => north.retrieveServerIdentity());
    return { north, serverTrust };
  }

  /** A North connector built from an entity, never started by the engine. */
  buildThrowawayNorth(entity: NorthConnectorEntity<NorthSettings>): NorthConnector<NorthSettings> {
    return buildNorth(
      entity,
      this.certificateService,
      this.oIAnalyticsRegistrationRepository,
      createNorthOrchestrator(this.engine.baseFolder, 'test', entity.name)
    );
  }

  addOrEditTransformer(northId: string, transformerWithOptions: NorthTransformerWithOptions, userId: string): void {
    const northConnector = this.findById(northId);
    this.northConnectorRepository.addOrEditTransformer(northConnector.id, transformerWithOptions, userId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.engine.updateNorthConfiguration(northConnector.id);
  }

  removeTransformer(northId: string, northTransformerId: string, userId: string): void {
    const northConnector = this.findById(northId);
    this.northConnectorRepository.removeTransformer(northTransformerId, userId);
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

    // The setpoints are sent as records: their reference and value
    const setpointContent: OIBusRecordListContent = {
      type: 'record-list',
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

  transformerSourceFromCommand(sourceCommand: TransformerSourceCommandDTO): TransformerSource {
    switch (sourceCommand.type) {
      case 'south': {
        const south = this.southConnectorRepository.findSouthById(sourceCommand.southId);
        if (!south) {
          throw new NotFoundError(`Could not find South connector "${sourceCommand.southId}"`);
        }
        let group: SouthItemGroupEntity | undefined;
        if (sourceCommand.groupId) {
          const result = this.southItemGroupRepository.findById(sourceCommand.groupId);
          if (!result) {
            throw new NotFoundError(`Could not find Group "${sourceCommand.groupId}"`);
          }
          group = result;
        }
        const toItem = (itemLight: { id: string; name: string }): SouthConnectorItemEntityLight => {
          const item = south.items.find(element => element.id === itemLight.id);
          if (!item) {
            throw new NotFoundError(`Could not find South connector item "${itemLight.name}" (${itemLight.id})`);
          }
          return {
            id: item.id,
            name: item.name,
            enabled: item.enabled,
            createdBy: item.createdBy,
            updatedBy: item.updatedBy,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          };
        };
        const items = sourceCommand.items.map(toItem);
        return {
          type: 'south',
          south: {
            id: south.id,
            name: south.name,
            type: south.type,
            description: south.description,
            enabled: south.enabled,
            createdBy: south.createdBy,
            updatedBy: south.updatedBy,
            createdAt: south.createdAt,
            updatedAt: south.updatedAt
          },
          group,
          items,
          // Only a transformer applying to all the items of the south, or of the group, leaves items out
          excludedItems: items.length === 0 ? (sourceCommand.excludedItems ?? []).map(toItem) : []
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
    serverTrust: toServerTrustDTO(northEntity.serverTrust, getUserInfo),
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
        retentionDuration: northEntity.caching.error.retentionDuration,
        maxSize: northEntity.caching.error.maxSize
      },
      archive: {
        enabled: northEntity.caching.archive.enabled,
        retentionDuration: northEntity.caching.archive.retentionDuration,
        maxSize: northEntity.caching.archive.maxSize
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
        group: source.group ? toSouthItemGroupLightDTO(source.group) : undefined,
        items: source.items.map(item => toSouthItemLightDTO(item, getUserInfo)),
        excludedItems: (source.excludedItems ?? []).map(item => toSouthItemLightDTO(item, getUserInfo))
      };
    case 'oibus-api':
    case 'oianalytics-setpoint':
      return source;
  }
};

export const copyNorthConnectorCommandToNorthEntity = (
  northEntity: NorthConnectorEntity<NorthSettings>,
  command: NorthConnectorCommandDTO,
  currentSettings: NorthConnectorEntity<NorthSettings> | null,
  scanModes: Array<ScanMode>,
  user: string
): void => {
  northEntity.name = command.name;
  northEntity.type = command.type;
  northEntity.description = command.description;
  northEntity.enabled = command.enabled;
  northEntity.settings = encryptionService.encryptConnectorSecrets(
    command.settings,
    currentSettings?.settings || null,
    northManifestList.find(element => element.id === northEntity.type)!.settings
  );
  northEntity.serverTrust = toServerTrust(command.serverTrust, currentSettings?.serverTrust ?? null, user);
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
      retentionDuration: command.caching.error.retentionDuration,
      maxSize: command.caching.error.maxSize
    },
    archive: {
      enabled: command.caching.archive.enabled,
      retentionDuration: command.caching.archive.retentionDuration,
      maxSize: command.caching.archive.maxSize
    }
  };
};

export const toSouthItemGroupLightDTO = (entity: SouthItemGroupEntityLight): SouthItemGroupLightDTO => {
  return {
    id: entity.id,
    name: entity.name
  };
};
