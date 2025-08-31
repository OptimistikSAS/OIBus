import { delay } from '../service/utils';
import pino from 'pino';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { CacheMetadata, CacheSearchParam, OIBusTimeValue } from '../../shared/model/engine.model';
import { HistoryQueryEntity } from '../model/histor-query.model';
import { EventEmitter } from 'node:events';
import { Instant } from '../model/types';
import { QueriesHistory } from '../south/south-interface';
import { ReadStream } from 'node:fs';

const FINISH_INTERVAL = 5000;

export default class HistoryQuery {
  private finishInterval: NodeJS.Timeout | null = null;
  private stopping = false;

  public metricsEvent: EventEmitter = new EventEmitter();
  public finishEvent: EventEmitter = new EventEmitter();

  constructor(
    private historyConfiguration: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>,
    private north: NorthConnector<NorthSettings>,
    private south: SouthConnector<SouthSettings, SouthItemSettings>,
    private logger: pino.Logger
  ) {}

  async start(): Promise<void> {
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
    this.north.metricsEvent.on(
      'run-end',
      (data: { lastRunDuration: number; metadata: CacheMetadata; action: 'sent' | 'errored' | 'archived' }) => {
        this.metricsEvent.emit('north-run-end', data);
      }
    );
    this.north.metricsEvent.on('cache-size', (data: { cacheSize: number; errorSize: number; archiveSize: number }) => {
      this.metricsEvent.emit('north-cache-size', data);
    });
    this.north.metricsEvent.on('cache-content-size', (cachedSize: number) => {
      this.metricsEvent.emit('north-cache-content-size', cachedSize);
    });
    await this.north.start();

    this.south.connectedEvent.on('connected', async () => {
      this.south!.createDeferredPromise();

      this.south!.historyQueryHandler(
        this.historyConfiguration.items
          .filter(item => item.enabled)
          .map(item => ({
            ...item,
            scanMode: {
              id: 'history',
              name: 'history',
              description: '',
              cron: ''
            }
          })),
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
          if (this.historyConfiguration.status === 'RUNNING' && !this.stopping) {
            await this.south!.stop();
            await this.south!.start();
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
    await this.south.start();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.finishInterval) {
      clearInterval(this.finishInterval);
      this.finishInterval = null;
    }

    this.south.connectedEvent.removeAllListeners();
    await this.south.stop();
    this.south.metricsEvent.removeAllListeners();
    await this.north.stop();
    this.north.metricsEvent.removeAllListeners();

    this.stopping = false;
  }

  async resetCache(): Promise<void> {
    await this.south.resetCache();
    await this.north.resetCache();
  }

  async finish(): Promise<void> {
    if (this.north.isCacheEmpty() && !this.south.historyIsRunning) {
      this.logger.info(`Finish History query "${this.historyConfiguration.name}" (${this.historyConfiguration.id})`);
      await this.stop();
      this.finishEvent.emit('finished');
    } else {
      this.logger.debug(`History query "${this.historyConfiguration.name}" is still running`);
    }
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }

  get historyQueryConfiguration() {
    return this.historyConfiguration;
  }

  set historyQueryConfiguration(historyQueryConfiguration: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>) {
    this.historyConfiguration = historyQueryConfiguration;
    this.south.connectorConfiguration = {
      id: historyQueryConfiguration.id,
      name: historyQueryConfiguration.name,
      description: historyQueryConfiguration.description,
      enabled: true,
      type: historyQueryConfiguration.southType,
      settings: historyQueryConfiguration.southSettings,
      items: []
    };
    this.north.connectorConfiguration = {
      id: historyQueryConfiguration.id,
      name: historyQueryConfiguration.name,
      description: historyQueryConfiguration.description,
      enabled: true,
      type: historyQueryConfiguration.northType,
      settings: historyQueryConfiguration.northSettings,
      caching: historyQueryConfiguration.caching,
      subscriptions: [],
      transformers: historyQueryConfiguration.northTransformers
    };
  }

  async searchCacheContent(
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    return (await this.north.searchCacheContent(searchParams, folder)) || [];
  }

  async getCacheContentFileStream(folder: 'cache' | 'archive' | 'error', filename: string): Promise<ReadStream | null> {
    return (await this.north.getCacheContentFileStream(folder, filename)) || null;
  }

  async removeCacheContent(folder: 'cache' | 'archive' | 'error', metadataFilenameList: Array<string>): Promise<void> {
    await this.north.removeCacheContent(folder, await this.north.metadataFileListToCacheContentList(folder, metadataFilenameList));
  }

  async removeAllCacheContent(folder: 'cache' | 'archive' | 'error'): Promise<void> {
    await this.north.removeAllCacheContent(folder);
  }

  async moveCacheContent(
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    cacheContentList: Array<string>
  ): Promise<void> {
    await this.north.moveCacheContent(
      originFolder,
      destinationFolder,
      await this.north.metadataFileListToCacheContentList(originFolder, cacheContentList)
    );
  }

  async moveAllCacheContent(originFolder: 'cache' | 'archive' | 'error', destinationFolder: 'cache' | 'archive' | 'error'): Promise<void> {
    await this.north.moveAllCacheContent(originFolder, destinationFolder);
  }
}
