import EncryptionService from './encryption.service';
import pino from 'pino';
import RepositoryService from './repository.service';
import NorthConnector from '../north/north-connector';
import NorthConsole from '../north/north-console/north-console';
import NorthOIAnalytics from '../north/north-oianalytics/north-oianalytics';
import NorthAzureBlob from '../north/north-azure-blob/north-azure-blob';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthConnectorWithoutSubscriptionsCommandDTO
} from '../../../shared/model/north-connector.model';
import NorthAmazonS3 from '../north/north-amazon-s3/north-amazon-s3';
import NorthFileWriter from '../north/north-file-writer/north-file-writer';
import NorthSFTP from '../north/north-sftp/north-sftp';
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
import { checkScanMode } from './utils';
import { ScanMode } from '../model/scan-mode.model';
import { SouthConnectorLightDTO } from '../../../shared/model/south-connector.model';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import { NorthSettings } from '../../../shared/model/north-settings.model';

const northList: Array<{ class: typeof NorthConnector<NorthSettings>; manifest: NorthConnectorManifest }> = [
  { class: NorthConsole, manifest: consoleManifest },
  { class: NorthOIAnalytics, manifest: oianalyticsManifest },
  { class: NorthAzureBlob, manifest: azureManifest },
  { class: NorthAmazonS3, manifest: amazonManifest },
  { class: NorthFileWriter, manifest: fileWriterManifest },
  { class: NorthSFTP, manifest: sftpManifest }
];

export default class NorthService {
  constructor(
    protected readonly validator: JoiValidator,
    private northConnectorRepository: NorthConnectorRepository,
    private southConnectorRepository: SouthConnectorRepository,
    private northMetricsRepository: NorthConnectorMetricsRepository,
    private scanModeRepository: ScanModeRepository,
    private logRepository: LogRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
    private readonly encryptionService: EncryptionService,
    private readonly repositoryService: RepositoryService
  ) {}

  runNorth<N extends NorthSettings>(
    settings: NorthConnectorEntity<N>,
    baseFolder: string,
    logger: pino.Logger
  ): NorthConnector<NorthSettings> {
    const NorthConnector = northList.find(connector => connector.class.type === settings.type);
    if (!NorthConnector) {
      throw Error(`North connector of type ${settings.type} not installed`);
    }

    return new NorthConnector.class(settings, this.encryptionService, this.repositoryService, logger, baseFolder);
  }

