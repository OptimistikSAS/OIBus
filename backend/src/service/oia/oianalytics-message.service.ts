import { getOIBusInfo } from '../utils';
import RepositoryService from '../repository.service';
import pino from 'pino';
import { EventEmitter } from 'node:events';
import DeferredPromise from '../deferred-promise';
import { DateTime } from 'luxon';
import { RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import { OIAnalyticsMessage, OIAnalyticsMessageFullConfigCommandDTO } from '../../../../shared/model/oianalytics-message.model';
import OIAnalyticsConfigurationClient from './oianalytics-configuration.client';
import {
  OIBusEngineCommandDTO,
  OIBusFullConfigurationCommandDTO,
  OIBusScanModeCommandDTO,
  OIBusSouthCommandDTO
} from './oianalytics-configuration.model';

const STOP_TIMEOUT = 30_000;

export default class OIAnalyticsMessageService {
  private messagesQueue: Array<OIAnalyticsMessage> = [];
  private registration: RegistrationSettingsDTO | null = null;
  private triggerRun: EventEmitter = new EventEmitter();
  private runProgress$: DeferredPromise | null = null;
  private stopTimeout: NodeJS.Timeout | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(
    private repositoryService: RepositoryService,
    private configurationClient: OIAnalyticsConfigurationClient,
    private logger: pino.Logger
  ) {}

  start(): void {
    this.registration = this.repositoryService.oianalyticsRegistrationRepository.get()!;
    if (this.registration.status !== 'REGISTERED') {
      this.logger.debug(`Message service not started: OIAnalytics not registered`);
      return;
    }

    this.createFullConfigMessageIfNotPending();
    this.messagesQueue = this.repositoryService.oianalyticsMessageRepository.list({ status: ['PENDING'], types: [] });

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
  addMessageToQueue(message: OIAnalyticsMessage): void {
    this.messagesQueue.push(message);
    this.triggerRun.emit('next');
  }

  async sendMessage(message: OIAnalyticsMessage): Promise<void> {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    switch (message.type) {
      case 'full-config':
        try {
          await this.configurationClient.sendFullConfiguration(this.createFullConfigurationCommand());
          this.repositoryService.oianalyticsMessageRepository.markAsCompleted(message.id, DateTime.now().toUTC().toISO());
          this.removeMessageFromQueue(message.id);
        } catch (error: any) {
          this.repositoryService.oianalyticsMessageRepository.markAsErrored(message.id, DateTime.now().toUTC().toISO(), error.message);
          this.removeMessageFromQueue(message.id);
        }
        break;
      case 'info':
        this.repositoryService.oianalyticsMessageRepository.markAsCompleted(message.id, DateTime.now().toUTC().toISO());
        this.removeMessageFromQueue(message.id);
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

  createFullConfigMessage() {
    const message = this.repositoryService.oianalyticsMessageRepository.create({ type: 'full-config' });
    this.addMessageToQueue(message);
    this.triggerRun.emit('next');
  }

  /**
   * Create a FULL_CONFIG message if there is no pending message of this type. It will trigger at startup
   */
  private createFullConfigMessageIfNotPending() {
    if (
      this.repositoryService.oianalyticsMessageRepository.list({
        status: ['PENDING'],
        types: ['full-config']
      }).length > 0
    ) {
      return;
    }
    const message: OIAnalyticsMessageFullConfigCommandDTO = {
      type: 'full-config'
    };
    this.repositoryService.oianalyticsMessageRepository.create(message);
  }

  private createFullConfigurationCommand(): OIBusFullConfigurationCommandDTO {
    const engineCommand = this.createEngineCommand();
    const cryptoSettings = engineCommand
      ? this.repositoryService.cryptoRepository.getCryptoSettings(engineCommand.oIBusInternalId!) || null
      : null;
    return {
      engine: this.createEngineCommand(),
      cryptoSettings: cryptoSettings
        ? {
            algorithm: cryptoSettings.algorithm,
            secretKey: cryptoSettings.securityKey,
            initVector: cryptoSettings.initVector
          }
        : null,
      scanModes: this.createScanModesCommand(),
      southConnectors: this.createSouthConnectorsCommand(),
      northConnectors: this.createNorthConnectorsCommand()
    };
  }

  private createEngineCommand(): OIBusEngineCommandDTO | null {
    const engine = this.repositoryService.engineRepository.get();
    if (!engine) {
      return null;
    }
    const info = getOIBusInfo(engine);
    return {
      oIBusInternalId: engine.id,
      name: engine.name,
      softwareVersion: engine.version,
      architecture: info.architecture,
      operatingSystem: info.operatingSystem,
      settings: engine
    };
  }

  private createScanModesCommand(): Array<OIBusScanModeCommandDTO> {
    const scanModes = this.repositoryService.scanModeRepository.findAll();
    return scanModes.map(scanMode => ({
      oIBusInternalId: scanMode.id,
      name: scanMode.name,
      settings: scanMode
    }));
  }

  private createSouthConnectorsCommand(): Array<OIBusSouthCommandDTO> {
    const souths = this.repositoryService.southConnectorRepository.findAll();

    return souths.map(south => {
      const items = this.repositoryService.southItemRepository.findAllForSouthConnector(south.id);
      return {
        oIBusInternalId: south.id,
        name: south.name,
        type: south.type,
        settings: { ...south, items }
      };
    });
  }

  private createNorthConnectorsCommand(): Array<OIBusSouthCommandDTO> {
    const norths = this.repositoryService.northConnectorRepository.findAll();
    return norths.map(north => ({
      oIBusInternalId: north.id,
      name: north.name,
      type: north.type,
      settings: north
    }));
  }
}
