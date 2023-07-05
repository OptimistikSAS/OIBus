import path from 'node:path';
import { EventEmitter } from 'node:events';
import { CronJob } from 'cron';
import { delay, generateIntervals } from '../service/utils';

import { SouthConnectorItemDTO, SouthCache, SouthConnectorDTO } from '../../../shared/model/south-connector.model';
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
  protected itemsByScanModeIds: Map<string, Map<string, SouthConnectorItemDTO<I>>> = new Map<
    string,
    Map<string, SouthConnectorItemDTO<I>>
  >();
  private taskJobQueue: Array<ScanModeDTO> = [];
  private cronByScanModeIds: Map<string, CronJob> = new Map<string, CronJob>();
  private taskRunner: EventEmitter = new EventEmitter();
  private stopping = false;
  private runProgress$: DeferredPromise | null = null;

  protected cacheService: SouthCacheService;
  private _metricsService: SouthConnectorMetricsService;
  historyIsRunning = false;

  /**
   * Constructor for SouthConnector
   */
  constructor(
    protected connector: SouthConnectorDTO<T>,
    items: Array<SouthConnectorItemDTO<I>>,
    private engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    private engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    protected readonly encryptionService: EncryptionService,
    private readonly repositoryService: RepositoryService,
    protected logger: pino.Logger,
    protected readonly baseFolder: string,
    private readonly streamMode: boolean
  ) {
    items
      .filter(item => item.scanModeId)
      .forEach(item => {
        if (!this.itemsByScanModeIds.get(item.scanModeId!)) {
          this.itemsByScanModeIds.set(item.scanModeId!, new Map<string, SouthConnectorItemDTO<I>>());
        }
        this.itemsByScanModeIds.get(item.scanModeId!)!.set(item.id, item);
      });

    this.cacheService = new SouthCacheService(this.connector.id, path.resolve(this.baseFolder, 'cache.db'));
    this._metricsService = new SouthConnectorMetricsService(this.connector.id, path.resolve(this.baseFolder, 'cache.db'));

    if (this.queriesHistory()) {
      this.cacheService.createSouthCacheScanModeTable();
    }

    if (this.streamMode) {
      this.taskRunner.on('next', async () => {
        if (this.taskJobQueue.length > 0) {
          await this.run(this.taskJobQueue[0]);
        } else {
          this.logger.trace('No more task to run');
        }
      });
    }
  }

  async start(): Promise<void> {
    this.logger.trace(`South connector ${this.connector.name} enabled. Starting services...`);
    await this.connect();
  }

  async connect(): Promise<void> {
    this._metricsService.updateMetrics({
      ...this._metricsService.metrics,
      lastConnection: DateTime.now().toUTC().toISO()
    });
    if (!this.streamMode) {
      return;
    }
    if (this.queriesSubscription()) {
      const items = Array.from(this.itemsByScanModeIds.get('subscription') || new Map(), ([_scanModeId, item]) => item);
      this.logger.debug(`Subscribing to ${items.length} items`);
      await this.subscribe(items);
    }

    for (const scanModeId of this.itemsByScanModeIds.keys()) {
      if (scanModeId === 'subscription') {
        continue;
      }
      const scanMode = this.repositoryService.scanModeRepository.getScanMode(scanModeId);
      if (!scanMode) {
        this.logger.error(`Scan mode ${scanModeId} not found`);
      } else {
        if (scanMode.id !== 'subscription' && scanMode.id !== 'history') {
          this.createCronJob(scanMode);
        }
      }
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

  async run(scanMode: ScanModeDTO): Promise<void> {
    if (this.runProgress$) {
      this.logger.warn(`A South task is already running with scan mode ${scanMode.name}`);
      return;
    }

    const items = Array.from(this.itemsByScanModeIds.get(scanMode.id) || new Map(), ([_scanModeId, item]) => item);
    this.logger.trace(`Running South with scan mode ${scanMode.name} and ${items.length} items`);
    this.createDeferredPromise();

    const runStart = DateTime.now();
    this._metricsService.updateMetrics({ ...this._metricsService.metrics, lastRunStart: runStart.toUTC().toISO() });

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
          scanMode.id
        );
      } catch (error) {
        this.historyIsRunning = false;
        this.logger.error(`Error when calling historyQuery ${error}`);
      }
    }
    if (this.queriesFile() && this.streamMode) {
      try {
        await this.fileQuery(items);
      } catch (error) {
        this.logger.error(`Error when calling fileQuery ${error}`);
      }
    }
    if (this.queriesLastPoint() && this.streamMode) {
      try {
        await this.lastPointQuery(items);
      } catch (error) {
        this.logger.error(`Error when calling lastPointQuery ${error}`);
      }
    }

    this._metricsService.updateMetrics({
      ...this._metricsService.metrics,
      lastRunDuration: DateTime.now().toMillis() - runStart.toMillis()
    });
    this.resolveDeferredPromise();

    if (!this.stopping) {
      this.taskJobQueue.shift();
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
    this.historyIsRunning = true;
    if (this.connector.history.maxInstantPerItem) {
      for (const [index, item] of items.entries()) {
        if (this.stopping) {
          this.logger.debug(`Connector is stopping. Exiting history query at item ${item.name}`);
          this._metricsService.updateMetrics({
            ...this._metricsService.metrics,
            historyMetrics: { running: false }
          });
          this.historyIsRunning = false;
          return;
        }

        const southCache = this.cacheService.getSouthCacheScanMode(scanModeId, item.id, startTime);
        // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
        // requests. For example only one hour if maxReadInterval is 3600 (in s)
        const intervals = generateIntervals(southCache.maxInstant, endTime, this.connector.history.maxReadInterval);
        this.logIntervals(intervals);
        await this.queryIntervals(intervals, [item], southCache, startTime);
        if (index !== items.length) {
          await delay(this.connector.history.readDelay);
        }
      }
    } else {
      const southCache = this.cacheService.getSouthCacheScanMode(scanModeId, 'all', startTime);
      // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
      // requests. For example only one hour if maxReadInterval is 3600 (in s)
      const intervals = generateIntervals(southCache.maxInstant, endTime, this.connector.history.maxReadInterval);
      this.logIntervals(intervals);

      await this.queryIntervals(intervals, items, southCache, startTime);
    }
    this._metricsService.updateMetrics({
      ...this._metricsService.metrics,
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
    this._metricsService.updateMetrics({
      ...this._metricsService.metrics,
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
        this.cacheService.createOrUpdateCacheScanMode({
          scanModeId: southCache.scanModeId,
          itemId: southCache.itemId,
          maxInstant: lastInstantRetrieved,
          intervalIndex: index + southCache.intervalIndex
        });
        this._metricsService.updateMetrics({
          ...this._metricsService.metrics,
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
        this.cacheService.createOrUpdateCacheScanMode({
          scanModeId: southCache.scanModeId,
          itemId: southCache.itemId,
          maxInstant: lastInstantRetrieved,
          intervalIndex: 0
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
    if (values.length > 0) {
      this.logger.debug(`Add ${values.length} values to cache from South "${this.connector.name}"`);
      await this.engineAddValuesCallback(this.connector.id, values);
      const currentMetrics = this._metricsService.metrics;
      this._metricsService.updateMetrics({
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
    const currentMetrics = this._metricsService.metrics;
    this._metricsService.updateMetrics({
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

  addItem(item: SouthConnectorItemDTO<I>): void {
    if (item.scanModeId) {
      const scanMode = this.repositoryService.scanModeRepository.getScanMode(item.scanModeId);
      if (!scanMode) {
        this.logger.error(`Error when creating South item in cron jobs: scan mode ${item.scanModeId} not found`);
        return;
      }

      let newCronJob = false;
      if (!this.itemsByScanModeIds.get(item.scanModeId)) {
        newCronJob = true;
        this.itemsByScanModeIds.set(item.scanModeId, new Map());
      }
      this.itemsByScanModeIds.get(item.scanModeId)!.set(item.id, item);

      // Create a new cron job if the scan mode was not already set, other the item will be taken by the task
      if (newCronJob) {
        this.createCronJob(scanMode);
      }
    }
  }

  updateItem(oldItem: SouthConnectorItemDTO<I>, newItem: SouthConnectorItemDTO<I>): void {
    this.logger.info('Updating item in south connector');
    if (newItem.scanModeId) {
      const scanMode = this.repositoryService.scanModeRepository.getScanMode(newItem.scanModeId);
      if (!scanMode) {
        this.logger.error(`Error when creating South item in cron jobs: scan mode ${newItem.scanModeId} not found`);
        return;
      }
    }

    this.deleteItem(oldItem);
    this.addItem(newItem);
  }

  deleteItem(item: SouthConnectorItemDTO<I>) {
    if (!item.scanModeId) {
      return;
    }
    if (!this.itemsByScanModeIds.get(item.scanModeId)) {
      this.logger.error(`Error when removing South item from cron jobs: scan mode ${item.scanModeId} was not set`);
      return;
    }

    if (!this.itemsByScanModeIds.get(item.scanModeId)!.get(item.id)) {
      this.logger.error(`Error when removing South item from cron jobs: item ${item.id} was not set`);
      return;
    }

    this.itemsByScanModeIds.get(item.scanModeId)!.delete(item.id);
    if (this.itemsByScanModeIds.get(item.scanModeId)!.size === 0) {
      this.itemsByScanModeIds.delete(item.scanModeId);
      this.cronByScanModeIds.get(item.scanModeId)?.stop();
      this.cronByScanModeIds.delete(item.scanModeId);
    }
  }

  deleteAllItems() {
    this.itemsByScanModeIds.clear();
    for (const cron of this.cronByScanModeIds.values()) {
      cron.stop();
    }
    this.cronByScanModeIds.clear();
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }

  async resetCache(): Promise<void> {
    this.cacheService.resetCacheScanMode();
  }

  getMetricsDataStream(): PassThrough {
    return this._metricsService.stream;
  }

  resetMetrics(): void {
    this._metricsService.resetMetrics();
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
    return 'subscribe' in this;
  }
}
