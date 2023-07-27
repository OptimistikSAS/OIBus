import { EventEmitter } from 'node:events';
import { CronJob } from 'cron';
import { delay, generateIntervals } from '../service/utils';

import { SouthCache, SouthConnectorDTO, SouthConnectorItemDTO } from '../../../shared/model/south-connector.model';
import { ScanModeDTO } from '../../../shared/model/scan-mode.model';
import { Instant, Interval } from '../../../shared/model/types';
import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import RepositoryService from '../service/repository.service';
import DeferredPromise from '../service/deferred-promise';
import { DateTime } from 'luxon';
import SouthCacheService from '../service/south-cache.service';
import { PassThrough } from 'node:stream';
import { QueriesFile, QueriesHistory, QueriesLastPoint, QueriesSubscription } from './south-interface';
import SouthConnectorMetricsService from '../service/south-connector-metrics.service';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';

/**
 * Class SouthConnector : provides general attributes and methods for south connectors.
 * Building a new South connector means to extend this class, and to surcharge the following methods:
 * - **historyQuery**: receives a scanMode, a startTime and an endTime. Interval split can occur in this class. The
 * main logic must be developed in the surcharged method.
 * - **lastPointQuery**: receives a scanMode. The main logic must be developed in the surcharged method.
 * - **fileQuery**:  receives a scanMode. The main logic must be developed in the surcharged method.
 * - **subscribe**: A special scanMode is used (for example with MQTT). In this configuration, the driver will be able
 * to "listen" for updated values.
 * - **connect** (optional): to establish proper connection to the South connector
 * - **disconnect** (optional): to disconnect
 *
 * In addition, it is possible to use a number of helper functions:
 * - **addValues**: is an **important** method to be used when retrieving values. This will allow to push an array
 * of values to the engine to cache them
 * - **addFile**: is the equivalent of addValues but for a file.
 * - **logger**: to log an event with different levels (error,warning,info,debug,trace).
 *
 * All other operations (cache, store&forward, communication to North connectors) will be handled by the OIBus engine
 * and should not be taken care at the South level.
 */
export default class SouthConnector<T extends SouthSettings = any, I extends SouthItemSettings = any> {
  public static type: string;

  private taskJobQueue: Array<ScanModeDTO> = [];
  private cronByScanModeIds: Map<string, CronJob> = new Map<string, CronJob>();
  private taskRunner: EventEmitter = new EventEmitter();
  public connectedEvent: EventEmitter = new EventEmitter();
  private stopping = false;
  private runProgress$: DeferredPromise | null = null;

  protected cacheService: SouthCacheService | null = null;
  private metricsService: SouthConnectorMetricsService | null = null;
  historyIsRunning = false;

  /**
   * Constructor for SouthConnector
   */
  constructor(
    protected connector: SouthConnectorDTO<T>,
    private items: Array<SouthConnectorItemDTO<I>>,
    private engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    private engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    protected readonly encryptionService: EncryptionService,
    private readonly repositoryService: RepositoryService,
    protected logger: pino.Logger,
    protected readonly baseFolder: string
  ) {
    if (this.connector.id !== 'test') {
      this.metricsService = new SouthConnectorMetricsService(this.connector.id, this.repositoryService.southMetricsRepository);
      this.metricsService.initMetrics();
      this.cacheService = new SouthCacheService(this.connector.id, this.repositoryService.southCacheRepository);
    }
    this.taskRunner.on('next', async () => {
      if (this.taskJobQueue.length > 0) {
        if (this.runProgress$) {
          this.logger.warn('A South task is already running');
          return;
        }
        const scanMode = this.taskJobQueue[0];
        const items = this.items.filter(item => item.scanModeId === scanMode.id && item.enabled);
        this.logger.trace(`Running South with scan mode ${scanMode.name}`);
        await this.run(scanMode.id, items);
      } else {
        this.logger.trace('No more task to run');
      }
    });
  }

  async start(): Promise<void> {
    this.logger.trace(`South connector ${this.connector.name} enabled. Starting services...`);
    await this.connect();
  }

  async connect(): Promise<void> {
    if (this.connector.id !== 'test') {
      this.metricsService!.updateMetrics({
        ...this.metricsService!.metrics,
        lastConnection: DateTime.now().toUTC().toISO()
      });
    }
    this.connectedEvent.emit('connected');
  }

  async createSubscriptions(items: Array<SouthConnectorItemDTO>) {
    if (this.queriesSubscription()) {
      this.logger.debug(`Subscribing to ${items.length} items`);
      await this.subscribe(items);
    }
  }

