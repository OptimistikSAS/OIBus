import { getNetworkSettingsFromRegistration, getOIBusInfo } from '../utils';
import RepositoryService from '../repository.service';
import EncryptionService from '../encryption.service';
import pino from 'pino';
import { EventEmitter } from 'node:events';
import DeferredPromise from '../deferred-promise';
import { DateTime } from 'luxon';
import { EngineSettingsDTO, RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import fetch from 'node-fetch';
import {
  OIAnalyticsMessageCommand,
  OIAnalyticsMessageDTO,
  OIAnalyticsMessageFullConfigCommandDTO
} from '../../../../shared/model/oianalytics-message.model';
import {
  OIAnalyticsEngineSettingsDTO,
  OIAnalyticsIpFilterDTO,
  OIAnalyticsNorthConnectorDTO,
  OIAnalyticsScanModeDTO,
  OIAnalyticsSouthConnectorDTO,
  OIBusFullConfigDTO
} from '../../../../shared/model/command.model';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../shared/model/scan-mode.model';
import { IpFilterDTO } from '../../../../shared/model/ip-filter.model';

const STOP_TIMEOUT = 30_000;
const MESSAGE_TIMEOUT = 15_000;
const RETRY_TIMEOUT = 10_000;
const NEXT_TIMEOUT = 1_000;

export default class OIAnalyticsMessageService {
  private messagesQueue: Array<OIAnalyticsMessageDTO> = [];
  private registration: RegistrationSettingsDTO | null = null;
  private triggerRun: EventEmitter = new EventEmitter();
  private runProgress$: DeferredPromise | null = null;
  private stopTimeout: NodeJS.Timeout | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(
    private repositoryService: RepositoryService,
    private encryptionService: EncryptionService,
    private logger: pino.Logger
  ) {}

  start(): void {
    this.registration = this.repositoryService.registrationRepository.getRegistrationSettings()!;
    if (this.registration.status !== 'REGISTERED') {
      this.logger.debug(`Message service not started: OIAnalytics not registered`);
      return;
    }

    this.createFullConfigMessageIfNotPending();
    this.messagesQueue = this.repositoryService.oianalyticsMessageRepository.searchMessagesList({ status: ['PENDING'], types: [] });

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
    this.runProgress$ = new DeferredPromise();
    const [message] = this.messagesQueue;

    try {
      await this.sendMessage(message);
    } catch (error: any) {
      this.logger.error(
        `Error while sending message ${message.id} (created ${message.creationDate}) of type ${message.type}. ${error.toString()}`
      );
      this.repositoryService.oianalyticsMessageRepository.markAsErrored(message.id, DateTime.now().toUTC().toISO(), error.toString());
      this.removeMessageFromQueue(message.id);
    }

    this.runProgress$.resolve();
    this.runProgress$ = null;
  }

  /**
   * Removes messages from the queue.
   * @param messageId
   * @returns
   */
  removeMessageFromQueue(messageId: string): void {
    const idx = this.messagesQueue.findIndex(message => message.id === messageId);
    if (idx === -1) return;

    this.messagesQueue.splice(idx, 1);
  }

  /**
   * Add a message to the message queue and trigger the next run if no message is running
   * @param message - The message to add
   */
  addMessageToQueue(message: OIAnalyticsMessageDTO): void {
    this.messagesQueue.push(message);
    this.triggerRun.emit('next');
  }

  messageToCommandDTO(message: OIAnalyticsMessageDTO): OIAnalyticsMessageCommand {
    switch (message.type) {
      case 'INFO':
        return {
          type: 'INFO',
          version: message.content.version,
          oibusId: message.content.oibusId,
          dataDirectory: message.content.dataDirectory,
          binaryDirectory: message.content.binaryDirectory,
          processId: message.content.processId,
          hostname: message.content.hostname,
          operatingSystem: message.content.operatingSystem,
          architecture: message.content.architecture,
          platform: message.content.platform
        };

      case 'FULL_CONFIG':
        return {
          type: 'FULL_CONFIG',
          config: this.createFullConfig()
        };

      case 'ENGINE_CONFIG':
        return {
          type: 'ENGINE_CONFIG',
          name: message.content.name,
          port: message.content.port,
          proxyEnabled: message.content.proxyEnabled,
          proxyPort: message.content.proxyPort,
          logParameters: message.content.logParameters
        };
    }
  }

  private createFullConfig(): OIBusFullConfigDTO {
    const engine = this.repositoryService.engineRepository.getEngineSettings()!;
    const scanModes = this.repositoryService.scanModeRepository.getScanModes();
    const ipFilters = this.repositoryService.ipFilterRepository.getIpFilters();
    const northConnectors: Array<NorthConnectorDTO> = this.repositoryService.northConnectorRepository.getNorthConnectors();
    const southConnectors: Array<SouthConnectorDTO> = this.repositoryService.southConnectorRepository.getSouthConnectors();

    return {
      engine: this.toOIAnalyticsEngineDTO(engine),
      scanModes: scanModes.map(scanMode => this.toOIAnalyticsScanModeDTO(scanMode)),
      ipFilters: ipFilters.map(ipFilter => this.toOIAnalyticsIpFilterDTO(ipFilter)),
      northConnectors: northConnectors.map(north => this.toOIAnalyticsNorthConnectorDTO(north)),
      southConnectors: southConnectors.map(south => this.toOIAnalyticsSouthConnectorDTO(south))
    };
  }

  async sendMessage(message: OIAnalyticsMessageDTO): Promise<void> {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    const endpoint = `/api/oianalytics/oibus/message`;
    const registrationSettings = this.repositoryService.registrationRepository.getRegistrationSettings();
    const connectionSettings = await getNetworkSettingsFromRegistration(registrationSettings, endpoint, this.encryptionService);
    const url = `${connectionSettings.host}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(this.messageToCommandDTO(message)),
        headers: { ...connectionSettings.headers, 'Content-Type': 'application/json' },
        timeout: MESSAGE_TIMEOUT,
        agent: connectionSettings.agent
      });
      if (!response.ok) {
        if (response.status !== 401) {
          this.logger.error(
            `Error ${response.status} while sending message ${message.id} (created ${message.creationDate}) of type ${message.type} on ${url}: ${response.statusText}`
          );
          this.repositoryService.oianalyticsMessageRepository.markAsErrored(
            message.id,
            DateTime.now().toUTC().toISO(),
            response.statusText
          );
          this.removeMessageFromQueue(message.id);
        } else {
          this.logger.debug(
            `Error ${response.status} while sending message ${message.id} (created ${message.creationDate}) of type ${message.type} on ${url}: ${response.statusText}`
          );
          this.retryTimeout = setTimeout(() => {
            this.triggerRun.emit('next');
          }, RETRY_TIMEOUT);
        }
        return;
      }

      this.repositoryService.oianalyticsMessageRepository.markAsCompleted(message.id, DateTime.now().toUTC().toISO());
      this.logger.trace(`${message.id} (created ${message.creationDate}) of type ${message.type} sent`);
      this.removeMessageFromQueue(message.id);
      this.retryTimeout = setTimeout(() => {
        this.triggerRun.emit('next');
      }, NEXT_TIMEOUT);
    } catch (fetchError) {
      this.logger.debug(
        `Error while sending message ${message.id} (created ${message.creationDate}) of type ${message.type} on ${url}. ${fetchError}`
      );
      this.retryTimeout = setTimeout(() => {
        this.triggerRun.emit('next');
      }, RETRY_TIMEOUT);
    }
  }

  /**
   * Stop services and timer
   */
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
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.logger.debug(`OIAnalytics message service stopped`);
  }

  setLogger(logger: pino.Logger) {
    this.logger = logger;
  }

  /**
   * Create a FULL_CONFIG message if there is no pending message of this type. It will trigger at startup
   */
  private createFullConfigMessageIfNotPending() {
    if (
      this.repositoryService.oianalyticsMessageRepository.searchMessagesList({ status: ['PENDING'], types: ['FULL_CONFIG'] }).length > 0
    ) {
      return;
    }
    const message: OIAnalyticsMessageFullConfigCommandDTO = {
      type: 'FULL_CONFIG'
    };
    this.repositoryService.oianalyticsMessageRepository.createOIAnalyticsMessages(message);
  }

  private toOIAnalyticsEngineDTO(engine: EngineSettingsDTO): OIAnalyticsEngineSettingsDTO {
    const oibusInfo = getOIBusInfo(engine);
    return {
      oIBusInternalId: engine.id,
      name: engine.name,
      softwareVersion: oibusInfo.version,
      architecture: oibusInfo.architecture,
      operatingSystem: oibusInfo.operatingSystem,
      settings: {
        port: engine.port,
        proxyEnabled: engine.proxyEnabled,
        proxyPort: engine.proxyPort
      }
    };
  }

  private toOIAnalyticsScanModeDTO(scanMode: ScanModeDTO): OIAnalyticsScanModeDTO {
    return {
      oIBusInternalId: scanMode.id,
      name: scanMode.name,
      settings: {
        description: scanMode.description,
        cron: scanMode.cron
      }
    };
  }

  private toOIAnalyticsIpFilterDTO(ipFilter: IpFilterDTO): OIAnalyticsIpFilterDTO {
    return {
      oIBusInternalId: ipFilter.id,
      settings: {
        address: ipFilter.address,
        description: ipFilter.description
      }
    };
  }

  private toOIAnalyticsNorthConnectorDTO(north: NorthConnectorDTO): OIAnalyticsNorthConnectorDTO<any> {
    const subscriptions = this.repositoryService.subscriptionRepository.getNorthSubscriptions(north.id);
    return {
      oIBusInternalId: north.id,
      type: north.type,
      name: north.name,
      settings: {
        description: north.description,
        enabled: north.enabled,
        settings: north.settings,
        scanModeId: north.caching.scanModeId,
        retryInterval: north.caching.retryInterval,
        retryCount: north.caching.retryCount,
        maxSize: north.caching.maxSize,
        southSubscriptionIds: subscriptions
      }
    };
  }

  private toOIAnalyticsSouthConnectorDTO(south: SouthConnectorDTO): OIAnalyticsSouthConnectorDTO<any, any> {
    const items = this.repositoryService.southItemRepository.getSouthItems(south.id);
    return {
      oIBusInternalId: south.id,
      type: south.type,
      name: south.name,
      settings: {
        description: south.description,
        enabled: south.enabled,
        settings: south.settings,
        southItems: items.map(item => ({
          oIBusInternalId: item.id,
          name: item.name,
          settings: {
            scanModeId: item.scanModeId,
            enabled: item.enabled,
            settings: item.settings
          }
        }))
      }
    };
  }
}
