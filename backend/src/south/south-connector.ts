import { EventEmitter } from 'node:events';
import { CronJob } from 'cron';
import { delay, generateIntervals, validateCronExpression } from '../service/utils';

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
import { QueriesFile, QueriesHistory, QueriesLastPoint, QueriesSubscription, DelegatesConnection } from './south-interface';
import SouthConnectorMetricsService from '../service/south-connector-metrics.service';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import path from 'node:path';
import ConnectionService, { ManagedConnectionDTO } from '../service/connection.service';

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
  protected subscribedItems: Array<SouthConnectorItemDTO<I>> = [];
  protected items: Array<SouthConnectorItemDTO<I>> = [];
  protected cacheService: SouthCacheService | null = null;
  private metricsService: SouthConnectorMetricsService | null = null;
  historyIsRunning = false;

  /**
   * Constructor for SouthConnector
   */
  constructor(
    protected connector: SouthConnectorDTO<T>,
    private engineAddValuesCallback: (southId: string, values: Array<OIBusTimeValue>) => Promise<void>,
    private engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    protected readonly encryptionService: EncryptionService,
    protected readonly repositoryService: RepositoryService,
    protected logger: pino.Logger,
    protected readonly baseFolder: string,
    // The value is null in order to incrementally refactor connectors to use the ConnectionService
    private readonly connectionService: ConnectionService | null = null
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

        const itemsToSend = this.items.filter(item => item.scanModeId === scanMode.id);
        if (itemsToSend.length > 0) {
          this.logger.trace(`Running South with scan mode ${scanMode.name} for ${this.items.length} items`);
          await this.run(scanMode.id, itemsToSend);
        }
      } else {
        this.logger.trace('No more task to run');
      }
    });
  }

  async start(dataStream = true): Promise<void> {
    if (dataStream) {
      // Reload the settings only on data stream case, otherwise let the history query manage the settings
      this.connector = this.repositoryService.southConnectorRepository.getSouthConnector(this.connector.id)!;
    }
    this.logger.debug(`South connector ${this.connector.name} enabled. Starting services...`);
    await this.connect();
  }

  async connect(): Promise<void> {
    if (this.connector.id !== 'test') {
      this.metricsService!.updateMetrics(this.connector.id, {
        ...this.metricsService!.metrics,
        lastConnection: DateTime.now().toUTC().toISO()
      });
    }

    if (this.delegatesConnection()) {
      const connectionDTO: ManagedConnectionDTO<any> = {
        type: this.connector.type,
        connectorSettings: this.connector.settings,
        createSessionFn: this.createSession.bind(this),
        settings: this.connectionSettings
      };

      this.connection = this.connectionService!.create(this.connector.id, connectionDTO);
    }

    this.logger.info(`South connector "${this.connector.name}" of type ${this.connector.type} started`);

    for (const cronJob of this.cronByScanModeIds.values()) {
      cronJob.stop();
    }
    this.cronByScanModeIds.clear();
    this.subscribedItems = [];
    this.connectedEvent.emit('connected');
  }

  /**
   * Reset the cron and subscriptions if necessary on item changes
   */
  async onItemChange(): Promise<void> {
    this.items = this.repositoryService.southItemRepository.listSouthItems(this.connector.id, {
      enabled: true
    });
    const scanModes = new Map<string, ScanModeDTO>();
    this.items
      .filter(item => item.scanModeId && item.scanModeId !== 'subscription')
      .forEach(item => {
        if (!scanModes.get(item.scanModeId!)) {
          const scanMode = this.repositoryService.scanModeRepository.getScanMode(item.scanModeId!)!;
          scanModes.set(scanMode.id, scanMode);
        }
      });
    for (const scanMode of scanModes.values()) {
      if (!this.cronByScanModeIds.has(scanMode.id!)) {
        this.createCronJob(scanMode);
      }
    }
    for (const [cronScanModeId, cron] of this.cronByScanModeIds.entries()) {
      if (!scanModes.has(cronScanModeId)) {
        cron.stop();
        this.cronByScanModeIds.delete(cronScanModeId);
      }
    }

    if (this.queriesSubscription()) {
      const subscriptionItems = this.items.filter(item => item.scanModeId === 'subscription');

      const itemsToSubscribe = subscriptionItems.filter(item => {
        return !this.subscribedItems.some(subscribedItem => subscribedItem.id === item.id);
      });

      if (itemsToSubscribe.length > 0) {
        try {
          this.logger.trace(`Subscribing to ${itemsToSubscribe.length} new items`);
          await this.subscribe(itemsToSubscribe);
          this.subscribedItems.push(...itemsToSubscribe);
        } catch (error) {
          this.logger.error(`Error when subscribing to new items. ${error}`);
        }
      }

      const itemsToUnsubscribe = this.subscribedItems.filter(item => {
        return !subscriptionItems.some(subscribedItem => subscribedItem.id === item.id);
      });
      if (itemsToUnsubscribe.length > 0) {
        try {
          this.logger.trace(`Unsubscribing to ${itemsToUnsubscribe.length} items`);
          await this.unsubscribe(itemsToUnsubscribe);
          this.subscribedItems = this.subscribedItems.filter(
            item => !itemsToUnsubscribe.some(itemToUnsubscribe => itemToUnsubscribe.id === item.id)
          );
        } catch (error) {
          this.logger.error(`Error when unsubscribing to items. ${error}`);
        }
      }
    }
  }

  async updateScanMode(scanMode: ScanModeDTO): Promise<void> {
    if (this.cronByScanModeIds.get(scanMode.id)) {
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

    try {
      validateCronExpression(scanMode.cron);
      const job = new CronJob(
        scanMode.cron,
        () => {
          this.addToQueue.bind(this).call(this, scanMode);
        },
        null,
        true
      );
      this.cronByScanModeIds.set(scanMode.id, job);
    } catch (error: any) {
      this.logger.error(`Error when creating South cron job for scan mode "${scanMode.name}" (${scanMode.cron}): ${error.message}`);
    }
  }

  addToQueue(scanMode: ScanModeDTO): void {
    if (this.stopping) {
      this.logger.trace(`Connector is exiting. Cron "${scanMode.name}" (${scanMode.cron}) not added`);
      return;
    }
    const foundJob = this.taskJobQueue.find(element => element.id === scanMode.id);
    if (foundJob) {
      // If a job is already scheduled in queue, it will not be added
      this.logger.warn(
        `Task job not added in South connector queue for cron "${scanMode.name}" (${scanMode.cron}). The previous cron was still running`
      );
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
    this.metricsService!.updateMetrics(this.connector.id, {
      ...this.metricsService!.metrics,
      lastRunStart: runStart.toUTC().toISO()
    });

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

    this.metricsService!.updateMetrics(this.connector.id, {
      ...this.metricsService!.metrics,
      lastRunDuration: DateTime.now().toMillis() - runStart.toMillis()
    });
    this.taskJobQueue.shift();
    this.resolveDeferredPromise();

    if (!this.stopping) {
      this.taskRunner.emit('next');
    }
  }

  /**
   * Method used to set the runProgress$ variable with a DeferredPromise
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
    const itemsToRead = this.filterHistoryItems(items);
    if (!itemsToRead.length) {
      this.logger.trace('No history items to read. Ignoring historyQuery');
      return;
    }

    this.logger.trace(`Querying history for ${itemsToRead.length} items`);

    this.historyIsRunning = true;
    if (this.connector.history.maxInstantPerItem) {
      for (const [index, item] of itemsToRead.entries()) {
        if (this.stopping) {
          this.logger.debug(`Connector is stopping. Exiting history query at item ${item.name}`);
          const stoppedMetrics = structuredClone(this.metricsService!.metrics);
          stoppedMetrics.historyMetrics.running = false;
          this.metricsService!.updateMetrics(this.connector.id, stoppedMetrics);
          this.historyIsRunning = false;
          return;
        }

        const southCache = this.cacheService!.getSouthCacheScanMode(this.connector.id, scanModeId, item.id, startTime);
        // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
        // requests. For example only one hour if maxReadInterval is 3600 (in s)
        const startTimeFromCache = DateTime.fromISO(southCache.maxInstant).minus(this.connector.history.overlap).toUTC().toISO()!;
        const intervals = generateIntervals(startTimeFromCache, endTime, this.connector.history.maxReadInterval);
        this.logIntervals(intervals);
        await this.queryIntervals(intervals, [item], southCache, startTimeFromCache);
        if (index !== itemsToRead.length - 1) {
          await delay(this.connector.history.readDelay);
        }
      }
    } else {
      const southCache = this.cacheService!.getSouthCacheScanMode(this.connector.id, scanModeId, 'all', startTime);
      const startTimeFromCache = DateTime.fromISO(southCache.maxInstant).minus(this.connector.history.overlap).toUTC().toISO()!;
      // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
      // requests. For example only one hour if maxReadInterval is 3600 (in s)
      const intervals = generateIntervals(startTimeFromCache, endTime, this.connector.history.maxReadInterval);
      this.logIntervals(intervals);

      await this.queryIntervals(intervals, itemsToRead, southCache, startTimeFromCache);
    }
    const stoppedMetrics = structuredClone(this.metricsService!.metrics);
    stoppedMetrics.historyMetrics.running = false;
    this.metricsService!.updateMetrics(this.connector.id, stoppedMetrics);
    this.historyIsRunning = false;
  }

  private async queryIntervals(
    intervals: Array<Interval>,
    items: Array<SouthConnectorItemDTO<I>>,
    southCache: SouthCache,
    startTimeFromCache: Instant
  ) {
    this.metricsService!.updateMetrics(this.connector.id, {
      ...this.metricsService!.metrics,
      historyMetrics: {
        running: true,
        intervalProgress: this.calculateIntervalProgress(intervals, 0, startTimeFromCache)
      }
    });

    for (const [index, interval] of intervals.entries()) {
      // @ts-ignore
      const lastInstantRetrieved = await this.historyQuery(items, interval.start, interval.end, startTimeFromCache);

      if (lastInstantRetrieved > southCache.maxInstant) {
        // With overlap, it may return a lastInstantRetrieved inferior
        this.cacheService!.createOrUpdateCacheScanMode({
          southId: this.connector.id,
          scanModeId: southCache.scanModeId,
          itemId: southCache.itemId,
          maxInstant: lastInstantRetrieved
        });
      }

      this.metricsService!.updateMetrics(this.connector.id, {
        ...this.metricsService!.metrics,
        historyMetrics: {
          running: true,
          intervalProgress: this.calculateIntervalProgress(intervals, index, startTimeFromCache),
          currentIntervalStart: interval.start,
          currentIntervalEnd: interval.end,
          currentIntervalNumber: index + 1,
          numberOfIntervals: intervals.length
        }
      });

      if (this.stopping) {
        this.logger.debug(`Connector is stopping. Exiting history query at interval ${index}: [${interval.start}, ${interval.end}]`);
        return;
      }

      if (index !== intervals.length - 1) {
        await delay(this.connector.history.readDelay);
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
   * Calculate the progress of the current interval
   */
  private calculateIntervalProgress(intervals: Array<Interval>, currentIntervalIndex: number, startTime: Instant) {
    // calculate progress based on time
    const progress =
      1 -
      (DateTime.fromISO(intervals[intervals.length - 1].end).toMillis() -
        DateTime.fromISO(intervals[currentIntervalIndex].start).toMillis()) /
        (DateTime.fromISO(intervals[intervals.length - 1].end).toMillis() - DateTime.fromISO(startTime).toMillis());

    // round to 2 decimals
    const roundedProgress = Math.round((progress + Number.EPSILON) * 100) / 100;

    // in the chance that the rounded progress is 0.99, but it's the last interval, we want to return 1
    if (currentIntervalIndex === intervals.length - 1) {
      return 1;
    }

    return roundedProgress;
  }

  /**
   * Add new values to the South connector buffer.
   */
  async addValues(values: Array<OIBusTimeValue>): Promise<void> {
    if (values.length > 0 && this.connector.id !== 'test') {
      this.logger.debug(`Add ${values.length} values to cache from South "${this.connector.name}"`);
      await this.engineAddValuesCallback(this.connector.id, values);
      const currentMetrics = this.metricsService!.metrics;
      this.metricsService!.updateMetrics(this.connector.id, {
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
    this.metricsService!.updateMetrics(this.connector.id, {
      ...currentMetrics,
      numberOfFilesRetrieved: currentMetrics.numberOfFilesRetrieved + 1,
      lastFileRetrieved: path.parse(filePath).base
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

    if (this.delegatesConnection()) {
      await this.connectionService!.remove(this.connector.type, this.connector.id);
    }

    this.logger.debug(`South connector "${this.connector.name}" (${this.connector.id}) disconnected`);
  }

  async stop(dataStream = true): Promise<void> {
    this.stopping = true;
    this.logger.debug(`Stopping South "${this.connector.name}" (${this.connector.id})...`);

    if (dataStream) {
      // Reload the settings only on data stream case, otherwise let the history query manage the settings
      this.connector = this.repositoryService.southConnectorRepository.getSouthConnector(this.connector.id)!;
    }

    if (this.runProgress$) {
      this.logger.debug('Waiting for South task to finish');
      await this.runProgress$.promise;
    }

    await this.disconnect();
    this.stopping = false;
    this.logger.info(`South connector "${this.connector.name}" stopped`);
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }

  async resetCache(): Promise<void> {
    this.cacheService!.resetCacheScanMode(this.connector.id);
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

  filterHistoryItems(items: Array<SouthConnectorItemDTO>): Array<SouthConnectorItemDTO> {
    return items;
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

  delegatesConnection(): this is DelegatesConnection {
    return 'connectionSettings' in this && 'createSession' in this;
  }

  async testConnection(): Promise<void> {
    this.logger.warn('testConnection must be override');
  }

  get settings(): SouthConnectorDTO<T> {
    return this.connector;
  }
}