  createCronJobs(items: Array<SouthConnectorItemDTO>) {
    const scanModes = new Map<string, ScanModeDTO>();
    items
      .filter(item => item.scanModeId)
      .forEach(item => {
        if (!scanModes.get(item.scanModeId!)) {
          const scanMode = this.repositoryService.scanModeRepository.getScanMode(item.scanModeId!)!;
          scanModes.set(scanMode.id, scanMode);
        }
      });

    for (const scanMode of scanModes.values()) {
      this.createCronJob(scanMode);
    }
  }

  isEnabled(): boolean {
    return this.connector.enabled;
  }

  /**
   * Create a job used to populate the queue where each element of the queue is a job to call, associated to its scan mode
   */
  createCronJob(scanMode: ScanModeDTO): void {
    const existingCronJob = this.cronByScanModeIds.get(scanMode.id);
    if (existingCronJob) {
      this.logger.debug(`Removing existing South cron job associated to scan mode "${scanMode.name}" (${scanMode.cron})`);
      existingCronJob.stop();
      this.cronByScanModeIds.delete(scanMode.id);
    }
    this.logger.debug(`Creating South cron job for scan mode "${scanMode.name}" (${scanMode.cron})`);
    const job = new CronJob(
      scanMode.cron,
      () => {
        this.addToQueue(scanMode);
      },
      null,
      true
    );
    this.cronByScanModeIds.set(scanMode.id, job);
  }

  addToQueue(scanMode: ScanModeDTO): void {
    if (this.stopping) {
      return;
    }
    const foundJob = this.taskJobQueue.find(element => element.id === scanMode.id);
    if (foundJob) {
      // If a job is already scheduled in queue, it will not be added
      this.logger.warn(`Task job not added in South connector queue for cron "${scanMode.name}" (${scanMode.cron})`);
      return;
    }

    this.taskJobQueue.push(scanMode);
    if (this.taskJobQueue.length === 1) {
      this.taskRunner.emit('next');
    }
  }

  async run(scanModeId: string, items: Array<SouthConnectorItemDTO>): Promise<void> {
    this.createDeferredPromise();

    const runStart = DateTime.now();
    this.metricsService!.updateMetrics({ ...this.metricsService!.metrics, lastRunStart: runStart.toUTC().toISO() });

    if (this.queriesHistory()) {
      try {
        // By default, retrieve the last hour. If the scan mode has already run, and retrieve a data, the max instant will
        // be retrieved from the South cache inside the history query handler
        await this.historyQueryHandler(
          items,
          DateTime.now()
            .minus(3600 * 1000)
            .toUTC()
            .toISO() as Instant,
          DateTime.now().toUTC().toISO() as Instant,
          scanModeId
        );
      } catch (error) {
        this.historyIsRunning = false;
        this.logger.error(`Error when calling historyQuery. ${error}`);
      }
    }
    if (this.queriesFile()) {
      try {
        this.logger.trace(`Querying file for ${items.length} items`);
        await this.fileQuery(items);
      } catch (error) {
        this.logger.error(`Error when calling fileQuery. ${error}`);
      }
    }
    if (this.queriesLastPoint()) {
      try {
        this.logger.trace(`Querying points for ${items.length} items`);
        await this.lastPointQuery(items);
      } catch (error) {
        this.logger.error(`Error when calling lastPointQuery. ${error}`);
      }
    }

    this.metricsService!.updateMetrics({
      ...this.metricsService!.metrics,
      lastRunDuration: DateTime.now().toMillis() - runStart.toMillis()
    });
    this.resolveDeferredPromise();

    this.taskJobQueue.shift();
    if (!this.stopping) {
      this.taskRunner.emit('next');
    }
  }

  /**
   * Methode used to set the runProgress$ variable with a DeferredPromise
   * This allows to call historyQueryHandler from outside (like history query engine) in a blocking way for other
   * calls
   */
  createDeferredPromise(): void {
    this.runProgress$ = new DeferredPromise();
  }

  /**
   * Method used to resolve and unset the DeferredPromise kept in the runProgress$ variable
   * This allows to control the promise from an outside class (like history query engine)
   */
  resolveDeferredPromise(): void {
    if (this.runProgress$) {
      this.runProgress$.resolve();
      this.runProgress$ = null;
    }
  }

