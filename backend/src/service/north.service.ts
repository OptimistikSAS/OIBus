import EncryptionService from './encryption.service';
import pino from 'pino';
import NorthConnector from '../north/north-connector';
import NorthConsole from '../north/north-console/north-console';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthConnectorWithoutSubscriptionsCommandDTO
} from '../../../shared/model/north-connector.model';
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
import { checkScanMode, createFolder } from './utils';
import { ScanMode } from '../model/scan-mode.model';
import { SouthConnectorLightDTO } from '../../../shared/model/south-connector.model';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import {
  NorthAmazonS3Settings,
  NorthAzureBlobSettings,
  NorthConsoleSettings,
  NorthFileWriterSettings,
  NorthOIAnalyticsSettings,
  NorthSettings,
  NorthSFTPSettings
} from '../../../shared/model/north-settings.model';
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
    baseFolder: string | undefined = undefined
  ): NorthConnector<NorthSettings> {
    const northBaseFolder = baseFolder ?? this.getDefaultBaseFolder(settings.id);

    switch (settings.type) {
      case 'aws-s3':
        return new NorthAmazonS3(
          settings as NorthConnectorEntity<NorthAmazonS3Settings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolder
        );
      case 'azure-blob':
        return new NorthAzureBlob(
          settings as NorthConnectorEntity<NorthAzureBlobSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolder
        );
      case 'console':
        return new NorthConsole(
          settings as NorthConnectorEntity<NorthConsoleSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolder
        );
      case 'file-writer':
        return new NorthFileWriter(
          settings as NorthConnectorEntity<NorthFileWriterSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolder
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
          northBaseFolder
        );
      case 'sftp':
        return new NorthSFTP(
          settings as NorthConnectorEntity<NorthSFTPSettings>,
          this.encryptionService,
          this.northConnectorRepository,
          this.scanModeRepository,
          logger,
          northBaseFolder
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

    const north = this.runNorth(testToRun, logger, 'baseFolder');
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
      throw new Error('North manifest does not exist');
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

    if (northEntity.id !== 'test') {
      await createFolder(this.getDefaultBaseFolder(northEntity.id));
    }

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
      this.encryptionService,
      this.scanModeRepository.findAll(),
      this.southConnectorRepository.findAllSouth()
    );
    this.northConnectorRepository.saveNorthConnector(northEntity);

    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    if (northEntity.enabled) {
      await this.dataStreamEngine.reloadNorth(northEntity);
    } else {
      await this.dataStreamEngine.stopNorth(northEntity.id);
    }
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
      this.encryptionService,
      this.scanModeRepository.findAll(),
      this.southConnectorRepository.findAllSouth()
    );
    this.northConnectorRepository.saveNorthConnector(northEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    if (northEntity.enabled) {
      await this.dataStreamEngine.reloadNorth(northEntity);
    } else {
      await this.dataStreamEngine.stopNorth(northEntity.id);
    }
  }

  async deleteNorth(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findNorthById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
    await this.dataStreamEngine.deleteNorth(northConnector);
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

  private getDefaultBaseFolder(northId: string) {
    return path.resolve(this.dataStreamEngine.baseFolder, `north-${northId}`);
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
