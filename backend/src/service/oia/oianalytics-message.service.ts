import { getOIBusInfo } from '../utils';
import pino from 'pino';
import { EventEmitter } from 'node:events';
import DeferredPromise from '../deferred-promise';
import { DateTime } from 'luxon';
import EncryptionService from '../encryption.service';
import { OIAnalyticsMessage } from '../../model/oianalytics-message.model';
import {
  OIAnalyticsCertificateCommandDTO,
  OIAnalyticsEngineCommandDTO,
  OIAnalyticsNorthCommandDTO,
  OIAnalyticsSouthCommandDTO,
  OIAnalyticsUserCommandDTO,
  OIBusFullConfigurationCommandDTO,
  OIBusIPFilterCommandDTO,
  OIBusScanModeCommandDTO
} from './oianalytics.model';
import EngineRepository from '../../repository/config/engine.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import OIAnalyticsMessageRepository from '../../repository/config/oianalytics-message.repository';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import { HistoryQueryEntity } from '../../model/histor-query.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { southManifestList } from '../south.service';
import { northManifestList } from '../north.service';
import IpFilterRepository from '../../repository/config/ip-filter.repository';
import CertificateRepository from '../../repository/config/certificate.repository';
import UserRepository from '../../repository/config/user.repository';
import OIAnalyticsClient from './oianalytics-client.service';

const STOP_TIMEOUT = 30_000;

export default class OIAnalyticsMessageService {
  private messagesQueue: Array<OIAnalyticsMessage> = [];
  private triggerRun: EventEmitter = new EventEmitter();
  private runProgress$: DeferredPromise | null = null;
  private stopTimeout: NodeJS.Timeout | null = null;

  constructor(
    private oIAnalyticsMessageRepository: OIAnalyticsMessageRepository,
    private oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private engineRepository: EngineRepository,
    private scanModeRepository: ScanModeRepository,
    private ipFilterRepository: IpFilterRepository,
    private certificateRepository: CertificateRepository,
    private userRepository: UserRepository,
    private southRepository: SouthConnectorRepository,
    private northRepository: NorthConnectorRepository,
    private oIAnalyticsClient: OIAnalyticsClient,
    private encryptionService: EncryptionService,
    private logger: pino.Logger
  ) {}

  start(): void {
    this.createFullConfigMessageIfNotPending();
    this.messagesQueue = this.oIAnalyticsMessageRepository.list({ status: ['PENDING'], types: [] });

    this.triggerRun.on('next', async () => {
      if (!this.runProgress$) {
        if (this.messagesQueue.length > 0) {
          await this.run();
        }
      }
    });
    this.triggerRun.emit('next');
  }

  async run(): Promise<void> {
    const registration = this.oIAnalyticsRegistrationRepository.get()!;
    if (registration.status !== 'REGISTERED') {
      this.logger.trace(`OIBus is not registered to OIAnalytics. Messages won't be sent`);
      return;
    }

    this.runProgress$ = new DeferredPromise();
    const [message] = this.messagesQueue;

    try {
      switch (message.type) {
        case 'full-config':
          await this.sendFullConfiguration(this.createFullConfigurationCommand());
          this.oIAnalyticsMessageRepository.markAsCompleted(message.id, DateTime.now().toUTC().toISO());
          break;
      }
    } catch (error: unknown) {
      this.logger.error(`Error while sending message ${message.id} of type ${message.type}. ${(error as Error).message}`);
      this.oIAnalyticsMessageRepository.markAsErrored(message.id, DateTime.now().toUTC().toISO(), (error as Error).message);
    }
    this.removeMessageFromQueue(message.id);

    this.runProgress$.resolve();
    this.runProgress$ = null;
  }

  async stop(): Promise<void> {
    this.logger.debug(`Stopping OIAnalytics message service...`);

    this.triggerRun.removeAllListeners();
    if (this.runProgress$) {
      if (!this.stopTimeout) {
        this.stopTimeout = setTimeout(() => {
          this.runProgress$!.resolve();
        }, STOP_TIMEOUT);
      }
      this.logger.debug('Waiting for OIAnalytics message to finish');
      await this.runProgress$.promise;
      clearTimeout(this.stopTimeout);
    }
    this.logger.debug(`OIAnalytics message service stopped`);
  }

  setLogger(logger: pino.Logger) {
    this.logger = logger;
  }

  createHistoryQueryMessage(_historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>) {
    // TODO: implement history query message for settings
  }

  /**
   * Create a FULL_CONFIG message if there is no pending message of this type. It will trigger at startup
   */
  createFullConfigMessageIfNotPending() {
    const registration = this.oIAnalyticsRegistrationRepository.get()!;
    if (registration.status !== 'REGISTERED') {
      this.logger.debug(`OIBus is not registered to OIAnalytics. Messages won't be created`);
      return;
    }

    if (
      this.oIAnalyticsMessageRepository.list({
        status: ['PENDING'],
        types: ['full-config']
      }).length > 0
    ) {
      return;
    }
    const message = this.oIAnalyticsMessageRepository.create({ type: 'full-config' });
    this.addMessageToQueue(message);
    this.triggerRun.emit('next');
  }

  private removeMessageFromQueue(messageId: string): void {
    this.messagesQueue = this.messagesQueue.filter(message => message.id === messageId);
  }

  /**
   * Add a message to the message queue and trigger the next run if no message is running
   * @param message - The message to add
   */
  private addMessageToQueue(message: OIAnalyticsMessage): void {
    this.messagesQueue.push(message);
    this.triggerRun.emit('next');
  }