  async historyQueryHandler(
    items: Array<SouthConnectorItemDTO<I>>,
    startTime: Instant,
    endTime: Instant,
    scanModeId: string
  ): Promise<void> {
    this.logger.trace(`Querying history for ${items.length} items`);

    this.historyIsRunning = true;
    if (this.connector.history.maxInstantPerItem) {
      for (const [index, item] of items.entries()) {
        if (this.stopping) {
          this.logger.debug(`Connector is stopping. Exiting history query at item ${item.name}`);
          this.metricsService!.updateMetrics({
            ...this.metricsService!.metrics,
            historyMetrics: { running: false }
          });
          this.historyIsRunning = false;
          return;
        }

        const southCache = this.cacheService!.getSouthCacheScanMode(this.connector.id, scanModeId, item.id, startTime);
        // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
        // requests. For example only one hour if maxReadInterval is 3600 (in s)
        const intervals = generateIntervals(southCache.maxInstant, endTime, this.connector.history.maxReadInterval);
        this.logIntervals(intervals);
        await this.queryIntervals(intervals, [item], southCache, startTime);
        if (index !== items.length - 1) {
          await delay(this.connector.history.readDelay);
        }
      }
    } else {
      const southCache = this.cacheService!.getSouthCacheScanMode(this.connector.id, scanModeId, 'all', startTime);
      // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
      // requests. For example only one hour if maxReadInterval is 3600 (in s)
      const intervals = generateIntervals(southCache.maxInstant, endTime, this.connector.history.maxReadInterval);
      this.logIntervals(intervals);

      await this.queryIntervals(intervals, items, southCache, startTime);
    }
    this.metricsService!.updateMetrics({
      ...this.metricsService!.metrics,
      historyMetrics: { running: false }
    });
    this.historyIsRunning = false;
  }

  private async queryIntervals(
    intervals: Array<Interval>,
    items: Array<SouthConnectorItemDTO<I>>,
    southCache: SouthCache,
    startTime: Instant
  ) {
    this.metricsService!.updateMetrics({
      ...this.metricsService!.metrics,
      historyMetrics: {
        running: true,
        intervalProgress:
          1 -
          (DateTime.fromISO(intervals[intervals.length - 1].end).toMillis() - DateTime.fromISO(intervals[0].start).toMillis()) /
            (DateTime.fromISO(intervals[intervals.length - 1].end).toMillis() - DateTime.fromISO(startTime).toMillis())
      }
    });
    for (const [index, interval] of intervals.entries()) {
      // @ts-ignore
      const lastInstantRetrieved = await this.historyQuery(items, interval.start, interval.end);
      if (index !== intervals.length - 1) {
        this.cacheService!.createOrUpdateCacheScanMode({
          southId: this.connector.id,
          scanModeId: southCache.scanModeId,
          itemId: southCache.itemId,
          maxInstant: lastInstantRetrieved
        });
        this.metricsService!.updateMetrics({
          ...this.metricsService!.metrics,
          historyMetrics: {
            running: true,
            intervalProgress:
              1 -
              (DateTime.fromISO(intervals[intervals.length - 1].end).toMillis() - DateTime.fromISO(interval.start).toMillis()) /
                (DateTime.fromISO(intervals[intervals.length - 1].end).toMillis() - DateTime.fromISO(startTime).toMillis())
          }
        });
        if (this.stopping) {
          this.logger.debug(`Connector is stopping. Exiting history query at interval ${index}: [${interval.start}, ${interval.end}]`);
          return;
        }
        await delay(this.connector.history.readDelay);
      } else {
        this.cacheService!.createOrUpdateCacheScanMode({
          southId: this.connector.id,
          scanModeId: southCache.scanModeId,
          itemId: southCache.itemId,
          maxInstant: lastInstantRetrieved
        });
      }
    }
  }

  private logIntervals(intervals: Array<Interval>) {
    if (intervals.length > 2) {
      this.logger.trace(
        `Interval split in ${intervals.length} sub-intervals: \r\n` +
          `[${JSON.stringify(intervals[0], null, 2)}\r\n` +
          `${JSON.stringify(intervals[1], null, 2)}\r\n` +
          '...\r\n' +
          `${JSON.stringify(intervals[intervals.length - 1], null, 2)}]`
      );
    } else if (intervals.length === 2) {
      this.logger.trace(
        `Interval split in ${intervals.length} sub-intervals: \r\n` +
          `[${JSON.stringify(intervals[0], null, 2)}\r\n` +
          `${JSON.stringify(intervals[1], null, 2)}]`
      );
    } else {
      this.logger.trace(`Querying interval: ${JSON.stringify(intervals[0], null, 2)}`);
    }
  }

  /**
   * Add new values to the South connector buffer.
   */
  async addValues(values: Array<any>): Promise<void> {
    if (values.length > 0 && this.connector.id !== 'test') {
      this.logger.debug(`Add ${values.length} values to cache from South "${this.connector.name}"`);
      await this.engineAddValuesCallback(this.connector.id, values);
      const currentMetrics = this.metricsService!.metrics;
      this.metricsService!.updateMetrics({
        ...currentMetrics,
        numberOfValuesRetrieved: currentMetrics.numberOfValuesRetrieved + values.length,
        lastValueRetrieved: values[values.length - 1]
      });
    }
  }

