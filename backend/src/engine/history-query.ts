import path from 'node:path';

import { createFolder, delay } from '../service/utils';
import pino from 'pino';
import SouthService from '../service/south.service';
import NorthService from '../service/north.service';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { OIBusContent, OIBusTimeValue } from '../../shared/model/engine.model';
import { SouthConnectorEntity } from '../model/south-connector.model';
import { NorthConnectorEntity } from '../model/north-connector.model';
import { HistoryQueryEntity } from '../model/histor-query.model';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import { EventEmitter } from 'node:events';
import { Instant } from '../model/types';
import { QueriesHistory } from '../south/south-interface';

const FINISH_INTERVAL = 5000;

export default class HistoryQuery {
  private north: NorthConnector<NorthSettings> | null = null;
  private south: SouthConnector<SouthSettings, SouthItemSettings> | null = null;
  private finishInterval: NodeJS.Timeout | null = null;
  private stopping = false;

  public metricsEvent: EventEmitter = new EventEmitter();

  constructor(
    private historyConfiguration: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>,
    private readonly southService: SouthService,
    private readonly northService: NorthService,
    private readonly historyQueryRepository: HistoryQueryRepository,
    private readonly baseFolder: string,
    private logger: pino.Logger
  ) {}

  async start(): Promise<void> {
    this.historyConfiguration = this.historyQueryRepository.findHistoryQueryById(this.historyConfiguration.id)!;
    const southConfiguration: SouthConnectorEntity<SouthSettings, SouthItemSettings> = {
      id: this.historyConfiguration.id,
      name: this.historyConfiguration.name,
      description: '',
      enabled: true,
      type: this.historyConfiguration.southType,
      settings: this.historyConfiguration.southSettings,
      items: []
    };
    const southFolder = path.resolve(this.baseFolder, 'south');
    await createFolder(southFolder);
    this.south = this.southService.runSouth(southConfiguration, this.addContent.bind(this), this.logger, southFolder);
    const northConfiguration: NorthConnectorEntity<NorthSettings> = {
      id: this.historyConfiguration.id,
      name: this.historyConfiguration.name,
      description: '',
      enabled: true,
      type: this.historyConfiguration.northType,
      settings: this.historyConfiguration.northSettings,
      caching: this.historyConfiguration.caching,
      subscriptions: []
    };
    const northFolder = path.resolve(this.baseFolder, 'north');
    await createFolder(northFolder);
    this.north = this.northService.runNorth(northConfiguration, this.logger, northFolder);

    if (this.historyConfiguration.status !== 'RUNNING') {
      this.logger.trace(`History Query "${this.historyConfiguration.name}" not enabled`);
      return;
    }

    this.north.metricsEvent.on('connect', (data: { lastConnection: Instant }) => {
      this.metricsEvent.emit('north-connect', data);
    });
    this.north.metricsEvent.on('run-start', (data: { lastRunStart: Instant }) => {
      this.metricsEvent.emit('north-run-start', data);
    });
    this.north.metricsEvent.on('run-end', (data: { lastRunDuration: number }) => {
      this.metricsEvent.emit('north-run-end', data);
    });
    this.north.metricsEvent.on('cache-size', (data: { cacheSize: number }) => {
      this.metricsEvent.emit('north-cache-size', data);
    });
    this.north.metricsEvent.on('send-values', (data: { numberOfValuesSent: number; lastValueSent: OIBusTimeValue }) => {
      this.metricsEvent.emit('north-send-values', data);
    });
    this.north.metricsEvent.on('send-file', (data: { lastFileSent: string }) => {
      this.metricsEvent.emit('north-send-file', data);
    });
    await this.north.start(false);

    this.south.connectedEvent.on('connected', async () => {
      this.south!.createDeferredPromise();

      this.south!.historyQueryHandler(
        this.historyConfiguration.items.map(item => ({ ...item, scanModeId: 'history' })),
        this.historyConfiguration.startTime,
        this.historyConfiguration.endTime,
        'history',
        (this.south as unknown as QueriesHistory).getThrottlingSettings(this.historyConfiguration.southSettings),
        (this.south as unknown as QueriesHistory).getMaxInstantPerItem(this.historyConfiguration.southSettings),
        0
      )
        .then(() => {
          this.south!.resolveDeferredPromise();
        })
        .catch(async error => {
          this.logger.error(`Error while executing history query. ${error}`);
          this.south!.resolveDeferredPromise();
          await delay(FINISH_INTERVAL);
          this.historyConfiguration = this.historyQueryRepository.findHistoryQueryById(this.historyConfiguration.id)!;
          if (this.historyConfiguration.status === 'RUNNING' && !this.stopping) {
            await this.south!.stop(false);
            await this.south!.start(false);
          }
        });
      if (this.finishInterval) {
        clearInterval(this.finishInterval);
      }
      this.finishInterval = setInterval(this.finish.bind(this), FINISH_INTERVAL);
    });
    this.south.metricsEvent.on('connect', (data: { lastConnection: Instant }) => {
      this.metricsEvent.emit('south-connect', data);
    });
    this.south.metricsEvent.on('run-start', (data: { lastRunStart: Instant }) => {
      this.metricsEvent.emit('south-run-start', data);
    });
    this.south.metricsEvent.on('run-end', (data: { lastRunDuration: number }) => {
      this.metricsEvent.emit('south-run-end', data);
    });
    this.south.metricsEvent.on('history-query-start', (data: { running: boolean; intervalProgress: number }) => {
      this.metricsEvent.emit('south-history-query-start', data);
    });
    this.south.metricsEvent.on(
      'history-query-interval',
      (data: {
        running: boolean;
        intervalProgress: number;
        currentIntervalStart: Instant;
        currentIntervalEnd: Instant;
        currentIntervalNumber: number;
        numberOfIntervals: number;
      }) => {
        this.metricsEvent.emit('south-history-query-interval', data);
      }
    );
    this.south.metricsEvent.on('history-query-stop', (data: { running: boolean }) => {
      this.metricsEvent.emit('south-history-query-stop', data);
    });
    this.south.metricsEvent.on('add-values', (data: { numberOfValuesRetrieved: number; lastValueRetrieved: OIBusTimeValue }) => {
      this.metricsEvent.emit('south-add-values', data);
    });
    this.south.metricsEvent.on('add-file', (data: { lastFileRetrieved: string }) => {
      this.metricsEvent.emit('south-add-file', data);
    });
    await this.south.start(false);
  }

