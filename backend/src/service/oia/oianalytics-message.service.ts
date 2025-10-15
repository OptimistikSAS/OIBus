import { getOIBusInfo } from '../utils';
import pino from 'pino';
import { EventEmitter } from 'node:events';
import DeferredPromise from '../deferred-promise';
import { DateTime } from 'luxon';
import { encryptionService } from '../encryption.service';
import { OIAnalyticsMessage } from '../../model/oianalytics-message.model';
import {
  OIAnalyticsCertificateCommandDTO,
  OIAnalyticsEngineCommandDTO,
  OIAnalyticsIPFilterCommandDTO,
  OIAnalyticsNorthCommandDTO,
  OIAnalyticsRegistrationCommandDTO,
  OIAnalyticsScanModeCommandDTO,
  OIAnalyticsSouthCommandDTO,
  OIAnalyticsTransformerCommandDTO,
  OIAnalyticsUserCommandDTO,
  OIBusFullConfigurationCommandDTO,
  OIBusHistoryQueriesCommandDTO
} from './oianalytics.model';
import EngineRepository from '../../repository/config/engine.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import OIAnalyticsMessageRepository from '../../repository/config/oianalytics-message.repository';
import { southManifestList } from '../south.service';
import { northManifestList } from '../north.service';
import IpFilterRepository from '../../repository/config/ip-filter.repository';
import CertificateRepository from '../../repository/config/certificate.repository';
import UserRepository from '../../repository/config/user.repository';
import OIAnalyticsClient from './oianalytics-client.service';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import OIAnalyticsRegistrationService from './oianalytics-registration.service';
import HistoryQueryRepository from '../../repository/config/history-query.repository';
import TransformerRepository from '../../repository/config/transformer.repository';
import { getStandardManifest } from '../transformer.service';
import { OIBusObjectAttribute } from '../../../shared/model/form.model';

const STOP_TIMEOUT = 30_000;

export default class OIAnalyticsMessageService {
  private messagesQueue: Array<OIAnalyticsMessage> = [];
  private triggerRun: EventEmitter = new EventEmitter();
  private runProgress$: DeferredPromise | null = null;
  private stopTimeout: NodeJS.Timeout | null = null;
  private retryMessageInterval: NodeJS.Timeout | null = null;

  constructor(
    private oIAnalyticsMessageRepository: OIAnalyticsMessageRepository,
    private oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
    private engineRepository: EngineRepository,
    private scanModeRepository: ScanModeRepository,
    private ipFilterRepository: IpFilterRepository,
    private certificateRepository: CertificateRepository,
    private userRepository: UserRepository,
    private southRepository: SouthConnectorRepository,
    private northRepository: NorthConnectorRepository,
    private historyQueryRepository: HistoryQueryRepository,
    private transformerRepository: TransformerRepository,
    private oIAnalyticsClient: OIAnalyticsClient,
    private logger: pino.Logger
  ) {}

  start(): void {
    this.oIAnalyticsRegistrationService.registrationEvent.on('updated', () => {
      this.createFullConfigMessageIfNotPending();
      this.createFullHistoryQueriesMessageIfNotPending();
      this.messagesQueue = this.oIAnalyticsMessageRepository.list({ status: ['PENDING'], types: [] });
      this.triggerRun.emit('next'); // trigger next if messages are already pending and not trigger by the creation function
    });

    this.createFullConfigMessageIfNotPending();
    this.createFullHistoryQueriesMessageIfNotPending();
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
    if (this.retryMessageInterval) {
      clearTimeout(this.retryMessageInterval);
      this.retryMessageInterval = null;
    }

    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
    if (registration.status !== 'REGISTERED') {
      this.logger.trace(`OIBus is not registered to OIAnalytics. Messages won't be sent`);
      return;
    }

    this.runProgress$ = new DeferredPromise();
    const [message] = this.messagesQueue;

    try {
      switch (message.type) {
        case 'full-config':
          await this.sendFullConfiguration(this.createFullConfigurationCommand(registration));
          break;
        case 'history-queries':
          await this.sendHistoryQueriesMessage(this.createSendHistoryQueriesCommand());
          break;
      }
      this.oIAnalyticsMessageRepository.markAsCompleted(message.id, DateTime.now().toUTC().toISO());
      this.removeMessageFromQueue(message.id);
    } catch (error: unknown) {
      if ((error as Error).message.includes('Bad Request')) {
        this.logger.error(`Error while sending message ${message.id} of type ${message.type}: ${(error as Error).message}`);
        this.oIAnalyticsMessageRepository.markAsErrored(message.id, DateTime.now().toUTC().toISO(), (error as Error).message);
        this.removeMessageFromQueue(message.id);
      } else {
        this.logger.error(`Retrying message ${message.id} of type ${message.type} after error: ${(error as Error).message}`);
        this.retryMessageInterval = setTimeout(this.run.bind(this), registration.messageRetryInterval * 1000);
      }
    }
    this.resolveDeferredPromise();
    if (this.messagesQueue.length > 0 && !this.retryMessageInterval) {
      this.triggerRun.emit('next');
    }
  }