  /**
   * Add a new file to the Engine.
   */
  async addFile(filePath: string): Promise<void> {
    this.logger.debug(`Add file "${filePath}" to cache from South "${this.connector.name}"`);
    await this.engineAddFileCallback(this.connector.id, filePath);
    const currentMetrics = this.metricsService!.metrics;
    this.metricsService!.updateMetrics({
      ...currentMetrics,
      numberOfFilesRetrieved: currentMetrics.numberOfFilesRetrieved + 1,
      lastFileRetrieved: filePath
    });
  }

  /**
   * Method called by Engine to stop a South connector. This method can be surcharged in the
   * South connector implementation to allow disconnecting to a third party application for example.
   */
  async disconnect(): Promise<void> {
    for (const cronJob of this.cronByScanModeIds.values()) {
      cronJob.stop();
    }
    this.cronByScanModeIds.clear();
    this.taskJobQueue = [];
    this.logger.info(`South connector "${this.connector.name}" (${this.connector.id}) disconnected`);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    for (const cronJob of this.cronByScanModeIds.values()) {
      cronJob.stop();
    }
    this.cronByScanModeIds.clear();
    this.logger.info(`Stopping South "${this.connector.name}" (${this.connector.id})...`);

    if (this.runProgress$) {
      this.logger.debug('Waiting for South task to finish');
      await this.runProgress$.promise;
    }

    await this.disconnect();
    this.stopping = false;
  }

  async addItem(item: SouthConnectorItemDTO<I>): Promise<void> {
    const scanMode = this.repositoryService.scanModeRepository.getScanMode(item.scanModeId);
    if (!scanMode) {
      this.logger.error(`Error when creating South item in cron jobs: scan mode ${item.scanModeId} not found`);
      return;
    }

    this.items.push(item);
    if (item.scanModeId === 'subscription' && item.enabled) {
      await this.createSubscriptions([item]);
    } else if (!this.cronByScanModeIds.get(scanMode.id) && item.enabled) {
      this.createCronJob(scanMode);
    }
  }

  async updateItem(oldItem: SouthConnectorItemDTO<I>, newItem: SouthConnectorItemDTO<I>): Promise<void> {
    this.logger.info('Updating item in south connector');
    if (newItem.scanModeId) {
      const scanMode = this.repositoryService.scanModeRepository.getScanMode(newItem.scanModeId);
      if (!scanMode) {
        this.logger.error(`Error when creating South item in cron jobs: scan mode ${newItem.scanModeId} not found`);
        return;
      }
    }

    await this.deleteItem(oldItem);
    await this.addItem(newItem);
  }

  async deleteItem(itemToRemove: SouthConnectorItemDTO<I>): Promise<void> {
    const itemIndex = this.items.findIndex(item => item.id === itemToRemove.id);
    if (itemIndex !== -1) {
      if (this.queriesSubscription() && itemToRemove.scanModeId === 'subscription') {
        await this.unsubscribe([itemToRemove]);
      }
      this.items = this.items.filter(item => item.id !== itemToRemove.id);
      if (this.items.filter(item => item.scanModeId === itemToRemove.scanModeId).length === 0) {
        this.cronByScanModeIds.get(itemToRemove.scanModeId)?.stop();
        this.cronByScanModeIds.delete(itemToRemove.scanModeId);
      }
    }
  }

  async deleteAllItems(): Promise<void> {
    if (this.queriesSubscription()) {
      await this.unsubscribe(this.items.filter(item => item.scanModeId === 'subscription'));
    }

    this.items = [];
    for (const cron of this.cronByScanModeIds.values()) {
      cron.stop();
    }
    this.cronByScanModeIds.clear();
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }

  async resetCache(): Promise<void> {
    this.cacheService!.resetCacheScanMode();
  }

  getMetricsDataStream(): PassThrough {
    return this.metricsService!.stream;
  }

  resetMetrics(): void {
    this.metricsService!.resetMetrics();
  }

  queriesFile(): this is QueriesFile {
    return 'fileQuery' in this;
  }

  queriesLastPoint(): this is QueriesLastPoint {
    return 'lastPointQuery' in this;
  }

  queriesHistory(): this is QueriesHistory {
    return 'historyQuery' in this;
  }

  queriesSubscription(): this is QueriesSubscription {
    return 'subscribe' in this && 'unsubscribe' in this;
  }

  async testConnection(): Promise<void> {
    this.logger.warn('testConnection must be override');
  }
}