  async testNorth<N extends NorthSettings>(
    id: string,
    command: NorthConnectorCommandDTO<N>,
    manifest: NorthConnectorManifest,
    logger: pino.Logger
  ): Promise<void> {
    let northConnector: NorthConnectorEntity<N> | null = null;
    if (id !== 'create') {
      northConnector = this.northConnectorRepository.findNorthById(id);
      if (!northConnector) {
        throw new Error(`North connector ${id} not found`);
      }
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

    const NorthConnector = northList.find(connector => connector.class.type === testToRun.type);
    if (!NorthConnector) {
      throw Error(`South connector of type ${testToRun.type} not installed`);
    }
    const north = new NorthConnector.class(testToRun, this.encryptionService, this.repositoryService, logger, 'baseFolder');
    return await north.testConnection();
  }

  findById(northId: string): NorthConnectorEntity<NorthSettings> | null {
    return this.northConnectorRepository.findNorthById(northId);
  }

  findAll(): Array<NorthConnectorEntityLight> {
    return this.northConnectorRepository.findAllNorth();
  }

  getInstalledNorthManifests(): Array<NorthConnectorManifest> {
    return northList.map(element => element.manifest);
  }

  async createNorth<N extends NorthSettings>(command: NorthConnectorCommandDTO<N>): Promise<NorthConnectorEntity<N>> {
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
    if (!manifest) {
      throw new Error('North manifest does not exist');
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const northEntity = {} as NorthConnectorEntity<N>;
    await copyNorthConnectorCommandToNorthEntity<N>(
      northEntity,
      command,
      null,
      manifest,
      this.encryptionService,
      this.scanModeRepository.findAll(),
      this.southConnectorRepository.findAllSouth()
    );
    this.northConnectorRepository.saveNorthConnector(northEntity);

    //TODO
    // await this.oibusEngine.createNorth(northConnector);

    if (northEntity.enabled) {
      // TODO
      // await this.reloadService.oibusEngine.startNorth(created.id);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return northEntity;
  }

  async updateNorthWithoutSubscriptions(northConnectorId: string, command: NorthConnectorWithoutSubscriptionsCommandDTO) {
    const previousSettings = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!previousSettings) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
    if (!manifest) {
      throw new Error('North manifest does not exist');
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const northEntity = { id: previousSettings.id } as NorthConnectorEntity<NorthSettings>;
    await copyNorthConnectorCommandToNorthEntity(
      northEntity,
      { ...command, subscriptions: previousSettings.subscriptions.map(subscription => subscription.id) },
      previousSettings,
      manifest,
      this.encryptionService,
      this.scanModeRepository.findAll(),
      this.southConnectorRepository.findAllSouth()
    );
    this.northConnectorRepository.saveNorthConnector(northEntity);

    if (previousSettings.name !== northEntity.name) {
      // TODO: this.oibusEngine.setLogger(this.oibusEngine.logger);
    }
    if (northEntity.enabled) {
      this.northConnectorRepository.startNorth(northConnectorId);
      // TODO: await this.oibusEngine.reloadNorth(northConnectorId);
    } else {
      this.northConnectorRepository.stopNorth(northConnectorId);
      //TODO: await this.oibusEngine.stopNorth(northConnectorId);
    }

    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async updateNorth<N extends NorthSettings>(northConnectorId: string, command: NorthConnectorCommandDTO<N>) {
    const previousSettings = this.northConnectorRepository.findNorthById<N>(northConnectorId);
    if (!previousSettings) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
    const manifest = this.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
    if (!manifest) {
      throw new Error('North manifest does not exist');
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const northEntity = { id: previousSettings.id } as NorthConnectorEntity<N>;
    await copyNorthConnectorCommandToNorthEntity<N>(
      northEntity,
      command,
      previousSettings,
      manifest,
      this.encryptionService,
      this.scanModeRepository.findAll(),
      this.southConnectorRepository.findAllSouth()
    );
    this.northConnectorRepository.saveNorthConnector(northEntity);

    if (previousSettings.name !== northEntity.name) {
      // TODO: this.oibusEngine.setLogger(this.oibusEngine.logger);
    }
    if (northEntity.enabled) {
      this.northConnectorRepository.startNorth(northConnectorId);
      // TODO: await this.oibusEngine.reloadNorth(northConnectorId);
    } else {
      this.northConnectorRepository.stopNorth(northConnectorId);
      //TODO: await this.oibusEngine.stopNorth(northConnectorId);
    }

    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async deleteNorth(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
    // TODO: await this.oibusEngine.deleteNorth(id, name);
    this.northConnectorRepository.deleteNorth(northConnectorId);
    this.logRepository.deleteLogsByScopeId('north', northConnector.id);
    this.northMetricsRepository.removeMetrics(northConnector.id);

    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async startNorth(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }

    this.northConnectorRepository.startNorth(northConnectorId);
    // TODO: await this.oibusEngine.startNorth(northId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async stopNorth(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }

    // TODO: await this.oibusEngine.stopNorth(northId);
    this.northConnectorRepository.stopNorth(northConnectorId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }
}

export const toNorthConnectorDTO = <N extends NorthSettings>(
  entity: NorthConnectorEntity<N>,
  manifest: NorthConnectorManifest,
  encryptionService: EncryptionService
): NorthConnectorDTO<N> => {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    description: entity.description,
    enabled: entity.enabled,
    settings: encryptionService.filterSecrets<N>(entity.settings, manifest.settings),
    caching: {
      scanModeId: entity.caching.scanModeId,
      retryInterval: entity.caching.retryInterval,
      retryCount: entity.caching.retryCount,
      maxSize: entity.caching.retryCount,
      oibusTimeValues: {
        groupCount: entity.caching.oibusTimeValues.groupCount,
        maxSendCount: entity.caching.oibusTimeValues.maxSendCount
      },
      rawFiles: {
        sendFileImmediately: entity.caching.rawFiles.sendFileImmediately,
        archive: {
          enabled: entity.caching.rawFiles.archive.enabled,
          retentionDuration: entity.caching.rawFiles.archive.retentionDuration
        }
      }
    },
    subscriptions: entity.subscriptions
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
  manifest: NorthConnectorManifest,
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
    manifest.settings
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
