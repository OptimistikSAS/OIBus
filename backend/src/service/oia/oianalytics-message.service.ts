import { getNetworkSettingsFromRegistration, getOIBusInfo } from '../utils';
import pino from 'pino';
import { EventEmitter } from 'node:events';
import DeferredPromise from '../deferred-promise';
import { DateTime } from 'luxon';

import fetch from 'node-fetch';
import EncryptionService from '../encryption.service';
import { OIAnalyticsMessage } from '../../model/oianalytics-message.model';
import {
  OIBusEngineCommandDTO,
  OIBusFullConfigurationCommandDTO,
  OIBusNorthCommandDTO,
  OIBusScanModeCommandDTO,
  OIBusSouthCommandDTO
} from './oianalytics.model';
import EngineRepository from '../../repository/config/engine.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import OIAnalyticsMessageRepository from '../../repository/config/oianalytics-message.repository';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import CryptoRepository from '../../repository/crypto/crypto.repository';
import { HistoryQueryEntity } from '../../model/histor-query.model';
import { SouthItemSettings, SouthSettings } from '../../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../../shared/model/north-settings.model';

const STOP_TIMEOUT = 30_000;
const MESSAGE_TIMEOUT = 15_000;

export default class OIAnalyticsMessageService {
  private messagesQueue: Array<OIAnalyticsMessage> = [];
  private triggerRun: EventEmitter = new EventEmitter();
  private runProgress$: DeferredPromise | null = null;
  private stopTimeout: NodeJS.Timeout | null = null;

  constructor(
    private oIAnalyticsMessageRepository: OIAnalyticsMessageRepository,
    private oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private engineRepository: EngineRepository,
    private cryptoRepository: CryptoRepository,
    private scanModeRepository: ScanModeRepository,
    private southRepository: SouthConnectorRepository,
    private northRepository: NorthConnectorRepository,
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
      // TODO: check error type
      this.logger.error(`Error while sending message ${message.id} of type ${message.type}. Error: ${(error as Error).message}`);
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
    // TODO
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
    const endpoint = '/api/oianalytics/oibus/configuration';
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    const connectionSettings = await getNetworkSettingsFromRegistration(registrationSettings, endpoint, this.encryptionService);
    const url = `${connectionSettings.host}${endpoint}`;

    const response = await fetch(url, {
      method: 'PUT',
      body: JSON.stringify(configuration),
      headers: { ...connectionSettings.headers, 'Content-Type': 'application/json' },
      timeout: MESSAGE_TIMEOUT,
      agent: connectionSettings.agent
    });

    if (response.ok) {
      this.logger.debug('Full OIBus configuration sent to OIAnalytics');
      return;
    } else {
      throw new Error(response.statusText);
    }
  }

  //
  // Class utility method to generate each OIAnalytics message DTO
  //
  private createFullConfigurationCommand(): OIBusFullConfigurationCommandDTO {
    const engineCommand = this.createEngineCommand();
    const cryptoSettings = this.cryptoRepository.getCryptoSettings(engineCommand.oIBusInternalId!)!;
    return {
      engine: engineCommand,
      cryptoSettings: {
        algorithm: cryptoSettings.algorithm,
        secretKey: cryptoSettings.securityKey,
        initVector: cryptoSettings.initVector
      },
      scanModes: this.createScanModesCommand(),
      southConnectors: this.createSouthConnectorsCommand(),
      northConnectors: this.createNorthConnectorsCommand()
    };
  }

  private createEngineCommand(): OIBusEngineCommandDTO {
    const engine = this.engineRepository.get()!;
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
    const scanModes = this.scanModeRepository.findAll();
    return scanModes.map(scanMode => ({
      oIBusInternalId: scanMode.id,
      name: scanMode.name,
      settings: scanMode
    }));
  }

  private createSouthConnectorsCommand(): Array<OIBusSouthCommandDTO> {
    const souths = this.southRepository.findAllSouth();
    return souths.map(southLight => {
      const south = this.southRepository.findSouthById(southLight.id)!;
      return {
        oIBusInternalId: south.id,
        name: south.name,
        type: south.type,
        settings: south.settings // TODO: filter secrets
      };
    });
  }

  private createNorthConnectorsCommand(): Array<OIBusNorthCommandDTO> {
    const norths = this.northRepository.findAllNorth();
    return norths.map(northLight => {
      const north = this.northRepository.findNorthById(northLight.id)!;

      return {
        oIBusInternalId: north.id,
        name: north.name,
        type: north.type,
        settings: north.settings // TODO: filter secrets
      };
    });
  }
}