  async addContent(_historyId: string, data: OIBusContent) {
    if (this.north) {
      switch (data.type) {
        case 'time-values':
          this.logger.info(`Add ${data.content.length} values from History Query "${this.historyConfiguration.name}" to north connector`);
          return await this.north.cacheValues(data.content);
        case 'raw':
          this.logger.info(`Add file "${data.filePath}" from History Query "${this.historyConfiguration.name}" to north connector`);
          return await this.north.cacheFile(data.filePath);
      }
    }
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.finishInterval) {
      clearInterval(this.finishInterval);
      this.finishInterval = null;
    }
    if (this.south) {
      this.south.connectedEvent.removeAllListeners();
      this.south.metricsEvent.removeAllListeners();
      await this.south.stop(false);
    }
    if (this.north) {
      await this.north.stop(false);
      this.north.metricsEvent.removeAllListeners();
    }
    this.stopping = false;
  }

  async resetCache(): Promise<void> {
    if (this.south) {
      await this.south.resetCache();
    }
    if (this.north) {
      await this.north.resetCache();
    }
  }

  /**
   * Finish HistoryQuery.
   */
  async finish(): Promise<void> {
    if (!this.north || !this.south || ((await this.north.isCacheEmpty()) && !this.south.historyIsRunning)) {
      this.logger.info(`Finish "${this.historyConfiguration.name}" (${this.historyConfiguration.id})`);
      await this.stop();
      this.historyQueryRepository.updateHistoryQueryStatus(this.historyConfiguration.id, 'FINISHED');
      this.historyConfiguration = this.historyQueryRepository.findHistoryQueryById(this.historyConfiguration.id)!;
    } else {
      this.logger.debug(`History query "${this.historyConfiguration.name}" is still running`);
    }
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }

  get settings(): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> {
    return this.historyConfiguration;
  }
}
