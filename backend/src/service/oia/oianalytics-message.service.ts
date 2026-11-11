import { EventEmitter } from 'node:events';

import { DateTime } from 'luxon';

import { OIBusFullConfigurationCommandDTO, OIBusHistoryQueriesCommandDTO } from '../../../shared/model/oia/oianalytics-configuration.model';

import { OIAnalyticsMessage } from '../../model/oianalytics-message.model';
import OIAnalyticsMessageRepository from '../../repository/config/oianalytics-message.repository';
import ConfigTransferBuilderService from '../config-transfer/config-transfer-builder.service';
import DeferredPromise from '../deferred-promise';
import { loggerService } from '../logger/logger.service';
import { getErrorMessage } from '../utils';
import OIAnalyticsClient from './oianalytics-client.service';
import OIAnalyticsRegistrationService from './oianalytics-registration.service';

const STOP_TIMEOUT = 30_000;

export default class OIAnalyticsMessageService {
  private messagesQueue: Array<OIAnalyticsMessage> = [];
  private triggerRun: EventEmitter = new EventEmitter();
  protected runProgress$: DeferredPromise | null = null;
  protected stopTimeout: NodeJS.Timeout | null = null;
  protected retryMessageInterval: NodeJS.Timeout | null = null;
  private stopped = false;
  private registrationEventHandler: (() => void) | null = null;

  private readonly logger = loggerService.createChildLogger('internal');

  constructor(
    private oIAnalyticsMessageRepository: OIAnalyticsMessageRepository,
    private oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
    private oIAnalyticsClient: OIAnalyticsClient,
    private configTransferBuilderService: ConfigTransferBuilderService
  ) {}

  start(): void {
    this.registrationEventHandler = () => {
      this.createFullConfigMessageIfNotPending();
      this.createFullHistoryQueriesMessageIfNotPending();
      this.messagesQueue = this.oIAnalyticsMessageRepository.listPending();
      this.triggerRun.emit('next'); // trigger next if messages are already pending and not trigger by the creation function
    };
    this.oIAnalyticsRegistrationService.registrationEvent.on('updated', this.registrationEventHandler);

    this.createFullConfigMessageIfNotPending();
    this.createFullHistoryQueriesMessageIfNotPending();
    this.messagesQueue = this.oIAnalyticsMessageRepository.listPending();

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
    if (this.stopped) return;

    if (this.retryMessageInterval) {
      clearTimeout(this.retryMessageInterval);
      this.retryMessageInterval = null;
    }

    if (this.messagesQueue.length === 0) return;

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
          await this.sendFullConfiguration(this.configTransferBuilderService.buildFullConfiguration(registration));
          break;
        case 'history-queries':
          await this.sendHistoryQueriesMessage(this.configTransferBuilderService.buildHistoryQueriesConfiguration());
          break;
        case 'sync-metadata':
          await this.sendSyncMetadata(message.payload);
          break;
      }
      this.oIAnalyticsMessageRepository.markAsCompleted(message.id, DateTime.now().toUTC().toISO());
      this.removeMessageFromQueue(message.id);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      if (isRejected(errorMessage)) {
        this.logger.error(`Error while sending message ${message.id} of type ${message.type}: ${errorMessage}`);
        this.oIAnalyticsMessageRepository.markAsErrored(message.id, DateTime.now().toUTC().toISO(), errorMessage);
        this.removeMessageFromQueue(message.id);
      } else {
        this.logger.error(`Retrying message ${message.id} of type ${message.type} after error: ${errorMessage}`);
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

    this.stopped = true;
    if (this.registrationEventHandler) {
      this.oIAnalyticsRegistrationService.registrationEvent.off('updated', this.registrationEventHandler);
      this.registrationEventHandler = null;
    }
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
        types: ['full-config'],
        start: undefined,
        end: undefined
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
        types: ['history-queries'],
        start: undefined,
        end: undefined
      }).length > 0
    ) {
      return;
    }
    const message = this.oIAnalyticsMessageRepository.create({ type: 'history-queries' });
    this.addMessageToQueue(message);
  }

  /**
   * Queue what a synchronisation run pushing to OIAnalytics discovered. Each run is a whole snapshot and OIAnalytics only
   * keeps the most recent one, so the runs of the same synchronisation still waiting to be sent are dropped: only the
   * one being sent right now is left to finish. The caller (ConfigurationWorkflowRunService) is expected to have
   * already checked the registration, which `run()` itself still enforces before sending anything.
   */
  createSyncMetadataMessage(workflowId: string, workflowRunId: string, payload: string): void {
    const sending = this.runProgress$ ? this.messagesQueue[0]?.id : undefined;
    for (const id of this.oIAnalyticsMessageRepository.findPendingSyncMetadataIds(workflowId)) {
      if (id !== sending) {
        this.oIAnalyticsMessageRepository.delete(id);
        this.removeMessageFromQueue(id);
      }
    }
    const message = this.oIAnalyticsMessageRepository.create({ type: 'sync-metadata', workflowRunId, payload });
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

  private async sendSyncMetadata(payload: string): Promise<void> {
    const registrationSettings = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
    await this.oIAnalyticsClient.sendSyncMetadata(registrationSettings, payload);
    this.logger.debug('Synchronisation metadata sent to OIAnalytics');
  }
}

/** The client errors that may be gone at the next try: authentication (a token being renewed), proxy, timeout, throttling. */
const RETRIED_CLIENT_ERRORS = [401, 403, 407, 408, 429];

/**
 * Whether OIAnalytics refused the message itself (a body it cannot read, an endpoint it does not have...): sending it
 * again would fail the same way, and keep every message queued behind it from being sent. The OIAnalytics client reports
 * an HTTP error as `<status code> - <body>`.
 */
function isRejected(errorMessage: string): boolean {
  if (errorMessage.includes('Bad Request')) {
    return true;
  }
  const statusCode = Number(/^(\d{3}) - /.exec(errorMessage)?.[1]);
  return statusCode >= 400 && statusCode < 500 && !RETRIED_CLIENT_ERRORS.includes(statusCode);
}