  private async sendFullConfiguration(configuration: OIBusFullConfigurationCommandDTO): Promise<void> {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    await this.oIAnalyticsClient.sendConfiguration(registrationSettings, JSON.stringify(configuration));
    this.logger.debug('Full OIBus configuration sent to OIAnalytics');
  }

  //
  // Class utility method to generate each OIAnalytics message DTO
  //
  private createFullConfigurationCommand(): OIBusFullConfigurationCommandDTO {
    return {
      engine: this.createEngineCommand(),
      scanModes: this.createScanModesCommand(),
      ipFilters: this.createIPFiltersCommand(),
      certificates: this.createCertificatesCommand(),
      southConnectors: this.createSouthConnectorsCommand(),
      northConnectors: this.createNorthConnectorsCommand(),
      users: this.createUsersCommand()
    };
  }

  private createEngineCommand(): OIAnalyticsEngineCommandDTO {
    const engine = this.engineRepository.get()!;
    const info = getOIBusInfo(engine);
    return {
      oIBusInternalId: engine.id,
      softwareVersion: engine.version,
      architecture: info.architecture,
      operatingSystem: info.operatingSystem,
      name: engine.name,
      port: engine.port,
      proxyEnabled: engine.proxyEnabled,
      proxyPort: engine.proxyPort,
      logParameters: {
        console: {
          level: engine.logParameters.console.level
        },
        file: {
          level: engine.logParameters.file.level,
          maxFileSize: engine.logParameters.file.maxFileSize,
          numberOfFiles: engine.logParameters.file.numberOfFiles
        },
        database: {
          level: engine.logParameters.database.level,
          maxNumberOfLogs: engine.logParameters.database.maxNumberOfLogs
        },
        loki: {
          level: engine.logParameters.loki.level,
          interval: engine.logParameters.loki.interval,
          address: engine.logParameters.loki.address,
          username: engine.logParameters.loki.username,
          password: ''
        },
        oia: {
          level: engine.logParameters.oia.level,
          interval: engine.logParameters.oia.interval
        }
      }
    };
  }

  private createScanModesCommand(): Array<OIBusScanModeCommandDTO> {
    const scanModes = this.scanModeRepository.findAll();
    return scanModes.map(scanMode => ({
      oIBusInternalId: scanMode.id,
      name: scanMode.name,
      description: scanMode.description,
      cron: scanMode.cron
    }));
  }

  private createIPFiltersCommand(): Array<OIBusIPFilterCommandDTO> {
    const ipFilters = this.ipFilterRepository.findAll();
    return ipFilters.map(ipFilter => ({
      oIBusInternalId: ipFilter.id,
      description: ipFilter.description,
      address: ipFilter.address
    }));
  }

  private createCertificatesCommand(): Array<OIAnalyticsCertificateCommandDTO> {
    const certificates = this.certificateRepository.findAll();
    return certificates.map(certificate => ({
      oIBusInternalId: certificate.id,
      name: certificate.name,
      description: certificate.description,
      publicKey: certificate.publicKey,
      certificate: certificate.certificate,
      expiry: certificate.expiry
    }));
  }

  private createUsersCommand(): Array<OIAnalyticsUserCommandDTO> {
    const users = this.userRepository.findAll();
    return users.map(user => ({
      oIBusInternalId: user.id,
      login: user.login,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      language: user.language,
      timezone: user.timezone
    }));
  }

  private createSouthConnectorsCommand(): Array<OIAnalyticsSouthCommandDTO> {
    const souths = this.southRepository.findAllSouth();
    return souths.map(southLight => {
      const south = this.southRepository.findSouthById(southLight.id)!;
      const manifest = southManifestList.find(manifest => manifest.id === south.type)!;
      return {
        oIBusInternalId: south.id,
        type: south.type,
        name: south.name,
        description: south.description,
        enabled: south.enabled,
        settings: this.encryptionService.filterSecrets(south.settings, manifest.settings),
        history: south.history,
        items: south.items.map(item => ({
          id: item.id,
          name: item.name,
          enabled: item.enabled,
          scanModeId: item.scanModeId,
          scanModeName: null,
          settings: this.encryptionService.filterSecrets(item.settings, manifest.items.settings)
        }))
      };
    });
  }

  private createNorthConnectorsCommand(): Array<OIAnalyticsNorthCommandDTO> {
    const norths = this.northRepository.findAllNorth();
    return norths.map(northLight => {
      const north = this.northRepository.findNorthById(northLight.id)!;
      const manifest = northManifestList.find(manifest => manifest.id === north.type)!;
      return {
        oIBusInternalId: north.id,
        type: north.type,
        name: north.name,
        description: north.description,
        enabled: north.enabled,
        settings: this.encryptionService.filterSecrets(north.settings, manifest.settings),
        caching: {
          scanModeId: north.caching.scanModeId,
          scanModeName: null,
          retryInterval: north.caching.retryInterval,
          retryCount: north.caching.retryCount,
          maxSize: north.caching.maxSize,
          oibusTimeValues: {
            groupCount: north.caching.oibusTimeValues.groupCount,
            maxSendCount: north.caching.oibusTimeValues.maxSendCount
          },
          rawFiles: {
            sendFileImmediately: north.caching.rawFiles.sendFileImmediately,
            archive: {
              enabled: north.caching.rawFiles.archive.enabled,
              retentionDuration: north.caching.rawFiles.archive.retentionDuration
            }
          }
        },
        subscriptions: north.subscriptions.map(south => south.id)
      };
    });
  }
}