  async stop(): Promise<void> {
    this.logger.debug(`Stopping OIAnalytics message service...`);

    this.triggerRun.removeAllListeners();
    if (this.runProgress$) {
      if (!this.stopTimeout) {
        this.stopTimeout = setTimeout(() => {
          this.resolveDeferredPromise();
        }, STOP_TIMEOUT);
      }
      this.logger.debug('Waiting for OIAnalytics message to finish');
      await this.runProgress$.promise;
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    if (this.retryMessageInterval) {
      clearTimeout(this.retryMessageInterval);
      this.retryMessageInterval = null;
    }

    this.logger.debug(`OIAnalytics message service stopped`);
  }

  resolveDeferredPromise(): void {
    if (this.runProgress$) {
      this.runProgress$.resolve();
      this.runProgress$ = null;
    }
  }

  setLogger(logger: pino.Logger) {
    this.logger = logger;
  }

  /**
   * Create a full-config message if there is no pending message of this type. It will trigger at startup
   */
  createFullConfigMessageIfNotPending() {
    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
    if (registration.status !== 'REGISTERED') {
      this.logger.debug(`OIBus is not registered to OIAnalytics. Full config message won't be created`);
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
  }

  /**
   * Create a send-history-queries message if there is no pending message of this type. It will trigger at startup
   */
  createFullHistoryQueriesMessageIfNotPending() {
    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
    if (registration.status !== 'REGISTERED') {
      this.logger.debug(`OIBus is not registered to OIAnalytics. History query message won't be created`);
      return;
    }

    if (
      this.oIAnalyticsMessageRepository.list({
        status: ['PENDING'],
        types: ['history-queries']
      }).length > 0
    ) {
      return;
    }
    const message = this.oIAnalyticsMessageRepository.create({ type: 'history-queries' });
    this.addMessageToQueue(message);
  }

  private removeMessageFromQueue(messageId: string): void {
    this.messagesQueue = this.messagesQueue.filter(message => message.id !== messageId);
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
    const registrationSettings = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
    await this.oIAnalyticsClient.sendConfiguration(registrationSettings, JSON.stringify(configuration));
    this.logger.debug('Full OIBus configuration sent to OIAnalytics');
  }

  private async sendHistoryQueriesMessage(list: OIBusHistoryQueriesCommandDTO): Promise<void> {
    const registrationSettings = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
    await this.oIAnalyticsClient.sendHistoryQuery(registrationSettings, JSON.stringify(list));
    this.logger.debug(`${list.historyQueries.length} history queries sent to OIAnalytics`);
  }

  //
  // Class utility method to generate each OIAnalytics message DTO
  //
  private createFullConfigurationCommand(registration: OIAnalyticsRegistration): OIBusFullConfigurationCommandDTO {
    return {
      engine: this.createEngineCommand(),
      registration: this.createRegistrationCommand(registration),
      scanModes: this.createScanModesCommand(),
      ipFilters: this.createIPFiltersCommand(),
      certificates: this.createCertificatesCommand(),
      southConnectors: this.createSouthConnectorsCommand(),
      northConnectors: this.createNorthConnectorsCommand(),
      users: this.createUsersCommand(),
      transformers: this.createTransformersCommand()
    };
  }

  private createSendHistoryQueriesCommand(): OIBusHistoryQueriesCommandDTO {
    const historyQueries = this.historyQueryRepository.findAllHistoryQueriesFull();
    return {
      historyQueries: historyQueries.map(historyQuery => {
        const southManifest = southManifestList.find(manifest => manifest.id === historyQuery.southType)!;
        const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
          attribute => attribute.key === 'settings'
        )! as OIBusObjectAttribute;
        const northManifest = northManifestList.find(manifest => manifest.id === historyQuery.northType)!;
        return {
          oIBusInternalId: historyQuery.id,
          settings: {
            name: historyQuery.name,
            description: historyQuery.description,
            status: historyQuery.status,
            startTime: historyQuery.startTime,
            endTime: historyQuery.endTime,
            southType: historyQuery.southType,
            northType: historyQuery.northType,
            northSettings: encryptionService.filterSecrets(historyQuery.northSettings, northManifest.settings),
            southSettings: encryptionService.filterSecrets(historyQuery.southSettings, southManifest.settings),
            caching: {
              trigger: {
                scanModeId: historyQuery.caching.trigger.scanMode.id,
                scanModeName: null,
                numberOfElements: historyQuery.caching.trigger.numberOfElements,
                numberOfFiles: historyQuery.caching.trigger.numberOfFiles
              },
              throttling: {
                runMinDelay: historyQuery.caching.throttling.runMinDelay,
                maxSize: historyQuery.caching.throttling.maxSize,
                maxNumberOfElements: historyQuery.caching.throttling.maxNumberOfElements
              },
              error: {
                retryInterval: historyQuery.caching.error.retryInterval,
                retryCount: historyQuery.caching.error.retryCount,
                retentionDuration: historyQuery.caching.error.retentionDuration
              },
              archive: {
                enabled: historyQuery.caching.archive.enabled,
                retentionDuration: historyQuery.caching.archive.retentionDuration
              }
            },
            items: historyQuery.items.map(item => ({
              id: item.id,
              name: item.name,
              enabled: item.enabled,
              settings: encryptionService.filterSecrets(item.settings, itemSettingsManifest)
            })),
            northTransformers: historyQuery.northTransformers.map(transformerWithOptions => ({
              transformerId: transformerWithOptions.transformer.id,
              options: transformerWithOptions.options,
              inputType: transformerWithOptions.inputType
            }))
          }
        };
      })
    };
  }

  private createEngineCommand(): OIAnalyticsEngineCommandDTO {
    const engine = this.engineRepository.get()!;
    const info = getOIBusInfo(engine);
    return {
      oIBusInternalId: engine.id,
      name: engine.name,
      softwareVersion: engine.version,
      launcherVersion: engine.launcherVersion,
      architecture: info.architecture,
      operatingSystem: info.operatingSystem,
      settings: {
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
      }
    };
  }

  private createRegistrationCommand(registration: OIAnalyticsRegistration): OIAnalyticsRegistrationCommandDTO {
    return {
      publicKey: registration.publicCipherKey || '',
      settings: {
        commandRefreshInterval: registration.commandRefreshInterval,
        commandRetryInterval: registration.commandRetryInterval,
        messageRetryInterval: registration.messageRetryInterval,
        commandPermissions: registration.commandPermissions
      }
    };
  }

  private createScanModesCommand(): Array<OIAnalyticsScanModeCommandDTO> {
    const scanModes = this.scanModeRepository.findAll();
    return scanModes.map(scanMode => ({
      oIBusInternalId: scanMode.id,
      settings: {
        name: scanMode.name,
        description: scanMode.description,
        cron: scanMode.cron
      }
    }));
  }

  private createIPFiltersCommand(): Array<OIAnalyticsIPFilterCommandDTO> {
    const ipFilters = this.ipFilterRepository.findAll();
    return ipFilters.map(ipFilter => ({
      oIBusInternalId: ipFilter.id,
      settings: {
        description: ipFilter.description,
        address: ipFilter.address
      }
    }));
  }

  private createCertificatesCommand(): Array<OIAnalyticsCertificateCommandDTO> {
    const certificates = this.certificateRepository.findAll();
    return certificates.map(certificate => ({
      oIBusInternalId: certificate.id,
      settings: {
        name: certificate.name,
        description: certificate.description,
        publicKey: certificate.publicKey,
        certificate: certificate.certificate,
        expiry: certificate.expiry
      }
    }));
  }

  private createUsersCommand(): Array<OIAnalyticsUserCommandDTO> {
    const users = this.userRepository.findAll();
    return users.map(user => ({
      oIBusInternalId: user.id,
      settings: {
        login: user.login,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        language: user.language,
        timezone: user.timezone
      }
    }));
  }

  private createSouthConnectorsCommand(): Array<OIAnalyticsSouthCommandDTO> {
    const souths = this.southRepository.findAllSouth();
    return souths.map(southLight => {
      const south = this.southRepository.findSouthById(southLight.id)!;
      const manifest = southManifestList.find(manifest => manifest.id === south.type)!;
      const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
        attribute => attribute.key === 'settings'
      )! as OIBusObjectAttribute;
      return {
        oIBusInternalId: south.id,
        type: south.type,
        settings: {
          type: south.type,
          name: south.name,
          description: south.description,
          enabled: south.enabled,
          settings: encryptionService.filterSecrets(south.settings, manifest.settings),
          items: south.items.map(item => ({
            id: item.id,
            name: item.name,
            enabled: item.enabled,
            scanModeId: item.scanMode.id,
            scanModeName: null,
            settings: encryptionService.filterSecrets(item.settings, itemSettingsManifest)
          }))
        }
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
        settings: {
          type: north.type,
          name: north.name,
          description: north.description,
          enabled: north.enabled,
          settings: encryptionService.filterSecrets(north.settings, manifest.settings),
          caching: {
            trigger: {
              scanModeId: north.caching.trigger.scanMode.id,
              scanModeName: null,
              numberOfElements: north.caching.trigger.numberOfElements,
              numberOfFiles: north.caching.trigger.numberOfFiles
            },
            throttling: {
              runMinDelay: north.caching.throttling.runMinDelay,
              maxSize: north.caching.throttling.maxSize,
              maxNumberOfElements: north.caching.throttling.maxNumberOfElements
            },
            error: {
              retryInterval: north.caching.error.retryInterval,
              retryCount: north.caching.error.retryCount,
              retentionDuration: north.caching.error.retentionDuration
            },
            archive: {
              enabled: north.caching.archive.enabled,
              retentionDuration: north.caching.archive.retentionDuration
            }
          },
          subscriptions: north.subscriptions.map(south => south.id),
          transformers: north.transformers.map(transformerWithOptions => ({
            transformerId: transformerWithOptions.transformer.id,
            options: transformerWithOptions.options,
            inputType: transformerWithOptions.inputType
          }))
        }
      };
    });
  }

  private createTransformersCommand(): Array<OIAnalyticsTransformerCommandDTO> {
    const transformers = this.transformerRepository.findAll();
    return transformers.map(transformer => {
      if (transformer.type === 'standard') {
        return {
          oIBusInternalId: transformer.id,
          type: transformer.type,
          settings: {
            functionName: transformer.functionName,
            inputType: transformer.inputType,
            outputType: transformer.outputType
          },
          manifest: getStandardManifest(transformer.functionName)
        };
      } else {
        return {
          oIBusInternalId: transformer.id,
          type: transformer.type,
          settings: {
            name: transformer.name,
            description: transformer.description,
            inputType: transformer.inputType,
            outputType: transformer.outputType,
            customCode: transformer.customCode
          },
          manifest: transformer.customManifest
        };
      }
    });
  }
}
